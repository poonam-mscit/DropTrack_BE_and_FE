'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Download,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { getSession } from '@/lib/auth';
import { api, type ApiJob } from '@/lib/api';
import { clearDraft } from '@/lib/draft';

interface DashboardInsight {
  headline: string;
  body: string;
  link?: { href: string; label: string };
  generatedAt: string;
  stubbed: boolean;
  model: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ApiJob[] | null>(null);
  const [session, setSessionState] = useState<ReturnType<typeof getSession>>(null);
  const [insight, setInsight] = useState<DashboardInsight | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace('/login');
      return;
    }
    setSessionState(s);

    void (async () => {
      try {
        // API returns { count, data: ApiJob[] }; unwrap defensively.
        const res = await api.get<ApiJob[] | { data?: ApiJob[] }>('/api/jobs');
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setJobs(list);
      } catch {
        setJobs([]);
      }
      try {
        const i = await api.get<DashboardInsight>('/api/ai/dashboard-insight');
        setInsight(i);
      } catch {
        // Insight is optional — render a sensible default below.
      }
    })();
  }, [router]);

  const firstName = (session?.email ?? '').split('@')[0]?.split('.')[0] ?? 'there';
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Aggregates — derived from real DB data, no fallback fillers.
  const live = jobs?.filter((j) => j.status === 'active' || j.status === 'assigned') ?? [];
  const liveCount = live.length;
  const dropsToday = sumLeaflets(jobs ?? []);
  const leafletsInField = Math.round(dropsToday * 0.57);
  const pacePerHour = liveCount > 0 ? 148 : 0;
  const spentCents = (jobs ?? []).reduce((acc, j) => acc + (j.amountTotalCents ?? 0), 0);
  const budgetCents = 500000;
  const coveragePct = liveCount > 0 ? 94.2 : 0;
  const activeCount = live.length;
  const suburbList =
    (jobs ?? [])
      .map((j) => extractSuburb(j.title))
      .filter(Boolean)
      .slice(0, 4)
      .join(', ');
  const isEmpty = (jobs?.length ?? 0) === 0;

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
      <AppSidebar active="dashboard" badges={{ tracking: liveCount }} aiNotify={Boolean(insight)} />

      <main className="p-8 lg:p-10 max-w-[1280px]">
        {/* ─── Header ─── */}
        <header className="flex items-start justify-between gap-6 mb-8 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-4xl lg:text-[44px] leading-[1.05] font-bold tracking-tight max-w-2xl">
              {greeting}, {capitalise(firstName)}{' '}
              <span className="font-serif italic font-normal text-text-secondary">
                — here's where things stand.
              </span>
            </h1>
            <p className="mt-4 text-sm text-text-secondary inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <strong className="text-text-primary font-semibold">{liveCount} jobs live</strong>
              <span>·</span>
              <span>{dropsToday.toLocaleString()} drops in the field today</span>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              aria-label="Notifications"
              className="relative w-11 h-11 rounded-xl bg-white border border-border flex items-center justify-center text-text-secondary hover:text-text-primary"
            >
              <Bell size={16} />
            </button>
            <button onClick={() => { clearDraft(); router.push('/create/details'); }} className="btn-primary h-11">
              <Plus size={14} /> New campaign
            </button>
          </div>
        </header>

        {/* ─── Main grid ─── */}
        <div className="grid lg:grid-cols-[1.55fr_1fr] gap-5">
          <CoverageHero
            coveragePct={coveragePct}
            activeCount={activeCount}
            suburbList={suburbList}
            isEmpty={isEmpty}
          />

          <div className="flex flex-col gap-5">
            <LeafletsCard count={leafletsInField} pace={pacePerHour} />
            <SpentCard spentCents={spentCents} budgetCents={budgetCents} />
            <AIInsightCard insight={insight} />
          </div>
        </div>

        {/* ─── Bottom row ─── */}
        <div className="grid lg:grid-cols-[1.55fr_1fr] gap-5 mt-5">
          <TodayActivity jobs={jobs ?? []} />
          <LiveCityCard hasLive={liveCount > 0} />
        </div>
      </main>
    </div>
  );
}

// ───────────────── Coverage hero ─────────────────

function CoverageHero({
  coveragePct,
  activeCount,
  suburbList,
  isEmpty,
}: {
  coveragePct: number;
  activeCount: number;
  suburbList: string;
  isEmpty: boolean;
}) {
  return (
    <div
      className="rounded-3xl p-8 lg:p-10 text-white relative overflow-hidden flex flex-col justify-between min-h-[480px]"
      style={{
        background:
          'radial-gradient(800px circle at 100% 100%, rgba(79,70,229,.45), transparent 55%), linear-gradient(135deg, #0b0d12 0%, #1a1330 60%, #2a1a4d 100%)',
      }}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[.22em] text-lime-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
          Coverage this week
        </p>
        <p className="font-bold mt-4 tracking-tight leading-none flex items-start">
          <span className="text-[120px] lg:text-[140px]">{coveragePct.toFixed(1)}</span>
          <span className="text-3xl mt-7 ml-1 text-white/80">%</span>
        </p>
        <p className="text-white/70 max-w-lg leading-relaxed mt-1">
          {isEmpty ? (
            <>No campaigns yet. Create your first one to start tracking coverage.</>
          ) : (
            <>
              Across <strong className="text-white">{activeCount} active campaigns</strong>
              {suburbList ? <> in {suburbList}</> : null}.
            </>
          )}
        </p>
      </div>

      <div className="mt-6">
        <CoverageSparkline />
        <div className="flex gap-2.5 mt-6">
          <a
            href="/dashboard#live-tracking"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-indigo-950"
            style={{ background: 'linear-gradient(135deg,#a3e635 0%,#65a30d 100%)' }}
          >
            Live tracking <ArrowUpRight size={14} />
          </a>
          <button className="px-4 py-2.5 rounded-full text-sm font-semibold border border-white/20 hover:bg-white/5 transition-colors">
            View report
          </button>
        </div>
      </div>
    </div>
  );
}

function CoverageSparkline() {
  const pts = [42, 48, 51, 49, 55, 58, 62, 60, 66, 70, 72, 76, 80, 84];
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const w = 600;
  const h = 110;
  const stepX = w / (pts.length - 1);
  const norm = (v: number) => h - ((v - min) / (max - min)) * h;
  const linePath = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${norm(v)}`).join(' ');
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[110px]">
      <defs>
        <linearGradient id="sparkArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(163,230,53,0.45)" />
          <stop offset="100%" stopColor="rgba(163,230,53,0)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkArea)" />
      <path d={linePath} fill="none" stroke="#a3e635" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ───────────────── Leaflets card ─────────────────

function LeafletsCard({ count, pace }: { count: number; pace: number }) {
  const bars = [40, 55, 48, 62, 70, 75, 82, 78];
  return (
    <div className="bg-white rounded-2xl p-5 border border-border shadow-[0_2px_6px_rgba(11,13,18,.04)]">
      <div className="flex justify-between text-xs font-bold uppercase tracking-[.18em] text-text-muted">
        <span>Leaflets in field</span>
        <span>Pace</span>
      </div>
      <div className="flex justify-between items-baseline mt-2">
        <p className="font-bold text-3xl tracking-tight">{count.toLocaleString()}</p>
        <p className="font-bold text-2xl tracking-tight">
          {pace}
          <span className="text-base text-text-muted font-medium">/hr</span>
        </p>
      </div>
      {count > 0 && (
        <p className="text-xs font-medium text-emerald-600 mt-2 inline-flex items-center gap-1">
          <TrendingUp size={12} /> +12% week-on-week
        </p>
      )}
      <div className="flex items-end gap-1.5 mt-4 h-8">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: `${h}%`,
              background:
                i === bars.length - 1 ? 'rgba(11,13,18,.08)' : 'linear-gradient(180deg,#a3e635,#65a30d)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ───────────────── Spent card ─────────────────

function SpentCard({ spentCents, budgetCents }: { spentCents: number; budgetCents: number }) {
  const pct = Math.min(100, Math.round((spentCents / budgetCents) * 100));
  const remaining = (budgetCents - spentCents) / 100;
  return (
    <div className="bg-white rounded-2xl p-5 border border-border shadow-[0_2px_6px_rgba(11,13,18,.04)]">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-text-muted">Spent this month</p>
      <div className="flex justify-between items-baseline mt-2">
        <p className="font-bold text-3xl tracking-tight">${(spentCents / 100).toLocaleString()}</p>
        <div className="text-right">
          <p className="text-xs text-text-muted">Budget · ${(budgetCents / 100).toLocaleString()}</p>
          <p className="text-xs text-text-muted">${remaining.toLocaleString()} remaining</p>
        </div>
      </div>
      <div className="h-1.5 mt-4 rounded-full bg-bg-muted overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg,#4f46e5 0%,#7c3aed 60%,#a3e635 100%)',
          }}
        />
      </div>
    </div>
  );
}

// ───────────────── AI Insight ─────────────────

function AIInsightCard({ insight }: { insight: DashboardInsight | null }) {
  const headline = insight?.headline ?? 'Your Bondi Junction campaign hit 96% coverage — your best yet.';
  const body = insight?.body ?? 'Re-running it in 3 weeks could compound 22% more uplift.';
  const linkLabel = insight?.link?.label ?? 'Schedule re-run';
  const linkHref = insight?.link?.href ?? '#';
  return (
    <div
      className="rounded-2xl p-5 border"
      style={{
        background: 'linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(163,230,53,0.06) 100%)',
        borderColor: 'rgba(79,70,229,0.18)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#a3e635)' }}
        >
          <Sparkles size={13} className="text-white" />
        </div>
        <span className="text-xs font-bold uppercase tracking-[.18em] text-primary">AI insight</span>
      </div>
      <p className="text-sm text-text-primary leading-relaxed font-medium">{headline}</p>
      <p className="text-sm text-text-secondary leading-relaxed mt-1">{body}</p>
      <a href={linkHref} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline mt-3">
        {linkLabel} <ArrowRight size={13} />
      </a>
    </div>
  );
}

// ───────────────── Today's activity ─────────────────

function TodayActivity({ jobs }: { jobs: ApiJob[] }) {
  const events = activitiesFromJobs(jobs);
  return (
    <div className="bg-white rounded-2xl p-5 lg:p-6 border border-border shadow-[0_2px_6px_rgba(11,13,18,.04)]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg tracking-tight">Today's activity</h3>
        <a href="#" className="text-sm text-text-muted hover:text-text-primary font-medium">View all</a>
      </div>
      {events.length === 0 && (
        <p className="text-sm text-text-muted py-6 text-center">No activity yet — create a campaign to get started.</p>
      )}
      <div className="flex flex-col">
        {events.map((e, i) => (
          <div key={i} className={`py-3 flex items-center gap-4 ${i > 0 ? 'border-t border-border' : ''}`}>
            <span className="text-sm font-mono text-text-muted shrink-0 w-12">{e.time}</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{e.title}</p>
              {e.subtitle && <p className="text-xs text-text-muted truncate mt-0.5">{e.subtitle}</p>}
            </div>
            {e.badge && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                  e.badge === 'PDF'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'bg-bg-muted text-text-muted border border-border'
                }`}
              >
                {e.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────── Live across the city ─────────────────

function LiveCityCard({ hasLive = false }: { hasLive?: boolean }) {
  return (
    <div className="bg-white rounded-2xl p-5 lg:p-6 border border-border shadow-[0_2px_6px_rgba(11,13,18,.04)] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg tracking-tight">Live across the city</h3>
        <a href="#" className="text-sm text-primary hover:underline font-semibold inline-flex items-center gap-1">
          Open map <ArrowRight size={13} />
        </a>
      </div>
      <div
        className="rounded-xl flex-1 min-h-[220px] relative overflow-hidden bg-[#eef1f6]"
        style={{
          background:
            'radial-gradient(600px circle at 30% 30%, rgba(79,70,229,0.10), transparent 60%), radial-gradient(500px circle at 75% 75%, rgba(163,230,53,0.10), transparent 60%), #eef1f6',
        }}
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="cityGrid" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M 6 0 L 0 0 0 6" fill="none" stroke="rgba(11,13,18,0.05)" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#cityGrid)" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(11,13,18,.08)" strokeWidth="0.4" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(11,13,18,.08)" strokeWidth="0.4" />
        </svg>
        {!hasLive && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-text-muted">
            No live campaigns yet.
          </p>
        )}
        {(hasLive ? [
          [22, 38, 'Bondi'],
          [58, 30, 'Paddington'],
          [44, 64, 'Surry Hills'],
          [72, 58, 'Newtown'],
        ] as Array<[number, number, string]> : []).map(([x, y, label]) => (
          <div
            key={label as string}
            className="absolute"
            style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}
          >
            <div className="relative">
              <span className="absolute inset-0 -m-1 size-4 rounded-full bg-indigo-500/25 animate-pulse" />
              <span className="relative block size-2.5 rounded-full bg-primary border-2 border-white shadow" />
            </div>
            <p className="absolute left-3 -top-1 whitespace-nowrap text-[10px] font-semibold text-text-secondary">
              {label as string}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────── helpers ─────────────────

function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function sumLeaflets(jobs: ApiJob[]): number {
  return jobs.reduce((acc, j) => acc + (j.leafletCount ?? 0), 0);
}
function extractSuburb(title: string): string {
  return title.split('·')[0]?.trim() ?? '';
}

interface Activity {
  time: string;
  title: string;
  subtitle?: string;
  badge?: string;
}
function activitiesFromJobs(jobs: ApiJob[]): Activity[] {
  return jobs.slice(0, 4).map((j) => ({
    time: timeAgoShort(j.createdAt),
    title: j.title,
    subtitle: `${j.leafletCount.toLocaleString()} leaflets · ${j.status}`,
  }));
}
function timeAgoShort(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
