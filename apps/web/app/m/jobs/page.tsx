'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut } from 'lucide-react';
import { api } from '@/lib/api';
import { clearSession, getSession } from '@/lib/auth';

interface Assignment {
  assignment: {
    id: string;
    status: 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
    dropsCompleted: number;
    distanceWalkedM: number;
    startedAt: string | null;
    completedAt: string | null;
  };
  job: { id: string; code: string; title: string; startDate: string | null; status: string };
  subZone: { label: string; targetLeaflets: number } | null;
}

export default function MobileJobs() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSessionState] = useState<ReturnType<typeof getSession>>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) return router.replace('/login');
    if (s.role !== 'dropper') {
      // Friendly hint: sign in as a dropper to use this view.
      router.replace('/login?as=dropper');
      return;
    }
    setSessionState(s);
    api
      .get<Assignment[]>('/api/me/assignments')
      .then(setAssignments)
      .catch((err) => setError(err.message ?? 'Failed to load'));
  }, [router]);

  function signOut() {
    clearSession();
    router.push('/login');
  }

  const initials = session?.email.slice(0, 2).toUpperCase() ?? '··';
  const active = assignments?.find(
    (a) => a.assignment.status === 'started' || a.assignment.status === 'paused',
  );
  const queued = assignments?.filter((a) => a.assignment.status === 'pending') ?? [];
  const done = assignments?.filter((a) => a.assignment.status === 'completed') ?? [];

  return (
    <PhoneFrame>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] text-white/55">Good morning</div>
          <strong className="text-xl">{session?.email.split('@')[0]}</strong>
        </div>
        <button
          onClick={signOut}
          className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#4F46E5,#A3E635)' }}
          title="Sign out"
        >
          {initials}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-3 text-xs text-red-300 bg-red-500/10 border border-red-500/20 mb-4">
          {error}
        </div>
      )}

      {!assignments && !error && <div className="text-white/55 text-sm">Loading…</div>}

      {assignments && assignments.length === 0 && (
        <div className="text-center py-12 text-white/55">
          <div className="text-base">No jobs yet.</div>
          <div className="text-xs mt-2">Admin will assign you a route when one&rsquo;s ready.</div>
        </div>
      )}

      {active && (
        <>
          <Heading>Today · in progress</Heading>
          <JobCard a={active} highlight onClick={() => router.push(`/m/active/${active.assignment.id}`)} />
        </>
      )}

      {queued.length > 0 && (
        <>
          <Heading>Up next</Heading>
          {queued.map((a) => (
            <JobCard key={a.assignment.id} a={a} onClick={() => router.push(`/m/active/${a.assignment.id}`)} />
          ))}
        </>
      )}

      {done.length > 0 && (
        <>
          <Heading>Recently completed</Heading>
          {done.map((a) => (
            <JobCard key={a.assignment.id} a={a} muted />
          ))}
        </>
      )}

      <button
        onClick={signOut}
        className="w-full mt-8 py-3 text-white/45 hover:text-white text-xs inline-flex items-center justify-center gap-2"
      >
        <LogOut size={12} /> Sign out
      </button>
    </PhoneFrame>
  );
}

function JobCard({
  a,
  onClick,
  highlight,
  muted,
}: {
  a: Assignment;
  onClick?: () => void;
  highlight?: boolean;
  muted?: boolean;
}) {
  const target = a.subZone?.targetLeaflets ?? 0;
  const progress = target > 0 ? Math.min(100, Math.round((a.assignment.dropsCompleted / target) * 100)) : 0;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left rounded-2xl p-4 mb-2.5 transition-all ${
        highlight
          ? 'border-2 border-accent bg-accent/[.05]'
          : muted
            ? 'border border-white/[.08] bg-white/[.02] opacity-70'
            : 'border border-white/[.08] bg-white/[.04] hover:bg-white/[.06]'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <StatusTag status={a.assignment.status} />
          <div className="font-semibold mt-1.5">{a.job.title}</div>
          <div className="text-[12px] text-white/55 mt-0.5">{a.job.code} · {a.subZone?.label ?? 'whole zone'}</div>
        </div>
        {onClick && <ChevronRight size={18} className="text-white/40 mt-1" />}
      </div>

      {target > 0 && (
        <>
          <div className="text-[11px] text-white/55 mb-1">
            <span className="font-semibold text-white">{a.assignment.dropsCompleted.toLocaleString()}</span> /{' '}
            {target.toLocaleString()} drops
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}
    </button>
  );
}

function StatusTag({ status }: { status: Assignment['assignment']['status'] }) {
  const map = {
    pending: { bg: 'rgba(255,255,255,.08)', fg: 'rgba(255,255,255,.6)', label: 'Pending' },
    started: { bg: '#A3E63522', fg: '#BEF264', label: 'IN PROGRESS' },
    paused: { bg: '#F59E0B22', fg: '#FCD34D', label: 'PAUSED' },
    completed: { bg: '#10B98122', fg: '#6EE7B7', label: 'DONE' },
    abandoned: { bg: '#EF444422', fg: '#FCA5A5', label: 'ABANDONED' },
  } as const;
  const m = map[status];
  return (
    <span
      className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
      style={{ background: m.bg, color: m.fg }}
    >
      {m.label}
    </span>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold tracking-[.14em] uppercase text-white/45 mt-5 mb-2 px-1">
      {children}
    </h3>
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
