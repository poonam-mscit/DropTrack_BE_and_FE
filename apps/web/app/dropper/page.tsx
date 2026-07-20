'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface AssignmentRow {
  assignment: {
    id: string;
    jobId: string;
    status: 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
    dropsCompleted: number;
    targetLeaflets: number | null;
    startedAt: string | null;
  };
  job: {
    id: string;
    code: string;
    title: string;
    startDate: string | null;
    deadline: string | null;
    status: string;
    leafletCount?: number;
  };
  subZone: { id: string; label: string; targetLeaflets: number } | null;
}

function targetOf(r: AssignmentRow): number {
  return (
    r.assignment.targetLeaflets ??
    r.subZone?.targetLeaflets ??
    r.job.leafletCount ??
    0
  );
}
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DropperDashboard() {
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<AssignmentRow[] | { data?: AssignmentRow[] }>(
        '/api/me/assignments',
      );
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setRows(list);
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayIso();
  const buckets = useMemo(() => {
    const overdue: AssignmentRow[] = [];
    const inProgress: AssignmentRow[] = [];
    const todayList: AssignmentRow[] = [];
    const upcoming: AssignmentRow[] = [];
    for (const r of rows ?? []) {
      const st = r.assignment.status;
      if (st === 'completed' || st === 'abandoned') continue;
      if (st === 'started' || st === 'paused') {
        inProgress.push(r);
        continue;
      }
      // pending
      const start = r.job.startDate;
      const deadline = r.job.deadline ?? r.job.startDate;
      if (deadline && deadline < today) overdue.push(r);
      else if (start && start <= today) todayList.push(r);
      else upcoming.push(r);
    }
    return { overdue, inProgress, todayList, upcoming };
  }, [rows, today]);

  const totalPending =
    buckets.overdue.length +
    buckets.inProgress.length +
    buckets.todayList.length +
    buckets.upcoming.length;

  return (
    <div className="pb-6">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Your jobs</h1>
          <p className="text-white/60 text-sm mt-0.5">
            {rows === null
              ? 'Loading…'
              : `${totalPending} to do · ${buckets.overdue.length} overdue`}
          </p>
        </div>
        <button
          onClick={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          className="text-white/60 hover:text-white p-2"
          aria-label="Refresh"
        >
          {refreshing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <RefreshCw size={18} />
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-200">
          {error}
        </div>
      )}

      {rows === null && (
        <div className="py-16 text-center text-white/40 text-sm">
          <Loader2 size={20} className="inline animate-spin mr-2" /> Loading assignments…
        </div>
      )}

      {rows && totalPending === 0 && (
        <div className="mt-6 py-12 rounded-2xl bg-white/5 border border-white/10 text-center">
          <p className="text-white/70 font-semibold">Nothing on your plate</p>
          <p className="text-white/40 text-sm mt-1 px-6">
            When an admin assigns you a drop, it'll show up here. Your completed jobs live under{' '}
            <Link href="/dropper/jobs" className="text-emerald-300 underline">
              All jobs
            </Link>
            .
          </p>
        </div>
      )}

      <Section title="Overdue" tint="red" rows={buckets.overdue} />
      <Section title="In progress" tint="emerald" rows={buckets.inProgress} />
      <Section title="Today" tint="white" rows={buckets.todayList} />
      <Section title="Upcoming" tint="white" rows={buckets.upcoming} />

      {rows && totalPending > 0 && (
        <div className="mt-6 text-center">
          <Link href="/dropper/jobs" className="text-xs text-white/50 hover:text-white/80">
            See all jobs (including completed) →
          </Link>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  tint,
  rows,
}: {
  title: string;
  tint: 'red' | 'emerald' | 'white';
  rows: AssignmentRow[];
}) {
  if (rows.length === 0) return null;
  const tintColor =
    tint === 'red'
      ? 'text-red-300'
      : tint === 'emerald'
        ? 'text-emerald-300'
        : 'text-white/50';
  return (
    <section className="mt-4">
      <h2
        className={`text-[11px] font-bold uppercase tracking-[.14em] mb-2 ${tintColor}`}
      >
        {title} ({rows.length})
      </h2>
      <ul className="space-y-2">
        {rows.map((r) => (
          <JobCard key={r.assignment.id} row={r} />
        ))}
      </ul>
    </section>
  );
}

function JobCard({ row }: { row: AssignmentRow }) {
  const target = targetOf(row);
  const done = row.assignment.dropsCompleted;
  const pct = target > 0 ? Math.round((done / target) * 100) : 0;
  const isCompleted = row.assignment.status === 'completed';
  const href = isCompleted
    ? `/dropper/recap/${row.assignment.id}`
    : `/dropper/jobs/${row.assignment.id}`;

  const statusLabel =
    row.assignment.status === 'started'
      ? 'Live'
      : row.assignment.status === 'paused'
        ? 'Paused'
        : row.assignment.status === 'completed'
          ? '✓ Done'
          : row.assignment.status === 'abandoned'
            ? 'Cancelled'
            : row.job.startDate;

  return (
    <li>
      <Link
        href={href}
        className="block p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[15px] leading-snug truncate">
              {row.job.title}
            </p>
            <p className="text-xs text-white/50 mt-1">
              {row.job.code} · {row.subZone?.label ?? 'Whole zone'}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-white/60">
              <MapPin size={12} />
              {done} / {target} drops
              {statusLabel && (
                <span
                  className={`ml-2 ${
                    isCompleted
                      ? 'text-emerald-300'
                      : row.assignment.status === 'started'
                        ? 'text-amber-300'
                        : ''
                  }`}
                >
                  · {statusLabel}
                </span>
              )}
            </div>
            {!isCompleted && target > 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
          <ChevronRight size={18} className="text-white/40 mt-1" />
        </div>
      </Link>
    </li>
  );
}
