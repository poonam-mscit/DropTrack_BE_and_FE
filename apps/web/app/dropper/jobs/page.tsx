'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Loader2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface AssignmentRow {
  assignment: {
    id: string;
    jobId: string;
    status: 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
    dropsCompleted: number;
    targetLeaflets: number | null;
    startedAt: string | null;
    completedAt: string | null;
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

type FilterKey = 'all' | 'active' | 'upcoming' | 'completed';
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
];

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

export default function DropperAllJobs() {
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
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
  const filtered = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) => {
      const st = r.assignment.status;
      if (filter === 'all') return true;
      if (filter === 'active') return st === 'started' || st === 'paused';
      if (filter === 'completed') return st === 'completed' || st === 'abandoned';
      if (filter === 'upcoming') return st === 'pending' && (!r.job.startDate || r.job.startDate >= today);
      return true;
    });
  }, [rows, filter, today]);

  const counts = useMemo(() => {
    if (!rows) return { all: 0, active: 0, upcoming: 0, completed: 0 };
    return {
      all: rows.length,
      active: rows.filter((r) => r.assignment.status === 'started' || r.assignment.status === 'paused').length,
      upcoming: rows.filter((r) => r.assignment.status === 'pending' && (!r.job.startDate || r.job.startDate >= today)).length,
      completed: rows.filter((r) => r.assignment.status === 'completed' || r.assignment.status === 'abandoned').length,
    };
  }, [rows, today]);

  return (
    <div className="pb-6">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight">All jobs</h1>
        <p className="text-white/60 text-sm mt-0.5">
          Every job you've been assigned — past, present, and upcoming.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-3 sticky top-14 z-20 bg-[#0F1029]/95 backdrop-blur">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? 'bg-white text-slate-900 border-white'
                  : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 tabular-nums ${active ? 'text-slate-500' : 'text-white/40'}`}>
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-200">
          {error}
        </div>
      )}

      {filtered === null && (
        <div className="py-16 text-center text-white/40 text-sm">
          <Loader2 size={20} className="inline animate-spin mr-2" /> Loading…
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <div className="mt-6 py-12 rounded-2xl bg-white/5 border border-white/10 text-center">
          <p className="text-white/70 font-semibold">
            No {filter === 'all' ? 'jobs' : filter} to show
          </p>
        </div>
      )}

      {filtered && filtered.length > 0 && (
        <ul className="space-y-2 mt-2">
          {filtered.map((r) => (
            <JobRow key={r.assignment.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function JobRow({ row }: { row: AssignmentRow }) {
  const target = targetOf(row);
  const done = row.assignment.dropsCompleted;
  const pct = target > 0 ? Math.round((done / target) * 100) : 0;
  const isCompleted = row.assignment.status === 'completed';
  const href = isCompleted
    ? `/dropper/recap/${row.assignment.id}`
    : `/dropper/jobs/${row.assignment.id}`;

  const pill = (() => {
    const s = row.assignment.status;
    if (s === 'started') return { text: 'Live', cls: 'bg-amber-400/15 text-amber-200 border-amber-400/30' };
    if (s === 'paused') return { text: 'Paused', cls: 'bg-white/10 text-white/70 border-white/20' };
    if (s === 'completed') return { text: '✓ Done', cls: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30' };
    if (s === 'abandoned') return { text: 'Cancelled', cls: 'bg-red-500/10 text-red-200 border-red-500/30' };
    return { text: 'Pending', cls: 'bg-white/5 text-white/60 border-white/15' };
  })();

  return (
    <li>
      <Link
        href={href}
        className="block p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${pill.cls}`}
              >
                {pill.text}
              </span>
              <span className="text-[11px] text-white/40 truncate">{row.job.code}</span>
            </div>
            <p className="font-semibold text-[15px] leading-snug truncate">{row.job.title}</p>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-white/60">
              <MapPin size={12} />
              {done} / {target} drops
              {row.job.startDate && !isCompleted && (
                <span className="ml-1.5 text-white/40">· starts {row.job.startDate}</span>
              )}
              {isCompleted && row.assignment.completedAt && (
                <span className="ml-1.5 text-white/40">
                  · {new Date(row.assignment.completedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
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
