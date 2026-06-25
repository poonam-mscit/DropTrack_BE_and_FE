'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarPlus, FileDown, Radio, ShieldAlert, Sparkles, TrendingUp, X } from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { LiveMap, type MapDrop } from '@/components/LiveMap';
import { api, type ApiJob } from '@/lib/api';
import { getSession } from '@/lib/auth';
import {
  getSocket,
  type RealtimeAssignment,
  type RealtimeDrop,
  type RealtimeFraudAlert,
  type RealtimeJob,
} from '@/lib/socket';

interface JobMap {
  zone: { polygon: GeoJSON.Polygon; areaSqm: number; estimatedLetterboxes: number | null } | null;
  drops: MapDrop[];
}

interface AssignmentRow {
  assignment: {
    id: string;
    status: 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
    dropsCompleted: number;
    dropperUserId: string;
  };
  dropper: { id: string; email: string };
  subZone: { label: string; targetLeaflets: number } | null;
}

interface FeedEntry {
  id: string;
  kind: 'drop' | 'status' | 'job' | 'fraud';
  ts: string;
  text: string;
  detail?: string;
  ok?: boolean;
  severity?: 'low' | 'medium' | 'high';
}

export default function AdminLiveTrack() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const jobId = params?.id;

  const [job, setJob] = useState<ApiJob | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[] | null>(null);
  const [connected, setConnected] = useState(false);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [report, setReport] = useState<AiReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [mapData, setMapData] = useState<JobMap | null>(null);
  const [newestDropId, setNewestDropId] = useState<string | null>(null);
  const [fraudBanner, setFraudBanner] = useState<RealtimeFraudAlert | null>(null);
  const [rerun, setRerun] = useState<RerunRecommendation | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Fetch report whenever job is completed (initial + on live status flip).
  const tryFetchReport = (jId: string) => {
    setReportLoading(true);
    // The report is generated async on job completion — poll a few times.
    let tries = 0;
    const tick = () => {
      tries += 1;
      api
        .get<AiReport>(`/api/jobs/${jId}/report`)
        .then((r) => {
          setReport(r);
          setReportLoading(false);
        })
        .catch(() => {
          if (tries < 6) setTimeout(tick, 1500);
          else setReportLoading(false);
        });
    };
    tick();
    // Re-run recommendation lands a beat later — fetch alongside.
    api
      .get<RerunRecommendation>(`/api/ai/jobs/${jId}/rerun-recommendation`)
      .then(setRerun)
      .catch(() => {/* recommendation is nice-to-have */});
  };

  // Initial fetch
  useEffect(() => {
    const s = getSession();
    if (!s) return router.replace('/login');
    if (s.role !== 'admin') return router.replace('/dashboard');
    if (!jobId) return;
    Promise.all([
      api.get<{ data: ApiJob }>(`/api/jobs/${jobId}`),
      api.get<AssignmentRow[]>(`/api/jobs/${jobId}/assignments`),
      api.get<JobMap>(`/api/jobs/${jobId}/map`),
    ])
      .then(([j, a, m]) => {
        setJob(j.data);
        setAssignments(a);
        setMapData(m);
        if (j.data.status === 'completed') tryFetchReport(jobId);
      })
      .catch(console.error);
  }, [jobId, router]);

  // Socket.IO subscribe
  useEffect(() => {
    if (!jobId) return;
    const sock = getSocket();

    const onConnect = () => {
      setConnected(true);
      sock.emit('join:job', jobId);
    };
    const onDisconnect = () => setConnected(false);
    const onDrop = (e: RealtimeDrop) => {
      if (e.jobId !== jobId) return;
      pushFeed({
        id: e.dropId,
        kind: 'drop',
        ts: e.markedAt,
        text: `Drop marked${e.insideZone ? '' : ' (outside zone!)'}`,
        detail: `${e.location.lat.toFixed(5)}, ${e.location.lng.toFixed(5)} · running ${e.dropsCompleted}`,
        ok: e.insideZone,
      });
      // Optimistically update assignment counter
      setAssignments((prev) =>
        prev?.map((r) =>
          r.assignment.id === e.assignmentId
            ? { ...r, assignment: { ...r.assignment, dropsCompleted: e.dropsCompleted } }
            : r,
        ) ?? prev,
      );
      // Append to the live map.
      setMapData((prev) =>
        prev
          ? {
              ...prev,
              drops: [
                ...prev.drops,
                {
                  id: e.dropId,
                  lat: e.location.lat,
                  lng: e.location.lng,
                  insideZone: e.insideZone,
                  dropperUserId: e.dropperUserId,
                },
              ],
            }
          : prev,
      );
      setNewestDropId(e.dropId);
      // Clear the "fresh" highlight after a moment.
      setTimeout(() => setNewestDropId((id) => (id === e.dropId ? null : id)), 2_500);
    };
    const onAsgnStatus = (e: RealtimeAssignment) => {
      if (e.jobId !== jobId) return;
      pushFeed({
        id: `${e.assignmentId}-${e.at}`,
        kind: 'status',
        ts: e.at,
        text: `Assignment → ${e.status}`,
        detail: e.assignmentId.slice(0, 8),
      });
      setAssignments((prev) =>
        prev?.map((r) =>
          r.assignment.id === e.assignmentId
            ? { ...r, assignment: { ...r.assignment, status: e.status } }
            : r,
        ) ?? prev,
      );
    };
    const onFraud = (e: RealtimeFraudAlert) => {
      if (e.jobId !== jobId) return;
      pushFeed({
        id: e.alertId,
        kind: 'fraud',
        ts: e.at,
        text: `Fraud Shield: ${formatAlertType(e.alertType)}`,
        detail: formatEvidence(e),
        severity: e.severity,
      });
      if (e.severity === 'high') {
        setFraudBanner(e);
      }
    };

    const onJobStatus = (e: RealtimeJob) => {
      if (e.jobId !== jobId) return;
      pushFeed({
        id: `job-${e.at}`,
        kind: 'job',
        ts: e.at,
        text: `Job → ${e.status}`,
      });
      setJob((prev) => (prev ? { ...prev, status: e.status as ApiJob['status'] } : prev));
      if (e.status === 'completed') tryFetchReport(jobId);
    };

    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);
    sock.on('drop.created', onDrop);
    sock.on('assignment.status', onAsgnStatus);
    sock.on('job.status', onJobStatus);
    sock.on('fraud.alert', onFraud);
    if (sock.connected) onConnect();

    return () => {
      sock.emit('leave:job', jobId);
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
      sock.off('drop.created', onDrop);
      sock.off('assignment.status', onAsgnStatus);
      sock.off('job.status', onJobStatus);
      sock.off('fraud.alert', onFraud);
    };
  }, [jobId]);

  function pushFeed(entry: FeedEntry) {
    setFeed((prev) => [entry, ...prev].slice(0, 50));
    // Brief flash effect — handled in render via the entry's age.
    requestAnimationFrame(() => feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  const totalDrops = assignments?.reduce((s, r) => s + r.assignment.dropsCompleted, 0) ?? 0;
  const targetTotal =
    assignments?.reduce((s, r) => s + (r.subZone?.targetLeaflets ?? 0), 0) ?? 0;
  const coveragePct = targetTotal > 0 ? Math.min(100, Math.round((totalDrops / targetTotal) * 100)) : 0;

  return (
    <div>
      <AdminSidebar active="jobs" />
      <main className="ml-[252px] p-10 max-w-[1200px]">
        <a href={`/admin/jobs`} className="text-text-muted text-xs inline-flex items-center gap-1.5 mb-2">
          <ArrowLeft size={12} /> All jobs
        </a>

        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {job ? (
                <>
                  Live · {job.title}{' '}
                  <span className="font-serif italic font-normal text-text-secondary">
                    — watching now.
                  </span>
                </>
              ) : (
                'Loading…'
              )}
            </h1>
            {job && (
              <p className="text-text-muted text-sm mt-1.5">
                {job.jobCode} · {job.leafletCount.toLocaleString()} leaflets ·{' '}
                <StatusBadge status={job.status} />
              </p>
            )}
          </div>
          <ConnectionPill connected={connected} />
        </div>

        {/* Fraud Shield high-severity banner — appears when a high alert fires */}
        {fraudBanner && (
          <FraudBanner alert={fraudBanner} onDismiss={() => setFraudBanner(null)} />
        )}

        {/* AI Campaign Report banner — appears when job completes */}
        {(job?.status === 'completed' || report) && (
          <ReportBanner
            jobId={jobId!}
            report={report}
            loading={reportLoading && !report}
          />
        )}

        {/* AI Re-run Recommender — appears alongside the report */}
        {rerun && (
          <RerunCard rec={rerun} />
        )}

        {/* Live map */}
        <div className="mb-5">
          <LiveMap
            polygon={mapData?.zone?.polygon ?? null}
            drops={mapData?.drops ?? []}
            newestDropId={newestDropId}
          />
        </div>

        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 360px' }}>
          <div>
            {/* KPI hero */}
            <div
              className="rounded-3xl p-7 text-white relative overflow-hidden mb-4 flex flex-col"
              style={{
                background:
                  'radial-gradient(600px circle at 100% 0%, rgba(124,58,237,.4), transparent 50%), radial-gradient(500px circle at 0% 100%, rgba(163,230,53,.18), transparent 50%), linear-gradient(160deg, #1A1B36 0%, #0F1029 100%)',
                boxShadow: '0 30px 60px -20px rgba(15,16,41,.4)',
              }}
            >
              <div className="text-[11px] font-bold tracking-[.12em] uppercase text-accent flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_12px_rgba(163,230,53,.8)] animate-pulse" />
                Drops, live
              </div>
              <div className="text-[72px] font-extrabold tracking-[-0.045em] leading-none my-3 tabular-nums">
                {totalDrops.toLocaleString()}
              </div>
              <div className="text-white/70 text-sm">
                {targetTotal > 0
                  ? `of ${targetTotal.toLocaleString()} target · ${coveragePct}% covered`
                  : `${job?.leafletCount.toLocaleString() ?? '—'} leaflets ordered`}
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-4">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${coveragePct}%` }}
                />
              </div>
            </div>

            {/* Assignments */}
            <div className="card">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-semibold">Droppers on this job</h3>
              </div>
              {!assignments && <div className="p-5 text-sm text-text-muted">Loading…</div>}
              {assignments && assignments.length === 0 && (
                <div className="p-5 text-sm text-text-muted">No droppers assigned yet.</div>
              )}
              {assignments?.map((r) => {
                const target = r.subZone?.targetLeaflets ?? 0;
                const pct = target > 0 ? Math.min(100, Math.round((r.assignment.dropsCompleted / target) * 100)) : 0;
                return (
                  <div key={r.assignment.id} className="px-5 py-4 border-b border-border last:border-0 flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
                    >
                      {r.dropper.email.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">
                        {r.dropper.email.split('@')[0]} · {r.subZone?.label ?? 'whole zone'}
                      </div>
                      <div className="text-xs text-text-muted">
                        <span className="font-semibold text-text-primary tabular-nums">
                          {r.assignment.dropsCompleted}
                        </span>{' '}
                        / {target.toLocaleString()} drops · <AssignmentStatusBadge status={r.assignment.status} />
                      </div>
                      <div className="h-1.5 rounded-full bg-bg-muted overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live feed */}
          <aside className="card flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Radio size={14} className={connected ? 'text-success animate-pulse' : 'text-text-muted'} />
                Live feed
              </h3>
              <span className="text-[10px] text-text-muted">{feed.length} events</span>
            </div>
            <div ref={feedRef} className="overflow-y-auto p-3 flex-1">
              {feed.length === 0 && (
                <div className="text-text-muted text-sm p-3 text-center">
                  Listening for events…
                  <br />
                  <span className="text-xs">
                    Open <code className="bg-bg-muted px-1.5 py-0.5 rounded">/m/active/[id]</code> as a dropper
                    and tap MARK DROP — it&rsquo;ll appear here without refresh.
                  </span>
                </div>
              )}
              {feed.map((e) => (
                <FeedRow key={e.id} entry={e} />
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function FraudBanner({
  alert,
  onDismiss,
}: {
  alert: RealtimeFraudAlert;
  onDismiss: () => void;
}) {
  return (
    <div
      className="rounded-3xl p-5 mb-5 relative overflow-hidden flex items-start gap-4"
      style={{
        background:
          'radial-gradient(500px circle at 0% 0%, rgba(239,68,68,.18), transparent 60%), linear-gradient(135deg, #FFFFFF 0%, #FEF2F2 100%)',
        border: '1px solid rgba(239,68,68,.3)',
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0"
        style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)' }}
      >
        <ShieldAlert size={22} />
      </div>
      <div className="flex-1">
        <div className="text-[11px] font-bold tracking-[.12em] uppercase text-danger mb-1">
          AI Fraud Shield · {alert.severity} severity
        </div>
        <h3 className="text-lg font-bold tracking-tight mb-1">
          {formatAlertType(alert.alertType)}
        </h3>
        <p className="text-sm text-text-secondary">{formatEvidence(alert)}</p>
        <div className="text-[11px] text-text-muted mt-2 tabular-nums">
          alert {alert.alertId.slice(0, 8)}… · {new Date(alert.at).toLocaleTimeString('en-AU', { hour12: false })} ·{' '}
          status: <strong>{alert.status.replace('_', ' ')}</strong>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-text-muted hover:text-text-primary p-1"
        aria-label="Dismiss banner"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function formatAlertType(t: RealtimeFraudAlert['alertType']): string {
  return (
    {
      mock_location: 'Mock-location attempt detected',
      impossible_speed: 'Impossible speed between drops',
      cluster_density: 'Drop cluster — drops too close together',
      stationary: 'Stationary device',
      pace_spike: 'Pace spike',
    } as const
  )[t];
}

function formatEvidence(alert: RealtimeFraudAlert): string {
  const e = alert.evidence as Record<string, unknown>;
  if (alert.alertType === 'impossible_speed') {
    return `Observed ${e.speedKmh ?? '?'} km/h over ${e.distanceM ?? '?'}m in ${e.elapsedS ?? '?'}s · threshold ${e.thresholdKmh ?? '?'} km/h (${e.transportMode ?? 'walking'})`;
  }
  if (alert.alertType === 'mock_location') {
    return `Reported accuracy ${e.reportedAccuracyM ?? '?'}m — consumer GPS rarely better than 3-5m`;
  }
  if (alert.alertType === 'cluster_density') {
    return `Drop ${e.distanceM ?? '?'}m from previous within ${e.elapsedS ?? '?'}s · ${e.hint ?? ''}`;
  }
  return JSON.stringify(e);
}

function ConnectionPill({ connected }: { connected: boolean }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold"
      style={{
        background: connected ? '#DCFCE7' : '#FEE2E2',
        color: connected ? '#15803D' : '#991B1B',
      }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${connected ? 'animate-pulse' : ''}`}
        style={{ background: connected ? '#22C55E' : '#EF4444' }}
      />
      {connected ? 'Live' : 'Disconnected'}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ml-1.5"
      style={{ background: 'var(--color-bg-muted)', color: 'var(--color-text-secondary)' }}
    >
      {status}
    </span>
  );
}

function AssignmentStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    pending: { bg: 'var(--color-bg-muted)', fg: 'var(--color-text-secondary)' },
    started: { bg: '#DCFCE7', fg: '#15803D' },
    paused: { bg: '#FEF3C7', fg: '#92400E' },
    completed: { bg: '#E0E7FF', fg: '#3730A3' },
    abandoned: { bg: '#FEE2E2', fg: '#991B1B' },
  };
  const c = colors[status] ?? colors.pending;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ml-1"
      style={{ background: c.bg, color: c.fg }}
    >
      {status}
    </span>
  );
}

interface AiReport {
  id: string;
  jobId: string;
  narrative: string;
  pdfS3Key: string | null;
  tokensInput: number;
  tokensOutput: number;
  modelName: string;
  generatedAt: string;
}

interface RerunRecommendation {
  recommendedDate: string;
  daysAhead: number;
  expectedUpliftPct: number;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
  stubbed: boolean;
  model: string;
  basis: {
    jobTitle: string;
    jobCode: string;
    campaignType: string;
    coveragePct: number;
    completedAt: string;
  };
}

function RerunCard({ rec }: { rec: RerunRecommendation }) {
  const recDate = new Date(`${rec.recommendedDate}T00:00:00`);
  const formatted = recDate.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className="rounded-3xl p-6 mb-5 relative overflow-hidden grid gap-5 items-center"
      style={{
        background:
          'radial-gradient(600px circle at 0% 0%, rgba(163,230,53,.15), transparent 50%), radial-gradient(500px circle at 100% 100%, rgba(124,58,237,.12), transparent 50%), linear-gradient(160deg, #0B0D12 0%, #1A1B36 100%)',
        gridTemplateColumns: 'auto 1fr auto',
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center text-zinc-900 shrink-0"
        style={{ background: 'linear-gradient(135deg,#BEF264,#A3E635)' }}
      >
        <CalendarPlus size={22} />
      </div>
      <div className="text-white">
        <div className="text-[11px] font-bold tracking-[.12em] uppercase text-accent mb-1">
          AI Re-run Recommender
        </div>
        <h3 className="text-xl font-bold tracking-tight mb-1">
          Re-run on {formatted}{' '}
          <span className="font-serif italic font-normal text-white/55">
            — expected uplift +{rec.expectedUpliftPct}%
          </span>
        </h3>
        <p className="text-sm text-white/75 leading-relaxed max-w-[640px]">{rec.reasoning}</p>
        <div className="text-[11px] text-white/45 mt-2 flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <TrendingUp size={11} /> {rec.expectedUpliftPct}% projected
          </span>
          <span>·</span>
          <span>{rec.daysAhead} days from completion</span>
          <span>·</span>
          <span>{rec.confidence} confidence</span>
          <span>·</span>
          <span>{rec.stubbed ? 'generated locally' : `via ${rec.model}`}</span>
        </div>
      </div>
      <a
        href={`/create/details?rerun=${encodeURIComponent(rec.basis.jobCode)}&date=${rec.recommendedDate}`}
        className="px-5 py-3 rounded-2xl font-bold inline-flex items-center gap-2 shrink-0"
        style={{ background: 'linear-gradient(135deg,#BEF264,#A3E635)', color: '#0a0a0a' }}
      >
        Schedule it <CalendarPlus size={14} />
      </a>
    </div>
  );
}

function ReportBanner({
  jobId,
  report,
  loading,
}: {
  jobId: string;
  report: AiReport | null;
  loading: boolean;
}) {
  return (
    <div
      className="rounded-3xl p-6 mb-5 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(600px circle at 0% 0%, rgba(79,70,229,.15), transparent 50%), radial-gradient(500px circle at 100% 100%, rgba(163,230,53,.12), transparent 50%), linear-gradient(160deg, #FFFFFF, #FAFBFF)',
        border: '1px solid rgba(124,58,237,.18)',
      }}
    >
      <div className="flex items-start gap-5 flex-wrap">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0"
          style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED 50%,#A3E635)' }}
        >
          <Sparkles size={20} />
        </div>
        <div className="flex-1 min-w-[280px]">
          <div className="text-[11px] font-bold tracking-[.12em] uppercase text-primary mb-1.5">
            AI Campaign Report
          </div>
          <h3 className="text-xl font-bold tracking-tight mb-2">
            {loading
              ? 'Generating your report…'
              : report
                ? 'Your campaign summary is ready.'
                : 'Report unavailable yet.'}
          </h3>
          {loading && (
            <p className="text-sm text-text-muted">
              Stats → Claude → PDF. Usually under 30 seconds.
            </p>
          )}
          {report && (
            <>
              <p className="text-sm text-text-secondary leading-relaxed max-w-[640px]">
                {firstParagraph(report.narrative)}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-3.5">
                <button onClick={() => downloadPdf(jobId)} className="btn-primary">
                  <FileDown size={14} /> Download PDF
                </button>
                <span className="text-xs text-text-muted">
                  {report.modelName === 'stub' ? (
                    <>Generated locally (Bedrock not configured)</>
                  ) : (
                    <>
                      via <strong>{report.modelName}</strong> · {report.tokensInput}/{report.tokensOutput} tokens
                    </>
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Anchor tags can't send our `x-dev-user-id` header. Fetch the PDF as a blob,
 * open it in a new tab. In production with Cognito JWT cookies this can be a
 * plain anchor.
 */
async function downloadPdf(jobId: string) {
  const session =
    typeof window !== 'undefined' ? window.localStorage.getItem('droptrack.session') : null;
  const userId = session ? (JSON.parse(session) as { id: string }).id : '';
  const res = await fetch(`/api/jobs/${jobId}/report/pdf`, {
    headers: { 'x-dev-user-id': userId },
  });
  if (!res.ok) {
    window.alert('Could not fetch PDF (status ' + res.status + ')');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function firstParagraph(text: string): string {
  const para = text.split(/\n\n+/)[0] ?? text;
  if (para.length <= 320) return para;
  return para.slice(0, 320).replace(/\s\S*$/, '') + '…';
}

function FeedRow({ entry }: { entry: FeedEntry }) {
  const age = Date.now() - new Date(entry.ts).getTime();
  const fresh = age < 5_000;
  const colors: Record<FeedEntry['kind'], { dot: string; bg: string }> = {
    drop: { dot: entry.ok === false ? '#EF4444' : '#A3E635', bg: entry.ok === false ? '#FEF2F2' : '#F7FEE7' },
    status: { dot: '#4F46E5', bg: '#EEF2FF' },
    job: { dot: '#7C3AED', bg: '#F5F3FF' },
    fraud:
      entry.severity === 'high'
        ? { dot: '#DC2626', bg: '#FEF2F2' }
        : entry.severity === 'medium'
          ? { dot: '#D97706', bg: '#FFFBEB' }
          : { dot: '#6B7280', bg: '#F9FAFB' },
  };
  const c = colors[entry.kind];
  return (
    <div
      className={`px-3 py-2.5 rounded-xl flex gap-3 items-start mb-1.5 transition-all ${
        fresh ? 'ring-2 ring-offset-1' : ''
      }`}
      style={{ background: c.bg, ['--tw-ring-color' as string]: c.dot }}
    >
      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: c.dot }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold">{entry.text}</div>
        {entry.detail && <div className="text-[11px] text-text-muted truncate mt-0.5">{entry.detail}</div>}
      </div>
      <div className="text-[10px] text-text-muted whitespace-nowrap tabular-nums">
        {new Date(entry.ts).toLocaleTimeString('en-AU', { hour12: false })}
      </div>
    </div>
  );
}
