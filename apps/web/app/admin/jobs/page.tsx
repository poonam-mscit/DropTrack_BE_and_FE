'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Download, Search } from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { getSession } from '@/lib/auth';
import { api, type ApiJob, type JobStatus } from '@/lib/api';

const STATUS_LABEL: Record<JobStatus, string> = {
  draft: 'Draft',
  paid_unassigned: 'Awaiting',
  assigned: 'Assigned',
  upcoming: 'Upcoming',
  active: 'Live',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_ORDER: JobStatus[] = [
  'draft',
  'paid_unassigned',
  'upcoming',
  'assigned',
  'active',
  'completed',
  'cancelled',
];

const STATUS_COLOR: Record<JobStatus, { bg: string; fg: string }> = {
  draft: { bg: '#FEF3C7', fg: '#92400E' },
  paid_unassigned: { bg: '#E0E7FF', fg: '#3730A3' },
  assigned: { bg: '#DBEAFE', fg: '#1E40AF' },
  upcoming: { bg: '#DBEAFE', fg: '#1E40AF' },
  active: { bg: '#DCFCE7', fg: '#15803D' },
  completed: { bg: '#F1F5F9', fg: '#475569' },
  cancelled: { bg: '#FEE2E2', fg: '#991B1B' },
};

export default function AdminJobs() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ApiJob[] | null>(null);
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');

  useEffect(() => {
    const s = getSession();
    if (!s) return router.replace('/login');
    if (s.role !== 'admin') return router.replace('/dashboard');
    api
      .get<{ data: ApiJob[] }>('/api/jobs')
      .then((r) => setJobs(r.data))
      .catch(console.error);
  }, [router]);

  const counts = useMemo(() => {
    const c: Partial<Record<JobStatus, number>> = {};
    jobs?.forEach((j) => (c[j.status] = (c[j.status] ?? 0) + 1));
    return c;
  }, [jobs]);

  const filtered = filter === 'all' ? jobs : jobs?.filter((j) => j.status === filter);

  return (
    <div>
      <AdminSidebar active="jobs" queueCount={counts.paid_unassigned} />
      <main className="ml-[252px] p-10">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              All jobs{' '}
              <span className="font-serif italic font-normal text-text-secondary">
                — across the network.
              </span>
            </h1>
            <p className="text-text-muted text-sm mt-1.5">
              {jobs?.length ?? '—'} jobs total · live from <code className="bg-bg-muted px-1.5 py-0.5 rounded">GET /api/jobs</code>
            </p>
          </div>
          <button className="btn-ghost"><Download size={14} /> Export CSV</button>
        </div>

        <div className="bg-white border border-border rounded-2xl p-1.5 shadow-sm mb-3.5 flex gap-1.5 overflow-x-auto">
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')} count={jobs?.length}>
            All
          </FilterTab>
          {STATUS_ORDER.map((s) => (
            <FilterTab
              key={s}
              active={filter === s}
              count={counts[s]}
              onClick={() => setFilter(s)}
              color={STATUS_COLOR[s]}
            >
              {STATUS_LABEL[s]}
            </FilterTab>
          ))}
        </div>

        <div className="bg-white border border-border rounded-2xl shadow-sm p-3 mb-4 flex gap-2 items-center">
          <Search size={16} className="ml-2 text-text-muted" />
          <input
            className="flex-1 border-none outline-none text-sm bg-transparent"
            placeholder="Search by campaign, client, suburb or job code"
          />
        </div>

        <div className="card overflow-hidden">
          {!jobs && <div className="p-6 text-text-muted text-sm">Loading…</div>}
          {jobs && filtered && filtered.length === 0 && (
            <div className="p-6 text-text-muted text-sm">No jobs match this filter.</div>
          )}
          {filtered && filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted font-semibold bg-[#FAFBFC] border-b border-border">
                  <th className="py-3.5 px-5">Campaign</th>
                  <th className="py-3.5 px-5">Leaflets</th>
                  <th className="py-3.5 px-5">Start</th>
                  <th className="py-3.5 px-5 text-right">Status</th>
                  <th className="py-3.5 px-5 text-right">Total</th>
                  <th className="py-3.5 px-5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => (
                  <tr key={j.id} className="border-b border-border last:border-0 hover:bg-bg-muted/40">
                    <td className="py-4 px-5">
                      <div className="font-semibold">{j.title}</div>
                      <div className="text-xs text-text-muted mt-0.5">{j.jobCode} · {j.campaignType.replace('_', ' ')}</div>
                    </td>
                    <td className="py-4 px-5 tabular-nums">{j.leafletCount.toLocaleString()}</td>
                    <td className="py-4 px-5 tabular-nums">{j.startDate ?? '—'}</td>
                    <td className="py-4 px-5 text-right">
                      <StatusPill status={j.status} />
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
                      {j.status === 'paid_unassigned' ? (
                        <a href={`/admin/queue/${j.id}`} className="btn-primary py-2 px-3 text-xs">
                          Assign <ArrowRight size={12} />
                        </a>
                      ) : j.status === 'assigned' || j.status === 'active' ? (
                        <a href={`/admin/track/${j.id}`} className="btn-primary py-2 px-3 text-xs">
                          Track live <ArrowRight size={12} />
                        </a>
                      ) : (
                        <a href={`/admin/track/${j.id}`} className="btn-ghost py-2 px-3 text-xs">View</a>
                      )}
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

function FilterTab({
  active,
  children,
  count,
  color,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  count?: number;
  color?: { bg: string; fg: string };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
        active ? 'bg-text-primary text-white' : 'text-text-muted hover:bg-bg-muted hover:text-text-primary'
      }`}
    >
      {color && !active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color.fg }} />}
      {children}
      {count !== undefined && (
        <span
          className={`text-[10px] font-semibold rounded-full min-w-[18px] text-center px-1.5 py-0.5 ${
            active ? 'bg-white/15' : 'bg-bg-muted'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StatusPill({ status }: { status: JobStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: c.bg, color: c.fg }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
