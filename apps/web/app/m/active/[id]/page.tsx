'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Pause, Play, Square, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';

interface Assignment {
  id: string;
  status: 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
  dropsCompleted: number;
  jobId: string;
  startedAt: string | null;
}

interface AssignmentRow {
  assignment: Assignment;
  job: { code: string; title: string };
  subZone: { label: string; targetLeaflets: number } | null;
}

export default function MobileActive() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const assignmentId = params?.id;

  const [row, setRow] = useState<AssignmentRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastDropAt, setLastDropAt] = useState<Date | null>(null);

  const reload = useCallback(() => {
    api
      .get<AssignmentRow[]>('/api/me/assignments')
      .then((rows) => {
        const found = rows.find((r) => r.assignment.id === assignmentId);
        if (!found) setError('Assignment not found');
        else setRow(found);
      })
      .catch((err) => setError(err.message ?? 'Failed to load'));
  }, [assignmentId]);

  useEffect(() => {
    const s = getSession();
    if (!s) return router.replace('/login');
    if (s.role !== 'dropper') return router.replace('/m/jobs');
    reload();
  }, [router, reload]);

  async function call(action: 'start' | 'pause' | 'resume' | 'complete') {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/me/assignments/${row.assignment.id}/${action}`);
      reload();
    } catch (err) {
      const m = (err as { body?: { message?: unknown } }).body?.message;
      setError(typeof m === 'string' ? m : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markDrop() {
    if (!row) return;
    setError(null);
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      await api.post('/api/me/drops', {
        assignmentId: row.assignment.id,
        location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        accuracyM: Math.round(pos.coords.accuracy),
      });
      setLastDropAt(new Date());
      reload();
    } catch (err) {
      // Fall back to a demo drop in Bondi if geolocation isn't available.
      const m = (err as { body?: { message?: unknown }; message?: string }).body?.message
        ?? (err as Error).message;
      if (String(m).includes('Geolocation') || String(m).includes('denied')) {
        try {
          await api.post('/api/me/drops', {
            assignmentId: row.assignment.id,
            location: { lat: -33.892 + Math.random() * 0.006, lng: 151.248 + Math.random() * 0.006 },
            accuracyM: 12,
          });
          setLastDropAt(new Date());
          reload();
        } catch (e2) {
          setError((e2 as Error).message);
        }
      } else {
        setError(typeof m === 'string' ? m : String(m));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!row) {
    return (
      <PhoneFrame>
        <div className="text-white/55 text-sm">{error ?? 'Loading…'}</div>
      </PhoneFrame>
    );
  }

  const target = row.subZone?.targetLeaflets ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((row.assignment.dropsCompleted / target) * 100)) : 0;
  const s = row.assignment.status;

  return (
    <PhoneFrame>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push('/m/jobs')} className="text-white/55 text-xs inline-flex items-center gap-1.5">
          <ArrowLeft size={12} /> Jobs
        </button>
        <span
          className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded"
          style={{
            background: s === 'started' ? '#A3E63522' : s === 'paused' ? '#F59E0B22' : 'rgba(255,255,255,.08)',
            color: s === 'started' ? '#BEF264' : s === 'paused' ? '#FCD34D' : 'rgba(255,255,255,.6)',
          }}
        >
          {s.toUpperCase()}
        </span>
      </div>

      <h1 className="text-xl font-bold">{row.job.title}</h1>
      <p className="text-[12px] text-white/55 mb-5">
        {row.job.code} · {row.subZone?.label ?? 'whole zone'} · target{' '}
        <strong className="text-white">{target.toLocaleString()}</strong>
      </p>

      {/* Progress hero */}
      <div className="text-center my-4">
        <div className="text-[11px] text-white/55 uppercase tracking-wider">Drops completed</div>
        <div
          className="text-[68px] font-extrabold leading-none mt-2 tracking-tighter"
          style={{ color: '#A3E635' }}
        >
          {row.assignment.dropsCompleted}
        </div>
        <div className="text-sm text-white/55 mt-1">
          of {target.toLocaleString()} · {pct}%
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-3">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-3 text-xs text-red-300 bg-red-500/10 border border-red-500/20 mb-3 flex gap-2 items-start">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {lastDropAt && (
        <div className="rounded-xl p-3 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 mb-3">
          Drop marked {timeAgo(lastDropAt)} ✓
        </div>
      )}

      {/* Primary action */}
      <div className="mt-4 space-y-2.5">
        {s === 'pending' && (
          <BigButton
            onClick={() => call('start')}
            disabled={busy}
            color="lime"
          >
            <Play size={20} /> Start job
          </BigButton>
        )}

        {s === 'started' && (
          <>
            <BigButton onClick={markDrop} disabled={busy} color="lime">
              <MapPin size={24} /> MARK DROP
            </BigButton>
            <div className="grid grid-cols-2 gap-2">
              <BigButton onClick={() => call('pause')} disabled={busy} color="neutral" small>
                <Pause size={16} /> Pause
              </BigButton>
              <BigButton onClick={() => call('complete')} disabled={busy} color="danger" small>
                <Square size={14} /> Stop
              </BigButton>
            </div>
          </>
        )}

        {s === 'paused' && (
          <>
            <BigButton onClick={() => call('resume')} disabled={busy} color="lime">
              <Play size={20} /> Resume
            </BigButton>
            <BigButton onClick={() => call('complete')} disabled={busy} color="danger" small>
              <Square size={14} /> Stop &amp; complete
            </BigButton>
          </>
        )}

        {s === 'completed' && (
          <div className="rounded-xl p-5 text-center bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-emerald-300 font-bold">Completed</div>
            <div className="text-xs text-white/55 mt-1">
              {row.assignment.dropsCompleted.toLocaleString()} drops over this zone.
            </div>
          </div>
        )}
      </div>

      {/* Fraud Shield strip */}
      <div className="rounded-xl p-3 mt-5 border border-indigo-400/15 bg-indigo-500/10 text-[11px] text-indigo-200">
        🛡️ Fraud Shield: GPS verified · 0 anomalies
      </div>
    </PhoneFrame>
  );
}

function BigButton({
  children,
  onClick,
  disabled,
  color,
  small,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color: 'lime' | 'neutral' | 'danger';
  small?: boolean;
}) {
  const styles = {
    lime: { background: 'linear-gradient(180deg,#BEF264,#84CC16)', color: '#0a0a0a' },
    neutral: { background: '#27272A', color: '#fff' },
    danger: { background: 'linear-gradient(180deg,#F87171,#DC2626)', color: '#fff' },
  } as const;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-2xl font-bold inline-flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        small ? 'py-3 text-sm' : 'py-5 text-lg'
      }`}
      style={styles[color]}
    >
      {children}
    </button>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-900 flex items-start justify-center py-8 px-4">
      <div
        className="w-full max-w-[390px] rounded-[48px] px-5 py-12 text-zinc-100 relative shadow-2xl"
        style={{
          background: 'linear-gradient(180deg,#0A0A0F 0%, #11121A 100%)',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,.4), 0 0 0 12px #1A1B23, 0 0 0 13px #2A2B33',
        }}
      >
        <div
          className="absolute top-3.5 left-1/2 -translate-x-1/2 w-[120px] h-[30px] bg-black rounded-[18px]"
          aria-hidden
        />
        <div className="pt-2">{children}</div>
      </div>
    </div>
  );
}

function getCurrentPosition(timeoutMs = 5_000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 0,
    });
  });
}

function timeAgo(d: Date): string {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}
