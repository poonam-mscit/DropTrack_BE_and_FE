'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { getSession } from '@/lib/auth';
import { api } from '@/lib/api';

interface Dropper {
  userId: string;
  email: string;
  status: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  primaryZone: string | null;
  onboardingStatus: 'partial' | 'complete';
  ratingAvg: string | null;
  jobsDone: number;
  employmentType: string;
  activeAssignments: number;
}

export default function AdminDroppers() {
  const router = useRouter();
  const [droppers, setDroppers] = useState<Dropper[] | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) return router.replace('/login');
    if (s.role !== 'admin') return router.replace('/dashboard');
    api
      .get<{ data: Dropper[] }>('/api/droppers')
      .then((r) => setDroppers(r.data))
      .catch(console.error);
  }, [router]);

  const activeCount = droppers?.filter((d) => d.activeAssignments > 0).length ?? 0;
  const completeCount = droppers?.filter((d) => d.onboardingStatus === 'complete').length ?? 0;

  return (
    <div>
      <AdminSidebar active="droppers" />
      <main className="ml-[252px] p-10">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              Droppers{' '}
              <span className="font-serif italic font-normal text-text-secondary">
                — your team.
              </span>
            </h1>
            <p className="text-text-muted text-sm mt-1.5">
              {droppers?.length ?? '—'} employees · {activeCount} working now · {completeCount} fully onboarded
            </p>
          </div>
          <button className="btn-primary"><UserPlus size={14} /> Invite dropper</button>
        </div>

        <div className="card overflow-hidden">
          {!droppers && <div className="p-6 text-text-muted text-sm">Loading…</div>}
          {droppers && droppers.length === 0 && (
            <div className="p-10 text-center text-text-muted">No droppers yet.</div>
          )}
          {droppers && droppers.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted font-semibold bg-[#FAFBFC] border-b border-border">
                  <th className="py-3.5 px-5">Employee</th>
                  <th className="py-3.5 px-5">Zone</th>
                  <th className="py-3.5 px-5 text-right">Jobs done</th>
                  <th className="py-3.5 px-5 text-right">Rating</th>
                  <th className="py-3.5 px-5 text-right">Active now</th>
                  <th className="py-3.5 px-5 text-right">Onboarding</th>
                </tr>
              </thead>
              <tbody>
                {droppers.map((d) => (
                  <tr key={d.userId} className="border-b border-border last:border-0 hover:bg-bg-muted/40">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg text-white text-xs font-bold flex items-center justify-center shrink-0"
                          style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
                        >
                          {d.firstName[0]}
                          {d.lastName[0]}
                        </div>
                        <div>
                          <div className="font-semibold">
                            {d.firstName} {d.lastName}
                          </div>
                          <div className="text-xs text-text-muted mt-0.5">
                            {d.employeeId} · {d.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-text-secondary">{d.primaryZone ?? '—'}</td>
                    <td className="py-4 px-5 text-right tabular-nums">{d.jobsDone}</td>
                    <td className="py-4 px-5 text-right tabular-nums">★ {d.ratingAvg ?? '—'}</td>
                    <td className="py-4 px-5 text-right">
                      {d.activeAssignments > 0 ? (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: '#DCFCE7', color: '#15803D' }}
                        >
                          ● {d.activeAssignments} live
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                        style={
                          d.onboardingStatus === 'complete'
                            ? { background: '#DCFCE7', color: '#15803D' }
                            : { background: '#FEF3C7', color: '#92400E' }
                        }
                      >
                        {d.onboardingStatus === 'complete' ? 'Complete' : 'Partial'}
                      </span>
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
