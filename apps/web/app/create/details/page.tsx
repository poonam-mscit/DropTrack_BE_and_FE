'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { wizardPath } from '@/lib/wizard-nav';
import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { StepBar } from '@/components/StepBar';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { clearDraft, loadDraft, saveDraft, type JobDraft } from '@/lib/draft';

interface JobCreatorResult {
  title: string;
  campaignType: JobDraft['campaignType'];
  leafletCount: number;
  startDate: string;
  deadline: string;
  suburb?: string;
  skipNoJunkMail: boolean;
  skipApartments: boolean;
  specialInstructions?: string;
  confidence: 'low' | 'medium' | 'high';
  stubbed: boolean;
  model: string;
}

const CAMPAIGN_TYPES: Array<[JobDraft['campaignType'], string]> = [
  ['real_estate', 'Real Estate'],
  ['medical', 'Medical / Clinic'],
  ['political', 'Political'],
  ['food', 'Food & Restaurant'],
  ['retail', 'Retail'],
  ['education', 'Education'],
  ['government', 'Government'],
  ['other', 'Other'],
];

interface ChatTurn {
  prompt: string;
  result: JobCreatorResult;
}

export default function CreateDetails() {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState<Partial<JobDraft>>({});
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<JobCreatorResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  /** Past turns in this session — first turn is the original brief; subsequent are refinements. */
  const [aiHistory, setAiHistory] = useState<ChatTurn[]>([]);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!getSession()) router.replace('/login');
    // Sidebar/menu "New Campaign" lands on /create/details — defensively wipe
    // any leftover edit-session draft (id, zone, prefilled fields) so the form
    // starts fresh. The edit URL (/campaigns/:id/edit/details) leaves it alone.
    const isNewFlow = !pathname?.startsWith('/campaigns/');
    const stale = loadDraft();
    if (isNewFlow && stale.id) {
      clearDraft();
      setDraft({});
    } else {
      setDraft(stale);
    }
    setHydrated(true);
  }, [router, pathname]);

  // Auto-save on every change after the initial hydration. Means clicking Back
  // (or even closing the tab) never loses what was typed.
  useEffect(() => {
    if (!hydrated) return;
    saveDraft(draft);
  }, [draft, hydrated]);

  function update<K extends keyof JobDraft>(key: K, value: JobDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function runJobCreator() {
    const prompt = aiPrompt.trim();
    if (prompt.length < 3) {
      setAiError('Type a few words first — e.g. "3000 flyers in Bondi next Monday".');
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      // Build conversation history for the API: alternating user/assistant turns.
      const history = aiHistory.flatMap((t) => [
        { role: 'user' as const, content: t.prompt },
        { role: 'assistant' as const, content: JSON.stringify(stripForHistory(t.result)) },
      ]);
      const result = await api.post<JobCreatorResult>('/api/ai/job-creator', {
        prompt,
        history,
        previousResult: aiResult ? stripForHistory(aiResult) : undefined,
      });
      setAiResult(result);
      setAiHistory((prev) => [...prev, { prompt, result }]);
      setAiPrompt(''); // clear input so next refinement is easy to type
      // Apply to the draft.
      setDraft((d) => ({
        ...d,
        title: result.title,
        campaignType: result.campaignType,
        leafletCount: result.leafletCount,
        startDate: result.startDate,
        deadline: result.deadline,
        skipNoJunkMail: result.skipNoJunkMail,
        skipApartments: result.skipApartments,
        specialInstructions: result.specialInstructions ?? d.specialInstructions,
        // Carry the AI-detected suburb so the Zone step can centre the map on it.
        suburb: result.suburb ?? d.suburb,
      }));
    } catch (err) {
      const msg = (err as { body?: { message?: unknown } }).body?.message;
      setAiError(typeof msg === 'string' ? msg : (err as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  function resetAiChat() {
    setAiHistory([]);
    setAiResult(null);
    setAiPrompt('');
    setAiError(null);
  }

  function next() {
    saveDraft(draft);
    router.push(wizardPath(pathname, 'zone'));
  }

  const ready =
    !!draft.title &&
    draft.title.length >= 3 &&
    !!draft.campaignType &&
    !!draft.leafletCount &&
    draft.leafletCount >= 50 &&
    !!draft.startDate &&
    !!draft.deadline;

  return (
    <div>
      <AppSidebar active={draft.id ? 'campaigns' : 'create'} />
      <main className="ml-[252px] p-10 max-w-[920px]">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {draft.id ? 'Edit Campaign' : 'Create New Campaign'}{' '}
            <span className="font-serif italic font-normal text-text-secondary">
              {draft.id ? '— update details.' : '— details first.'}
            </span>
          </h1>
          <a href="/dashboard" className="btn-ghost">Cancel</a>
        </div>

        <StepBar step={1} />
        <p className="text-text-muted text-xs mt-1 mb-6">Step 1 of 3 · Job details</p>

        {/* AI Job Creator banner */}
        <div
          className="rounded-2xl p-5 mb-5 flex gap-4 items-start"
          style={{
            background:
              'linear-gradient(135deg, rgba(79,70,229,.06) 0%, rgba(124,58,237,.04) 50%, rgba(163,230,53,.08) 100%)',
            border: '1px solid rgba(124,58,237,.15)',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED 50%,#A3E635)' }}
          >
            <Sparkles size={18} />
          </div>
          <div className="flex-1">
            <div className="font-semibold flex items-center gap-2">
              AI Job Creator
              <span
                className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED 50%,#A3E635)' }}
              >
                Live
              </span>
              {aiResult && (
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-success/10 text-success">
                  {aiResult.confidence} confidence{aiResult.stubbed ? ' · stub' : ''}
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary mt-1 mb-3">
              Describe your campaign in plain English — AI fills the form below.
              {aiHistory.length > 0 && ' Add follow-ups to refine without losing what you\'ve set.'}
            </p>

            {/* Conversation history — each prior prompt as a chat bubble */}
            {aiHistory.length > 0 && (
              <div className="mb-3 flex flex-col gap-1.5">
                {aiHistory.map((turn, i) => (
                  <div key={i} className="flex justify-end">
                    <span className="inline-block max-w-[80%] px-3 py-1.5 rounded-2xl rounded-br-md bg-primary/10 border border-primary/20 text-xs text-text-primary">
                      {turn.prompt}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                className="flex-1 px-3.5 py-3 border border-border rounded-xl bg-white text-sm"
                placeholder={
                  aiHistory.length > 0
                    ? 'Refine — e.g. "actually the area is Gold Coast" or "make it 5000"'
                    : 'e.g. "3000 flyers across Surry Hills next Monday, skip apartments"'
                }
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !aiBusy) runJobCreator();
                }}
                disabled={aiBusy}
              />
              <button
                onClick={runJobCreator}
                disabled={aiBusy || !aiPrompt.trim()}
                className="btn-primary disabled:opacity-50 shrink-0"
              >
                {aiBusy ? 'Thinking…' : aiHistory.length > 0 ? 'Refine ✨' : 'Generate ✨'}
              </button>
              {aiHistory.length > 0 && (
                <button
                  type="button"
                  onClick={resetAiChat}
                  disabled={aiBusy}
                  className="px-3 text-xs text-text-muted hover:text-text-primary shrink-0"
                  title="Start a fresh AI conversation"
                >
                  Reset
                </button>
              )}
            </div>
            {aiError && (
              <p className="text-xs text-danger mt-2">{aiError}</p>
            )}
            {aiResult && !aiError && (
              <p className="text-xs text-text-muted mt-2">
                Filled <strong>{aiResult.title}</strong> · {aiResult.leafletCount.toLocaleString()} leaflets ·{' '}
                {aiResult.startDate} → {aiResult.deadline}
                {aiResult.suburb && <> · suburb <strong>{aiResult.suburb}</strong></>}
                {aiResult.skipApartments && ' · skipping apartments'}. Review and edit below.
              </p>
            )}
          </div>
        </div>

        {/* Manual form */}
        <div className="card p-7">
          <h3 className="font-semibold mb-5">Or fill manually</h3>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Campaign name">
              <input
                className="input"
                placeholder="Spring Listings — Bondi"
                value={draft.title ?? ''}
                onChange={(e) => update('title', e.target.value)}
              />
            </Field>
            <Field label="Campaign type">
              <select
                className="input"
                value={draft.campaignType ?? ''}
                onChange={(e) => update('campaignType', e.target.value as JobDraft['campaignType'])}
              >
                <option value="">Select…</option>
                {CAMPAIGN_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Number of leaflets">
              <input
                className="input"
                type="number"
                placeholder="2500"
                value={draft.leafletCount ?? ''}
                onChange={(e) => update('leafletCount', Number(e.target.value))}
              />
            </Field>
            <Field label="Leaflet size">
              <select
                className="input"
                value={draft.leafletSize ?? 'dl'}
                onChange={(e) => update('leafletSize', e.target.value as JobDraft['leafletSize'])}
              >
                <option value="dl">DL (99×210mm)</option>
                <option value="a5">A5</option>
                <option value="a4">A4</option>
              </select>
            </Field>
            <Field label="Start date">
              <input
                className="input"
                type="date"
                value={draft.startDate ?? ''}
                onChange={(e) => update('startDate', e.target.value)}
              />
            </Field>
            <Field label="Deadline">
              <input
                className="input"
                type="date"
                value={draft.deadline ?? ''}
                onChange={(e) => update('deadline', e.target.value)}
              />
            </Field>
          </div>

          <Field label="Special instructions" className="mt-4">
            <textarea
              className="input"
              rows={3}
              placeholder="e.g. Skip apartment buildings. Respect 'No Junk Mail' signs."
              value={draft.specialInstructions ?? ''}
              onChange={(e) => update('specialInstructions', e.target.value)}
            />
          </Field>

          <div className="flex gap-5 mt-5 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.skipNoJunkMail !== false}
                onChange={(e) => update('skipNoJunkMail', e.target.checked)}
              />
              Skip &ldquo;No Junk Mail&rdquo; letterboxes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!draft.skipApartments}
                onChange={(e) => update('skipApartments', e.target.checked)}
              />
              Skip apartment buildings
            </label>
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <a href="/dashboard" className="btn-ghost">← Back</a>
          <button onClick={next} disabled={!ready} className="btn-primary disabled:opacity-50">
            Next: Select Zone <ArrowRight size={16} />
          </button>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[13px] font-semibold text-text-secondary mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

/**
 * Strip volatile fields the model shouldn't see again in subsequent turns
 * (confidence/stubbed/model are about THIS call, not the campaign state).
 */
function stripForHistory(r: JobCreatorResult): Omit<JobCreatorResult, 'confidence' | 'stubbed' | 'model'> {
  const { confidence: _c, stubbed: _s, model: _m, ...rest } = r;
  return rest;
}
