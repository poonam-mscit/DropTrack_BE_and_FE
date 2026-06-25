'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, UserCheck, X } from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { getSession } from '@/lib/auth';
import { api, type ApiJob } from '@/lib/api';

interface Dropper {
  userId: string;
  email: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  primaryZone: string | null;
  onboardingStatus: 'partial' | 'complete';
  ratingAvg: string | null;
  jobsDone: number;
  activeAssignments: number;
}

interface DraftAssignment {
  dropperUserId: string;
  targetLeaflets: number;
  label: string;
}

export default function AssignWorkspace() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const jobId = params?.id;

  const [job, setJob] = useState<ApiJob | null>(null);
  const [droppers, setDroppers] = useState<Dropper[] | null>(null);
  const [drafts, setDrafts] = useState<DraftAssignment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) return router.replace('/login');
    if (s.role !== 'admin') return router.replace('/dashboard');
    if (!jobId) return;
    Promise.all([
      api.get<{ data: ApiJob }>(`/api/jobs/${jobId}`),
      api.get<{ data: Dropper[] }>('/api/droppers'),
    ])
      .then(([j, d]) => {
        setJob(j.data);
        setDroppers(d.data);
      })
      .catch((err) => setError(err.message ?? 'Failed to load'));
  }, [jobId, router]);

  function toggle(d: Dropper) {
    setDrafts((prev) => {
      const i = prev.findIndex((x) => x.dropperUserId === d.userId);
      if (i >= 0) return prev.filter((_, idx) => idx !== i);
      const remaining = job ? Math.max(0, job.leafletCount - prev.reduce((s, x) => s + x.targetLeaflets, 0)) : 0;
      const split = prev.length === 0 && job ? job.leafletCount : Math.floor(remaining / 2) || remaining;
      const label = ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'Zone F'][prev.length] ?? `Zone ${prev.length + 1}`;
      return [...prev, { dropperUserId: d.userId, targetLeaflets: split, label }];
    });
  }

  function updateTarget(uid: string, value: number) {
    setDrafts((prev) => prev.map((d) => (d.dropperUserId === uid ? { ...d, targetLeaflets: value } : d)));
  }

  async function confirm() {
    if (!job || drafts.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/jobs/${job.id}/assignments`, { assignments: drafts });
      setDone(true);
      setTimeout(() => router.push('/admin/queue'), 1200);
    } catch (err) {
      const msg = (err as { body?: { message?: unknown } }).body?.message;
      setError(typeof msg === 'string' ? msg : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const totalAssigned = drafts.reduce((s, d) => s + d.targetLeaflets, 0);
  const remaining = job ? job.leafletCount - totalAssigned : 0;
  const recommended =
    droppers
      ?.filter((d) => d.onboardingStatus === 'complete')
      .slice(0, 2)
      .map((d) => d.userId) ?? [];

  return (
    <div>
      <AdminSidebar active="queue" />
      <main className="ml-[252px] p-10 max-w-[1100px]">
        <a href="/admin/queue" className="text-text-muted text-xs inline-flex items-center gap-1.5 mb-2">
          <ArrowLeft size={12} /> Back to queue
        </a>

        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {job ? (
                <>
                  Assign · {job.title}{' '}
                  <span className="font-serif italic font-normal text-text-secondary">
                    — pick droppers.
                  </span>
                </>
              ) : (
                'Loading…'
              )}
            </h1>
            {job && (
              <p className="text-text-muted text-sm mt-1.5">
                {job.jobCode} · {job.leafletCount.toLocaleString()} leaflets · starts{' '}
                {job.startDate ?? '—'}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <a href="/admin/queue" className="btn-ghost"><X size={14} /> Defer</a>
            <button
              onClick={confirm}
              disabled={submitting || done || drafts.length === 0}
              className="btn-primary disabled:opacity-50"
            >
              {done
                ? 'Assigned ✓'
                : submitting
                  ? 'Saving…'
                  : `Confirm assignment${drafts.length ? ` (${drafts.length})` : ''}`}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        <div className="grid gap-5" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
          <div>
            <div
              className="rounded-2xl p-5 mb-4 flex items-center gap-3"
              style={{
                background:
                  'linear-gradient(135deg, rgba(79,70,229,.06) 0%, rgba(124,58,237,.04) 50%, rgba(163,230,53,.08) 100%)',
                border: '1px solid rgba(124,58,237,.18)',
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED 50%,#A3E635)' }}
              >
                <Sparkles size={18} />
              </div>
              <div className="flex-1 text-sm">
                <strong>AI Dropper Match.</strong>
                <span className="text-text-secondary"> Top candidates surfaced by past suburb fit + rating + current load.</span>
              </div>
            </div>

            <h3 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-2 px-1">
              Droppers ({droppers?.length ?? 0} available)
            </h3>

            {!droppers && <div className="text-text-muted text-sm">Loading…</div>}

            <div className="space-y-2">
              {droppers?.map((d) => {
                const isPicked = drafts.some((x) => x.dropperUserId === d.userId);
                const isRec = recommended.includes(d.userId);
                const incomplete = d.onboardingStatus !== 'complete';
                return (
                  <button
                    key={d.userId}
                    onClick={() => !incomplete && toggle(d)}
                    disabled={incomplete}
                    className={`w-full text-left card p-4 flex items-center gap-3.5 transition-all ${
                      isPicked
                        ? 'border-primary bg-primary-50/30 shadow-md'
                        : incomplete
                          ? 'opacity-60 cursor-not-allowed'
                          : 'hover:border-primary/30'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold shrink-0 ${isPicked ? 'ring-4 ring-primary/20' : ''}`}
                      style={{
                        background: isPicked
                          ? 'linear-gradient(135deg,#4F46E5,#7C3AED 50%,#A3E635)'
                          : 'linear-gradient(135deg,#52525B,#18181B)',
                      }}
                    >
                      {d.firstName[0]}
                      {d.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {d.firstName} {d.lastName}
                        {isRec && (
                          <span
                            className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded text-white"
                            style={{ background: 'linear-gradient(135deg,#4F46E5,#A3E635)' }}
                          >
                            AI Match
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {d.employeeId} · {d.primaryZone ?? 'no zone'} · ★ {d.ratingAvg ?? '—'} · {d.jobsDone} jobs
                      </div>
                      {incomplete && (
                        <div className="text-[11px] text-warning font-semibold mt-1">
                          Onboarding incomplete — cannot assign
                        </div>
                      )}
                    </div>
                    {isPicked && <UserCheck size={20} className="text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          <aside>
            <div className="card p-5 sticky top-6">
              <h3 className="font-semibold mb-4">Assignment summary</h3>

              {!job ? (
                <div className="text-text-muted text-sm">Loading…</div>
              ) : drafts.length === 0 ? (
                <p className="text-text-muted text-sm">
                  Pick one or more droppers on the left. Each gets a target slice of the{' '}
                  <strong>{job.leafletCount.toLocaleString()}</strong> leaflets.
                </p>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {drafts.map((d) => {
                      const dropper = droppers?.find((x) => x.userId === d.dropperUserId);
                      return (
                        <div
                          key={d.dropperUserId}
                          className="p-3 border border-border rounded-xl bg-bg-muted/40 flex items-center gap-3"
                        >
                          <div
                            className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
                          >
                            {dropper?.firstName[0]}
                            {dropper?.lastName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold truncate">
                              {dropper?.firstName} {dropper?.lastName}
                            </div>
                            <div className="text-[11px] text-text-muted">{d.label}</div>
                          </div>
                          <input
                            type="number"
                            className="input w-24 text-right tabular-nums"
                            value={d.targetLeaflets}
                            onChange={(e) => updateTarget(d.dropperUserId, Number(e.target.value))}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-border pt-3.5 text-sm">
                    <SummaryRow label="Target total" value={totalAssigned.toLocaleString()} />
                    <SummaryRow label="Job leaflets" value={job.leafletCount.toLocaleString()} />
                    <SummaryRow
                      label="Remaining"
                      value={remaining.toLocaleString()}
                      warn={remaining < 0}
                      ok={remaining === 0}
                    />
                  </div>

                  {remaining < 0 && (
                    <div className="mt-3 text-xs text-danger">
                      Targets exceed the job leaflet count by {Math.abs(remaining).toLocaleString()}.
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  warn,
  ok,
}: {
  label: string;
  value: string;
  warn?: boolean;
  ok?: boolean;
}) {
  const color = warn ? 'text-danger' : ok ? 'text-success' : '';
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-text-muted">{label}</span>
      <strong className={`tabular-nums ${color}`}>{value}</strong>
    </div>
  );
}
