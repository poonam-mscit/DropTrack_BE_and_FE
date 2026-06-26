'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  FolderClock,
  Loader2,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { api, type ApiJob, type JobStatus } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { clearDraft } from '@/lib/draft';

const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  real_estate: 'Real Estate',
  medical: 'Medical',
  political: 'Political',
  food: 'Food',
  retail: 'Retail',
  education: 'Education',
  government: 'Government',
  other: 'Campaign',
};

const TABS: Array<{ key: 'all' | 'active' | 'draft' | 'completed'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'completed', label: 'Completed' },
];

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<ApiJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlTab = (searchParams.get('tab') as (typeof TABS)[number]['key']) || 'all';
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>(urlTab);
  // Sync state when the URL ?tab=… changes (Next reuses the page on same-route nav,
  // so useState's initial value isn't re-evaluated; without this, clicking the
  // sidebar "Live Tracking" link from /campaigns wouldn't switch tabs).
  useEffect(() => {
    setTab(urlTab);
  }, [urlTab]);
  const [q, setQ] = useState('');
  // Banner shown after Stripe sends the user back here on success.
  const justPaid = searchParams.get('paid') === '1';
  const paidJobId = searchParams.get('job');
  const [showPaidBanner, setShowPaidBanner] = useState(justPaid);

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    void (async () => {
      try {
        const res = await api.get<ApiJob[] | { data?: ApiJob[] }>('/api/jobs');
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setJobs(list);
      } catch (err) {
        setError((err as Error).message);
        setJobs([]);
      }
    })();
  }, [router]);

  // Auto-dismiss the "paid" banner after 8 seconds + strip query params so a
  // refresh doesn't show it again.
  useEffect(() => {
    if (!justPaid) return;
    const t = setTimeout(() => setShowPaidBanner(false), 8000);
    // Replace URL without re-running the effect.
    window.history.replaceState({}, '', '/campaigns');
    return () => clearTimeout(t);
  }, [justPaid]);

  const paidJob = paidJobId ? jobs?.find((j) => j.id === paidJobId) : null;

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const byTab = jobs.filter((j) => {
      if (tab === 'all') return true;
      if (tab === 'active')
        return j.status === 'active' || j.status === 'paid_unassigned' || j.status === 'assigned' || j.status === 'upcoming';
      if (tab === 'draft') return j.status === 'draft';
      if (tab === 'completed') return j.status === 'completed';
      return true;
    });
    const term = q.trim().toLowerCase();
    return term
      ? byTab.filter(
          (j) =>
            j.title.toLowerCase().includes(term) ||
            j.jobCode.toLowerCase().includes(term) ||
            extractSuburb(j.title).toLowerCase().includes(term),
        )
      : byTab;
  }, [jobs, tab, q]);

  // Lifetime totals across all campaigns owned by this user.
  const totals = useMemo(() => {
    if (!jobs)
      return { count: 0, droppedLifetime: 0 };
    const completedOrActive = jobs.filter(
      (j) => j.status === 'completed' || j.status === 'active',
    );
    const dropped = completedOrActive.reduce(
      (acc, j) => acc + (j.status === 'completed' ? j.leafletCount : Math.round(j.leafletCount * mockCoverage(j))),
      0,
    );
    return { count: jobs.length, droppedLifetime: dropped };
  }, [jobs]);

  return (
    <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
      <AppSidebar
        active="campaigns"
        badges={{
          campaigns: jobs?.filter((j) => j.status === 'active' || j.status === 'assigned').length,
        }}
      />

      <main className="p-8 lg:p-10 max-w-[1280px]">
        {/* ── Header ── */}
        <header className="flex items-start justify-between gap-6 mb-7 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-[44px] leading-[1.05] font-bold tracking-tight">
              Campaigns{' '}
              <span className="font-serif italic font-normal text-text-secondary">
                — everything you've run.
              </span>
            </h1>
            <p className="mt-3 text-sm text-text-muted">
              <strong className="text-text-secondary font-semibold">{totals.count}</strong>{' '}
              campaigns ·{' '}
              <strong className="text-text-secondary font-semibold">
                {totals.droppedLifetime.toLocaleString()}
              </strong>{' '}
              leaflets dropped lifetime
            </p>
          </div>
          <button onClick={() => { clearDraft(); router.push('/create/details'); }} className="btn-primary h-11">
            <Plus size={14} /> New campaign
          </button>
        </header>

        {/* ── Search + tabs + filters pill ── */}
        <div className="bg-white rounded-2xl border border-border shadow-[0_2px_6px_rgba(11,13,18,.04)] p-3 mb-6 flex items-center gap-3 flex-wrap">
          <div className="flex-1 relative min-w-[220px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, suburb or month"
              className="w-full pl-10 pr-3 py-2.5 text-sm border-0 focus:outline-none bg-transparent"
            />
          </div>
          <div className="flex bg-bg-muted/60 rounded-xl p-1 gap-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-colors ${
                  tab === t.key
                    ? 'bg-white text-text-primary shadow-[0_1px_3px_rgba(11,13,18,.08)]'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            className="text-sm font-semibold border border-border rounded-xl px-4 py-2.5 flex items-center gap-2 hover:bg-bg-muted/40"
            type="button"
          >
            <SlidersHorizontal size={14} /> Filters
          </button>
        </div>

        {showPaidBanner && (
          <div
            className="mb-5 p-4 rounded-2xl border flex items-start gap-3"
            style={{
              background: 'linear-gradient(135deg, rgba(74,222,128,0.10), rgba(163,230,53,0.10))',
              borderColor: 'rgba(74,222,128,0.35)',
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500 text-white">
              <CheckCircle2 size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-emerald-800">Payment received — campaign is live.</p>
              <p className="text-sm text-emerald-700/85 mt-0.5">
                {paidJob
                  ? <>We're matching <strong>{paidJob.title}</strong> ({paidJob.jobCode}) to a dropper. You'll see GPS pins start landing once they hit the street.</>
                  : <>We're matching your campaign to a dropper. You'll see GPS pins start landing once they hit the street.</>}
              </p>
            </div>
            <button
              onClick={() => setShowPaidBanner(false)}
              className="text-emerald-700/70 hover:text-emerald-900 shrink-0"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Card grid ── */}
        {jobs === null ? (
          <div className="p-16 text-center text-sm text-text-muted">
            <Loader2 size={16} className="inline-block animate-spin mr-2" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            tab={tab}
            hasAny={(jobs?.length ?? 0) > 0}
            onCreate={() => { clearDraft(); router.push('/create/details'); }}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((j) => (
              <CampaignCard
                key={j.id}
                job={j}
                onOpen={async () => {
                  // Drafts → resume the create flow with prefilled fields.
                  // Everything else → live tracking view.
                  if (j.status === 'draft') {
                    router.push(`/campaigns/${j.id}/edit`);
                  } else {
                    router.push(`/campaigns/${j.id}`);
                  }
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Card
// ──────────────────────────────────────────────────────────────

function CampaignCard({ job, onOpen }: { job: ApiJob; onOpen: () => void }) {
  const subtitle = `${CAMPAIGN_TYPE_LABEL[job.campaignType] ?? 'Campaign'}${
    extractSuburb(job.title) ? ` · ${extractSuburb(job.title)}` : ''
  }`;
  const coverage = mockCoverage(job);
  const dropped = Math.round(job.leafletCount * coverage);
  const dayInfo = dayProgress(job);

  return (
    <button
      onClick={onOpen}
      className="text-left bg-white rounded-2xl border border-border shadow-[0_2px_6px_rgba(11,13,18,.04)] p-5 lg:p-6 hover:shadow-[0_8px_24px_-8px_rgba(11,13,18,.12)] hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-base truncate">{job.title}</h3>
          <p className="text-sm text-text-muted mt-0.5 truncate">{subtitle}</p>
        </div>
        <StatusPill status={job.status} />
      </div>

      {/* Status-specific body */}
      {job.status === 'draft' ? (
        <DraftBody job={job} />
      ) : job.status === 'paid_unassigned' ? (
        <PaidPendingBody job={job} />
      ) : job.status === 'completed' ? (
        <CompletedBody job={job} dropped={dropped} coverage={coverage} />
      ) : job.status === 'cancelled' ? (
        <CancelledBody />
      ) : (
        <ActiveBody
          job={job}
          dropped={dropped}
          coverage={coverage}
          dayInfo={dayInfo}
        />
      )}
    </button>
  );
}

function ActiveBody({
  job,
  dropped,
  coverage,
  dayInfo,
}: {
  job: ApiJob;
  dropped: number;
  coverage: number;
  dayInfo: { day: number; of: number } | null;
}) {
  return (
    <>
      <p className="text-[15px] mt-5">
        <span className="font-bold">{dropped.toLocaleString()}</span>{' '}
        <span className="text-text-muted">/ {job.leafletCount.toLocaleString()} dropped</span>
      </p>
      <ProgressBar value={coverage} />
      <div className="flex justify-between mt-2.5 text-[13px] text-text-muted">
        <span>{dayInfo ? `Day ${dayInfo.day} of ${dayInfo.of}` : 'In progress'}</span>
        <span>{Math.round(coverage * 100)}% coverage</span>
      </div>
    </>
  );
}

function CompletedBody({ job, dropped, coverage }: { job: ApiJob; dropped: number; coverage: number }) {
  const days =
    job.startDate && job.deadline
      ? Math.max(
          1,
          Math.round(
            (new Date(job.deadline).getTime() - new Date(job.startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;
  return (
    <>
      <p className="text-[15px] mt-5">
        <span className="font-bold">{dropped.toLocaleString()}</span>{' '}
        <span className="text-text-muted">/ {job.leafletCount.toLocaleString()} dropped</span>
      </p>
      <ProgressBar value={1} />
      <div className="flex justify-between mt-2.5 text-[13px] text-text-muted">
        <span>{days ? `${days} day${days === 1 ? '' : 's'}` : 'Completed'}</span>
        <span>{Math.round(coverage * 100)}% coverage</span>
      </div>
    </>
  );
}

function DraftBody({ job }: { job: ApiJob }) {
  const created = new Date(job.createdAt);
  const expiresAt = new Date(created.getTime() + 24 * 60 * 60 * 1000); // 24h hold window
  const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));
  return (
    <>
      <p className="text-[15px] mt-5">
        <span className="font-bold">{job.leafletCount.toLocaleString()}</span>{' '}
        <span className="text-text-muted">leaflets · awaiting payment</span>
      </p>
      <div className="h-1.5 mt-3 rounded-full bg-bg-muted overflow-hidden">
        <div className="h-full w-0 bg-text-muted/40" />
      </div>
      <div className="flex justify-between mt-2.5 text-[13px] text-text-muted">
        <span>Created {timeAgo(created)}</span>
        <span className={hoursLeft <= 6 ? 'text-amber-600 font-semibold' : ''}>
          Expires in {hoursLeft}h
        </span>
      </div>
    </>
  );
}

function PaidPendingBody({ job }: { job: ApiJob }) {
  return (
    <>
      <p className="text-[15px] mt-5">
        <span className="font-bold">{job.leafletCount.toLocaleString()}</span>{' '}
        <span className="text-text-muted">leaflets · matching a dropper</span>
      </p>
      <div className="h-1.5 mt-3 rounded-full bg-bg-muted overflow-hidden">
        <div className="h-full w-1/5 bg-gradient-to-r from-indigo-500 to-indigo-400 animate-pulse" />
      </div>
      <div className="flex justify-between mt-2.5 text-[13px] text-text-muted">
        <span>Paid {timeAgo(new Date(job.paidAt ?? job.createdAt))}</span>
        <span>Awaiting assignment</span>
      </div>
    </>
  );
}

function CancelledBody() {
  return (
    <>
      <p className="text-[15px] mt-5 text-text-muted italic">Campaign cancelled.</p>
      <div className="h-1.5 mt-3 rounded-full bg-bg-muted" />
      <div className="mt-2.5 text-[13px] text-text-muted">No charges incurred.</div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Status pill + progress bar
// ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: JobStatus }) {
  const config: Record<JobStatus, { label: string; bg: string; fg: string; dot?: string }> = {
    active: { label: 'Live', bg: 'bg-emerald-50', fg: 'text-emerald-700', dot: 'bg-emerald-500' },
    assigned: { label: 'Scheduled', bg: 'bg-sky-50', fg: 'text-sky-700' },
    upcoming: { label: 'Scheduled', bg: 'bg-sky-50', fg: 'text-sky-700' },
    paid_unassigned: { label: 'Awaiting', bg: 'bg-indigo-50', fg: 'text-indigo-700' },
    draft: { label: 'Draft', bg: 'bg-amber-50', fg: 'text-amber-700' },
    completed: { label: 'Done', bg: 'bg-indigo-50', fg: 'text-indigo-700' },
    cancelled: { label: 'Cancelled', bg: 'bg-bg-muted', fg: 'text-text-muted' },
  };
  const c = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${c.bg} ${c.fg}`}
    >
      {c.dot && <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />}
      {c.label}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1.5 mt-3 rounded-full bg-bg-muted overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 55%, #a3e635 100%)',
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────────────────────

function EmptyState({
  tab,
  hasAny,
  onCreate,
}: {
  tab: string;
  hasAny: boolean;
  onCreate: () => void;
}) {
  if (!hasAny) {
    return (
      <div className="bg-white rounded-2xl border border-border p-16 text-center shadow-[0_2px_6px_rgba(11,13,18,.04)]">
        <FolderClock size={22} className="text-text-muted mx-auto mb-3" />
        <p className="font-semibold">No campaigns yet</p>
        <p className="text-sm text-text-muted mt-1 mb-5">
          Spin up your first campaign in under five minutes.
        </p>
        <button onClick={onCreate} className="btn-primary">
          <Plus size={14} /> New campaign
        </button>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-border p-16 text-center shadow-[0_2px_6px_rgba(11,13,18,.04)]">
      <MapPin size={22} className="text-text-muted mx-auto mb-3" />
      <p className="font-semibold">Nothing in {tab}</p>
      <p className="text-sm text-text-muted mt-1">Try a different tab or clear the search.</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/** Extract a suburb from a job title like "Listings — Bondi" or "Bondi · Open House". */
function extractSuburb(title: string): string {
  const dash = title.split('—');
  if (dash.length > 1) return dash[1].trim();
  const dot = title.split('·');
  if (dot.length > 1) return dot[0].trim();
  return '';
}

/** Estimate "Day X of Y" for in-flight campaigns. */
function dayProgress(job: ApiJob): { day: number; of: number } | null {
  if (!job.startDate || !job.deadline) return null;
  const start = new Date(job.startDate).getTime();
  const end = new Date(job.deadline).getTime();
  const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(
    1,
    Math.min(totalDays, Math.ceil((Date.now() - start) / (1000 * 60 * 60 * 24))),
  );
  return { day: elapsedDays, of: totalDays };
}

/**
 * Coverage stub — until we wire real drops counts, derive from status.
 * Completed = 100%. Active = progress proportional to days elapsed.
 * Returns a 0..1 fraction.
 */
function mockCoverage(job: ApiJob): number {
  if (job.status === 'completed') return 1;
  if (job.status === 'cancelled' || job.status === 'draft') return 0;
  const d = dayProgress(job);
  if (!d) return 0.4;
  return Math.min(0.98, d.day / d.of);
}

function timeAgo(date: Date): string {
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}hr ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
}
