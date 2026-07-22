'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Play } from 'lucide-react';
import { api } from '@/lib/api';

interface DetailRow {
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
    startDate?: string | null;
    deadline?: string | null;
    campaignType?: string | null;
    leafletCount?: number;
    specialInstructions?: string | null;
    skipNoJunkMail?: boolean;
    skipApartments?: boolean;
  };
  subZone: { id: string; label: string; targetLeaflets: number } | null;
}

export default function DropperJobDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<DetailRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get<DetailRow>(`/api/me/assignments/${id}`)
      .then(setRow)
      .catch((e) => setError((e as Error).message));
  }, [id]);

  async function startJob() {
    if (!row) return;
    setBusy(true);
    try {
      await api.post(`/api/me/assignments/${row.assignment.id}/start`, {});
      router.push(`/dropper/active/${row.assignment.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-sm text-red-300 mt-4">{error}</p>;
  if (!row) return <div className="py-10 text-center text-white/40 text-sm"><Loader2 size={18} className="inline animate-spin mr-2" /> Loading…</div>;

  const target =
    row.assignment.targetLeaflets ??
    row.subZone?.targetLeaflets ??
    row.job.leafletCount ??
    0;
  const isActive = row.assignment.status === 'started' || row.assignment.status === 'paused';

  return (
    <div>
      <Link href="/dropper" className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white mb-4">
        <ArrowLeft size={14} /> All jobs
      </Link>

      <h1 className="text-2xl font-extrabold tracking-tight">{row.job.title}</h1>
      <p className="text-white/50 text-sm mt-1">
        {row.job.code} · {row.subZone?.label ?? 'Whole zone'}
      </p>

      <section className="mt-5 rounded-2xl bg-white/5 border border-white/10 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-white/50">Target</p>
        <p className="text-3xl font-extrabold mt-1">{target.toLocaleString()} <span className="text-base font-semibold text-white/60">drops</span></p>
        <p className="text-xs text-white/50 mt-1">{row.assignment.dropsCompleted} done so far</p>
      </section>

      <section className="mt-4 rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/10">
        <Row label="Campaign" value={row.job.campaignType?.replace(/_/g, ' ') ?? '—'} />
        <Row label="Start" value={row.job.startDate ?? '—'} />
        <Row label="Deadline" value={row.job.deadline ?? '—'} />
        <Row label="Skip 'No junk mail'" value={row.job.skipNoJunkMail ? 'Yes' : 'No'} />
        <Row label="Skip apartments" value={row.job.skipApartments ? 'Yes' : 'No'} />
      </section>

      {row.job.specialInstructions && (
        <section className="mt-4 p-4 rounded-2xl bg-amber-400/10 border border-amber-400/20">
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-amber-300 mb-1">
            Special instructions
          </p>
          <p className="text-sm text-white/85 leading-relaxed">{row.job.specialInstructions}</p>
        </section>
      )}

      {(() => {
        const st = row.assignment.status;
        if (st === 'completed') {
          return (
            <div className="mt-6 rounded-2xl bg-emerald-400/10 border border-emerald-400/30 p-4 text-center">
              <p className="text-sm font-semibold text-emerald-200">✓ Drop completed</p>
              <Link
                href={`/dropper/recap/${row.assignment.id}`}
                className="inline-block mt-3 text-xs font-semibold text-emerald-300 hover:text-emerald-200 underline"
              >
                View recap →
              </Link>
            </div>
          );
        }
        if (st === 'abandoned') {
          return (
            <div className="mt-6 rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-center">
              <p className="text-sm font-semibold text-red-200">This campaign was cancelled</p>
              <p className="text-xs text-red-200/80 mt-2 leading-relaxed">
                The client cancelled the job. Any drops you already made were recorded — you don't
                need to do anything else.
              </p>
              <Link
                href="/dropper"
                className="inline-block mt-3 text-xs font-semibold text-white/80 hover:text-white underline"
              >
                Back to your jobs →
              </Link>
            </div>
          );
        }
        if (isActive) {
          return (
            <Link
              href={`/dropper/active/${row.assignment.id}`}
              className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 text-emerald-950 font-bold py-4 active:bg-emerald-500"
            >
              <Play size={16} /> Resume drop
            </Link>
          );
        }
        return (
          <button
            onClick={startJob}
            disabled={busy}
            className="mt-6 w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 text-emerald-950 font-bold py-4 active:bg-emerald-500 disabled:opacity-40"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Start drop
          </button>
        );
      })()}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <span className="text-white/60 text-sm">{label}</span>
      <span className="text-sm font-semibold capitalize">{value}</span>
    </div>
  );
}
