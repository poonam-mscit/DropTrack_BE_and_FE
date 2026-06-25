/**
 * AWS Bedrock client (Sydney region — `ap-southeast-2`).
 *
 * AU data residency: Bedrock invokes the model entirely inside AWS Sydney.
 * No data leaves the region.
 *
 * Default model: Anthropic Claude 3.5 Haiku — the strongest model available in
 * ap-southeast-2 at DropTrack price points. Was Mistral Small but that model
 * is not offered in Sydney; we swap implementation here, the rest of the API
 * keeps the same chat() signature.
 *
 * Boot mode:
 *   - AWS creds + AWS_BEDROCK_REGION present → real Bedrock calls
 *   - else → STUB mode (deterministic template narrative)
 */
import { Logger } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-3-5-haiku-20241022-v1:0';

let client: BedrockRuntimeClient | null = null;
let configured: boolean | null = null;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface BedrockResult {
  text: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
  stubbed: boolean;
}

export function isBedrockEnabled(): boolean {
  if (configured !== null) return configured;
  configured = Boolean(process.env.AWS_BEDROCK_REGION ?? process.env.AWS_REGION);
  return configured;
}

function getClient(): BedrockRuntimeClient | null {
  if (client) return client;
  if (!isBedrockEnabled()) return null;
  const region = process.env.AWS_BEDROCK_REGION ?? process.env.AWS_REGION;
  client = new BedrockRuntimeClient({ region });
  return client;
}

/**
 * Invoke Claude on Bedrock. Returns `stubbed: true` if Bedrock isn't configured.
 *
 * Claude's wire format on Bedrock differs from OpenAI/Mistral:
 *   - `system` is a top-level field, not a message role
 *   - `messages` only contain `user`/`assistant` roles
 *   - Multiple consecutive system messages are concatenated into one
 *   - Response shape: `{ content: [{ type: 'text', text }], usage: { input_tokens, output_tokens } }`
 */
export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; model?: string } = {},
): Promise<BedrockResult> {
  const c = getClient();
  if (!c) {
    Logger.warn(
      'Bedrock not configured — falling back to STUB narrative.',
      'BedrockClient',
    );
    return { text: '', tokensInput: 0, tokensOutput: 0, model: 'stub', stubbed: true };
  }

  const modelId = opts.model ?? BEDROCK_MODEL_ID;
  const family = detectFamily(modelId);

  const body =
    family === 'claude'
      ? buildClaudeBody(messages, opts)
      : family === 'nova'
        ? buildNovaBody(messages, opts)
        : buildMistralBody(messages, opts);

  try {
    const cmd = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(JSON.stringify(body)),
    });
    const res = await c.send(cmd);
    const raw = new TextDecoder().decode(res.body);
    const json = JSON.parse(raw) as Record<string, unknown>;

    if (family === 'claude') return parseClaudeResponse(json, modelId);
    if (family === 'nova') return parseNovaResponse(json, modelId);
    return parseMistralResponse(json, modelId);
  } catch (err) {
    const logger = new Logger('BedrockClient');
    const msg = (err as Error).message ?? '';
    // Known operational blocker — downgrade to WARN to avoid alarm-bell noise.
    if (msg.includes('Model use case details have not been submitted')) {
      if (!warnedModelGate.has(modelId)) {
        logger.warn(
          `Bedrock model "${modelId}" requires Anthropic use-case form (AWS Console → Bedrock → Model access). Falling back to stub until approved.`,
        );
        warnedModelGate.add(modelId);
      }
    } else {
      logger.error(`Bedrock invoke failed (${modelId}): ${msg} — falling back to stub.`);
    }
    return { text: '', tokensInput: 0, tokensOutput: 0, model: 'stub', stubbed: true };
  }
}

// Track which model IDs we've already warned about so the log only fires once per process.
const warnedModelGate = new Set<string>();

// ─────────────────── Claude (Anthropic) wire format ───────────────────

function buildClaudeBody(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number },
) {
  // Claude on Bedrock: system in a separate field, messages only user/assistant.
  const systemContent = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  return {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: opts.maxTokens ?? 1500,
    temperature: opts.temperature ?? 0.5,
    ...(systemContent ? { system: systemContent } : {}),
    messages: chatMessages,
  };
}

function parseClaudeResponse(json: Record<string, unknown>, modelId: string): BedrockResult {
  const content = json.content as Array<{ type: string; text?: string }> | undefined;
  const text = content?.find((c) => c.type === 'text')?.text ?? '';
  const usage = json.usage as { input_tokens?: number; output_tokens?: number } | undefined;
  return {
    text,
    tokensInput: usage?.input_tokens ?? 0,
    tokensOutput: usage?.output_tokens ?? 0,
    model: modelId,
    stubbed: false,
  };
}

// ─────────────────── Mistral wire format (legacy, kept for parity) ───────────────────

function buildMistralBody(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number },
) {
  return {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: opts.maxTokens ?? 1500,
    temperature: opts.temperature ?? 0.5,
  };
}

function parseMistralResponse(json: Record<string, unknown>, modelId: string): BedrockResult {
  const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
  const usage = json.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
  return {
    text: choices?.[0]?.message?.content ?? '',
    tokensInput: usage?.prompt_tokens ?? 0,
    tokensOutput: usage?.completion_tokens ?? 0,
    model: modelId,
    stubbed: false,
  };
}

// ─────────────────── model family detection ───────────────────

type ModelFamily = 'claude' | 'nova' | 'mistral';

function detectFamily(modelId: string): ModelFamily {
  // Inference profile prefixes (apac., au., us., etc.) sit in front of the provider name.
  const stripped = modelId.replace(/^[a-z]+\./, (p) =>
    /^(apac|au|us|eu|global)\./.test(p) ? '' : p,
  );
  const id = stripped.toLowerCase();
  if (id.includes('anthropic') || id.includes('claude')) return 'claude';
  if (id.startsWith('amazon.nova') || id.includes('.nova-')) return 'nova';
  return 'mistral'; // default for mistral.* and anything else using OpenAI-style messages
}

// ─────────────────── Amazon Nova wire format ───────────────────

/**
 * Nova format (similar in spirit to Claude but distinct enough):
 *   - `system` is a top-level array of `{ text }` objects (separate from messages)
 *   - `messages` only contain user/assistant roles; their `content` is an array of `{ text }`
 *   - `inferenceConfig` wraps max_new_tokens, temperature, topP
 *   - Response: `output.message.content[0].text` + `usage.{inputTokens,outputTokens}`
 */
function buildNovaBody(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number },
) {
  const system = messages.filter((m) => m.role === 'system').map((m) => ({ text: m.content }));
  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: [{ text: m.content }] }));
  return {
    ...(system.length ? { system } : {}),
    messages: chatMessages,
    inferenceConfig: {
      maxTokens: opts.maxTokens ?? 1500,
      temperature: opts.temperature ?? 0.5,
    },
  };
}

function parseNovaResponse(json: Record<string, unknown>, modelId: string): BedrockResult {
  const output = json.output as { message?: { content?: Array<{ text?: string }> } } | undefined;
  const text = output?.message?.content?.[0]?.text ?? '';
  const usage = json.usage as { inputTokens?: number; outputTokens?: number } | undefined;
  return {
    text,
    tokensInput: usage?.inputTokens ?? 0,
    tokensOutput: usage?.outputTokens ?? 0,
    model: modelId,
    stubbed: false,
  };
}
