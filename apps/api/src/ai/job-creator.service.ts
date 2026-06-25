/**
 * AI Job Creator — natural language → structured job form.
 *
 * Example prompts the agent might type:
 *   "3000 flyers across Surry Hills next Monday, skip apartments"
 *   "Real estate campaign in Bondi, 2k leaflets, start Dec 1"
 *
 * If Bedrock is reachable we send the prompt to Claude with strict instructions
 * to return JSON. Otherwise we fall back to a regex-based parser so the feature
 * works in dev / before AWS creds land.
 */
import { Injectable, Logger } from '@nestjs/common';
import { chat } from './bedrock.client.js';

export type CampaignType =
  | 'real_estate'
  | 'medical'
  | 'political'
  | 'food'
  | 'retail'
  | 'education'
  | 'government'
  | 'other';

export interface JobCreatorOutput {
  title: string;
  campaignType: CampaignType;
  leafletCount: number;
  startDate: string; // YYYY-MM-DD
  deadline: string; // YYYY-MM-DD
  suburb?: string;
  skipNoJunkMail: boolean;
  skipApartments: boolean;
  specialInstructions?: string;
  confidence: 'low' | 'medium' | 'high';
  stubbed: boolean;
  model: string;
}

export interface ParseInput {
  prompt: string;
  /** Optional prior turns — earliest first. Lets the model treat a follow-up as a refinement. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Optional last extracted JSON — anchors the merge so unchanged fields stay put. */
  previousResult?: Record<string, unknown>;
}

@Injectable()
export class JobCreatorService {
  private readonly logger = new Logger(JobCreatorService.name);

  async parse(input: ParseInput | string): Promise<JobCreatorOutput> {
    // Back-compat: accept a bare string from older callers.
    const { prompt, history, previousResult } =
      typeof input === 'string' ? { prompt: input, history: undefined, previousResult: undefined } : input;

    if (!prompt?.trim()) {
      throw new Error('Prompt is empty');
    }

    // Build the conversation. Earliest turns first; previousResult slots in as an
    // assistant message so the LLM has the JSON state to merge against.
    const conversation: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];
    if (history && history.length) {
      conversation.push(...history);
    }
    if (previousResult) {
      // If the most recent message wasn't already the previous JSON, add it as anchor.
      const last = conversation[conversation.length - 1];
      if (!last || last.role !== 'assistant' || !last.content.startsWith('{')) {
        conversation.push({
          role: 'assistant',
          content: JSON.stringify(stripVolatileFields(previousResult)),
        });
      }
    }
    conversation.push({ role: 'user', content: prompt });

    const ai = await chat(conversation, { temperature: 0, maxTokens: 600 });

    if (ai.stubbed) {
      const heuristic = parseHeuristic(prompt);
      this.logger.log(`JobCreator STUB: "${prompt.slice(0, 80)}" → ${heuristic.title}`);
      return { ...heuristic, confidence: 'medium', stubbed: true, model: 'stub' };
    }

    // Extract the first JSON object from the model output.
    const match = ai.text.match(/\{[\s\S]*\}/);
    if (!match) {
      this.logger.warn(`Model returned no JSON, falling back to heuristic. Output: ${ai.text.slice(0, 200)}`);
      const heuristic = parseHeuristic(prompt);
      return { ...heuristic, confidence: 'low', stubbed: false, model: ai.model };
    }

    try {
      const parsed = JSON.parse(sanitiseJson(match[0])) as Partial<JobCreatorOutput>;
      // Validate + normalise — let the heuristic fill anything the model missed.
      const heuristic = parseHeuristic(prompt);
      return {
        title: parsed.title || heuristic.title,
        campaignType: (parsed.campaignType as CampaignType) || heuristic.campaignType,
        leafletCount: clampLeafletCount(parsed.leafletCount ?? heuristic.leafletCount),
        startDate: normaliseDate(parsed.startDate) || heuristic.startDate,
        deadline: normaliseDate(parsed.deadline) || heuristic.deadline,
        suburb: parsed.suburb || heuristic.suburb,
        skipNoJunkMail: parsed.skipNoJunkMail ?? heuristic.skipNoJunkMail,
        skipApartments: parsed.skipApartments ?? heuristic.skipApartments,
        specialInstructions: parsed.specialInstructions || heuristic.specialInstructions,
        confidence: 'high',
        stubbed: false,
        model: ai.model,
      };
    } catch (err) {
      this.logger.warn(
        `JSON parse failed: ${(err as Error).message} · raw: ${ai.text.slice(0, 250)}`,
      );
      const heuristic = parseHeuristic(prompt);
      return { ...heuristic, confidence: 'low', stubbed: false, model: ai.model };
    }
  }
}

/**
 * Forgiving JSON sanitiser — handles common LLM output quirks:
 *   - Trailing commas:  { "a": 1, }   → { "a": 1 }
 *   - Single quotes:    { 'a': 1 }    → { "a": 1 }
 *   - Markdown fences:  ```json {…} ``` → {…}
 *   - // line comments
 */
function sanitiseJson(raw: string): string {
  return raw
    // Strip leading/trailing markdown fences if model wrapped JSON in ```json ... ```
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    // Strip // line comments
    .replace(/(^|[^:"'\w])\/\/[^\n]*/g, '$1')
    // Strip trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, '$1')
    // Convert single-quoted strings to double-quoted (only when value is a simple string,
    // not when used inside a real string with apostrophe).
    .replace(/(\{|,)(\s*)'([^']+)'\s*:/g, '$1$2"$3":')
    .trim();
}

// ─────────────────────── helpers ───────────────────────

/** Drop fields the model shouldn't see/mimic in its output (confidence, stubbed, model). */
function stripVolatileFields(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'confidence' || k === 'stubbed' || k === 'model') continue;
    if (v === null || v === undefined) continue;
    clean[k] = v;
  }
  return clean;
}

// ─────────────────────── prompt ───────────────────────

const SYSTEM_PROMPT = [
  'You are AI Job Creator for DropTrack — an Australian leaflet-distribution platform.',
  `Today is ${new Date().toISOString().slice(0, 10)} (Australia/Sydney).`,
  '',
  'CONVERSATION MODE: if a prior assistant turn contains a JSON object, treat it as the current',
  'campaign state. The latest user turn is a REFINEMENT — keep every prior field unchanged unless',
  'the user clearly modifies it. Never reset fields back to defaults across turns. Apply only the',
  'minimum changes the user requested.',
  '',
  'Given a one-line campaign brief, extract structured fields and respond with ONLY a',
  'single JSON object. No prose, no markdown fences, no comments, no trailing commas,',
  'only double-quoted keys and strings. Output MUST parse with JSON.parse() as-is.',
  '',
  'Field rules:',
  '- title: short campaign name. If the brief includes a quoted name like "Foo 300",',
  '  use that verbatim. Otherwise build "<purpose> — <suburb>" e.g. "Listings — Bondi".',
  '- campaignType: one of "real_estate" "medical" "political" "food" "retail" "education"',
  '  "government" "other". Infer from context — DO NOT default to "political" unless the',
  '  brief mentions election/candidate/party/voting.',
  '- leafletCount: integer 50–50000. If a number appears in the campaign NAME ("Goldcost 300"),',
  '  treat that number as the leaflet count. If no count is given anywhere, default to 1000.',
  '- startDate: "YYYY-MM-DD". Resolve relative dates ("next Monday", "tomorrow") against today.',
  '- deadline: "YYYY-MM-DD". Default 3–5 days after startDate unless brief specifies.',
  '- suburb: Australian suburb / locality if mentioned, else null. Be tolerant of typos and',
  '  spacing ("gold cost" → "Gold Coast", "bonnie" → "Bondi", "syd cbd" → "Sydney CBD",',
  '  "geelong vic" → "Geelong"). Always output the canonical AU place name.',
  '- skipNoJunkMail: default true.',
  '- skipApartments: true if brief says "skip apartments" / "houses only" / "no apartments".',
  '  Be tolerant of typos like "aparmetns", "appartments".',
  '- specialInstructions: short sentence summarising any extra rules the brief mentioned',
  '  (skip apartments, leave at front gate, respect "no junk mail", etc). null if none.',
  '',
  'Shape:',
  '{"title":"...","campaignType":"...","leafletCount":1000,"startDate":"YYYY-MM-DD",',
  '"deadline":"YYYY-MM-DD","suburb":null,"skipNoJunkMail":true,"skipApartments":false,',
  '"specialInstructions":null}',
].join('\n');

// ─────────────────────── heuristic fallback ───────────────────────

function parseHeuristic(prompt: string): Omit<JobCreatorOutput, 'confidence' | 'stubbed' | 'model'> {
  const lower = prompt.toLowerCase();

  // Leaflet count — "3000 leaflets", "2.5k", "1500 flyers"
  let leafletCount = 1000;
  const m1 = lower.match(/(\d[\d,]*\.?\d*)\s*k(?:\b|\s)/);
  const m2 = lower.match(/(\d[\d,]*)\s*(?:leaflets?|flyers?|pamphlets?|drops?)/);
  if (m1) leafletCount = Math.round(parseFloat(m1[1].replace(/,/g, '')) * 1000);
  else if (m2) leafletCount = parseInt(m2[1].replace(/,/g, ''), 10);
  leafletCount = clampLeafletCount(leafletCount);

  // Campaign type
  let campaignType: CampaignType = 'other';
  if (/(real estate|listing|open\s*home|auction|property|home open)/.test(lower)) campaignType = 'real_estate';
  else if (/(clinic|medical|gp|dentist|physio|chiropract)/.test(lower)) campaignType = 'medical';
  else if (/(political|election|campaign|candidate|labor|liberal|greens|teal)/.test(lower)) campaignType = 'political';
  else if (/(pizza|cafe|restaurant|coffee|menu|takeaway)/.test(lower)) campaignType = 'food';
  else if (/(retail|sale|promo|store|shop)/.test(lower)) campaignType = 'retail';
  else if (/(school|college|university|open day)/.test(lower)) campaignType = 'education';
  else if (/(council|government|notice)/.test(lower)) campaignType = 'government';

  // Suburb — capture proper noun after "in" or "across", crude but useful
  let suburb: string | undefined;
  const m3 =
    prompt.match(/(?:in|across|at|around)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})/);
  if (m3) suburb = m3[1].trim();

  // Dates
  const startDate = resolveDate(lower);
  const startD = new Date(`${startDate}T00:00:00+10:00`);
  const deadlineD = new Date(startD.getTime() + 4 * 24 * 60 * 60 * 1000);
  const deadline = deadlineD.toISOString().slice(0, 10);

  // Flags
  const skipApartments = /skip\s+apartments?|houses?\s+only|no\s+apartments?/.test(lower);
  const skipNoJunkMail = !/include\s+no\s+junk\s+mail|all\s+letterboxes/.test(lower);

  // Title
  const titleSuburb = suburb ?? 'Campaign';
  const titlePrefix =
    campaignType === 'real_estate'
      ? 'Listings'
      : campaignType === 'medical'
        ? 'Clinic'
        : campaignType === 'political'
          ? 'Election'
          : campaignType === 'food'
            ? 'Special'
            : campaignType === 'retail'
              ? 'Promo'
              : 'Campaign';
  const title = `${titlePrefix} — ${titleSuburb}`;

  // Special instructions — copy back whatever's after "skip" or "respect" phrases
  let specialInstructions: string | undefined;
  if (skipApartments) specialInstructions = 'Skip apartment buildings.';

  return {
    title,
    campaignType,
    leafletCount,
    startDate,
    deadline,
    suburb,
    skipNoJunkMail,
    skipApartments,
    specialInstructions,
  };
}

function resolveDate(lower: string): string {
  const today = new Date();
  const day = today.getUTCDay(); // 0 Sun .. 6 Sat
  const target = (n: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  if (/today/.test(lower)) return target(0);
  if (/tomorrow/.test(lower)) return target(1);
  if (/this weekend|saturday/.test(lower)) return target((6 - day + 7) % 7 || 7);
  if (/next week/.test(lower)) return target(7 + ((1 - day + 7) % 7));
  if (/next monday|monday/.test(lower)) return target((8 - day) % 7 || 7);
  if (/next tuesday|tuesday/.test(lower)) return target((9 - day) % 7 || 7);
  if (/next wednesday|wednesday/.test(lower)) return target((10 - day) % 7 || 7);
  if (/next thursday|thursday/.test(lower)) return target((11 - day) % 7 || 7);
  if (/next friday|friday/.test(lower)) return target((12 - day) % 7 || 7);

  // Try absolute date like "Dec 1", "1 December", or ISO
  const iso = lower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  // Default to 7 days from now.
  return target(7);
}

function clampLeafletCount(n: number | undefined): number {
  if (!n || !Number.isFinite(n)) return 1000;
  return Math.max(50, Math.min(50_000, Math.round(n)));
}

function normaliseDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}
