'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Info, RotateCcw } from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { getSession } from '@/lib/auth';
import { api, type ApiJob } from '@/lib/api';

export default function AdminQueue() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ApiJob[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const s = getSession();
    if (!s) return router.replace('/login');
    if (s.role !== 'admin') return router.replace('/dashboard');
    api
      .get<{ data: ApiJob[] }>('/api/jobs')
      .then((r) => setJobs(r.data.filter((j) => j.status === 'paid_unassigned')))
      .catch(console.error);
  }, [router, refreshKey]);

  const totalLeaflets = jobs?.reduce((s, j) => s + j.leafletCount, 0) ?? 0;
  const totalRevenueCents = jobs?.reduce((s, j) => s + (j.amountTotalCents ?? 0), 0) ?? 0;

  return (
    <div>
      <AdminSidebar active="queue" queueCount={jobs?.length} />
      <main className="ml-[252px] p-10">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              Assignment Queue{' '}
              <span className="font-serif italic font-normal text-text-secondary">
                — {jobs?.length ?? '—'} jobs need a dropper.
              </span>
            </h1>
            <p className="text-text-muted text-sm mt-1.5">
              Paid &amp; unassigned only. Click <strong>Assign</strong> to open the workspace.
            </p>
          </div>
          <button className="btn-ghost" onClick={() => setRefreshKey((k) => k + 1)}>
            <RotateCcw size={14} /> Refresh
          </button>
        </div>

        <div
          className="rounded-2xl p-4 mb-4 flex gap-3.5 items-start"
          style={{
            background: 'linear-gradient(135deg, #FFFFFF, #FAFBFF)',
            border: '1px solid rgba(79,70,229,.18)',
          }}
        >
          <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary flex items-center justify-center shrink-0">
            <Info size={16} />
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            <strong className="text-text-primary">What you see here:</strong> only jobs the client has
            paid for and you haven&rsquo;t rostered a dropper to yet. For every other status use{' '}
            <a href="/admin/jobs" className="text-primary font-semibold">Jobs</a>.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          <Kpi label="In queue" value={jobs?.length ?? 0} warn />
          <Kpi label="Total leaflets" value={totalLeaflets.toLocaleString()} />
          <Kpi label="Locked-in revenue" value={(totalRevenueCents / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })} />
          <Kpi label="Oldest waiting" value={jobs && jobs.length > 0 ? oldestWait(jobs) : '—'} />
        </div>

        <div className="card overflow-hidden">
          {!jobs && <div className="p-6 text-text-muted text-sm">Loading…</div>}
          {jobs && jobs.length === 0 && (
            <div className="p-10 text-center text-text-muted">
              <div className="text-base">No jobs awaiting assignment.</div>
              <div className="text-xs mt-2">When clients pay for new campaigns they&rsquo;ll appear here.</div>
            </div>
          )}
          {jobs && jobs.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted font-semibold bg-[#FAFBFC] border-b border-border">
                  <th className="py-3.5 px-5">Campaign</th>
                  <th className="py-3.5 px-5">Type</th>
                  <th className="py-3.5 px-5 text-right">Leaflets</th>
                  <th className="py-3.5 px-5 text-right">Paid</th>
                  <th className="py-3.5 px-5 text-right">Waiting</th>
                  <th className="py-3.5 px-5" />
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-border last:border-0 hover:bg-bg-muted/40">
                    <td className="py-4 px-5">
                      <div className="font-semibold">{j.title}</div>
                      <div className="text-xs text-text-muted mt-0.5">{j.jobCode}</div>
                    </td>
                    <td className="py-4 px-5 capitalize">{j.campaignType.replace('_', ' ')}</td>
                    <td className="py-4 px-5 text-right tabular-nums font-semibold">
                      {j.leafletCount.toLocaleString()}
                    </td>
                    <td className="py-4 px-5 text-right tabular-nums font-semibold">
                      {j.amountTotalCents
                        ? (j.amountTotalCents / 100).toLocaleString('en-AU', {
                            style: 'currency',
                            currency: 'AUD',
                          })
                        : '—'}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <WaitingPill paidAt={j.paidAt} />
                    </td>
                    <td className="py-4 px-5 text-right">
                      <a href={`/admin/queue/${j.id}`} className="btn-primary py-2 px-3 text-xs">
                        Assign <ArrowRight size={12} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="card p-4.5 p-5">
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">{label}</div>
      <div className={`text-2xl font-bold tracking-tight mt-1 ${warn ? 'text-warning' : ''}`}>{value}</div>
    </div>
  );
}

function WaitingPill({ paidAt }: { paidAt: string | null }) {
  if (!paidAt) return <span className="text-text-muted text-xs">—</span>;
  const hours = (Date.now() - new Date(paidAt).getTime()) / 3_600_000;
  let label = '';
  let bg = '#F4F4F5';
  let fg = '#52525B';
  if (hours >= 24) {
    label = `${Math.floor(hours / 24)} d`;
    bg = 'rgba(239,68,68,.12)';
    fg = '#991B1B';
  } else if (hours >= 6) {
    label = `${Math.round(hours)} hr`;
    bg = 'rgba(245,158,11,.12)';
    fg = '#92400E';
  } else if (hours >= 1) {
    label = `${Math.round(hours)} hr`;
  } else {
    label = `${Math.round(hours * 60)} min`;
  }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}

function oldestWait(jobs: ApiJob[]): string {
  const oldest = jobs
    .filter((j) => j.paidAt)
    .reduce<ApiJob | null>((acc, j) => (!acc || j.paidAt! < acc.paidAt! ? j : acc), null);
  if (!oldest?.paidAt) return '—';
  const hours = (Date.now() - new Date(oldest.paidAt).getTime()) / 3_600_000;
  if (hours >= 24) return `${Math.floor(hours / 24)} d`;
  return `${Math.round(hours)} hr`;
}
