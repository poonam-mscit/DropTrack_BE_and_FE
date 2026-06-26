'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, MapPin, Radio } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { api, type ApiJob } from '@/lib/api';
import { getSession } from '@/lib/auth';

/**
 * Live Tracking hub. Lists every campaign currently in the field.
 * - If there's exactly one → push straight into its /track page.
 * - Multiple → show cards so the user picks which one to watch.
 * - None → friendly empty state.
 */
export default function TrackingHub() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ApiJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    void (async () => {
      try {
        const res = await api.get<ApiJob[] | { data?: ApiJob[] }>('/api/jobs');
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setJobs(list);
      } catch (err) {
        setError((err as Error).message);
        setJobs([]);
      }
    })();
  }, [router]);

  const live = useMemo(
    () =>
      (jobs ?? []).filter(
        (j) => j.status === 'active' || j.status === 'assigned' || j.status === 'paid_unassigned' || j.status === 'upcoming',
      ),
    [jobs],
  );

  // If exactly one campaign is in-flight, skip the picker entirely.
  useEffect(() => {
    if (live.length === 1) router.replace(`/campaigns/${live[0].id}/track`);
  }, [live, router]);

  if (error) {
    return (
      <Shell>
        <div className="max-w-md p-5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          {error}
        </div>
      </Shell>
    );
  }
  if (jobs === null) {
    return (
      <Shell>
        <p className="text-text-muted text-sm">
          <Loader2 size={14} className="inline animate-spin mr-2" /> Looking for live campaigns…
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-6">
        <h1 className="text-[40px] leading-[1.05] font-bold tracking-tight">
          Live Tracking{' '}
          <span className="font-serif italic font-normal text-text-secondary">— who&rsquo;s in the field.</span>
        </h1>
        <p className="mt-2 text-sm text-text-muted inline-flex items-center gap-2">
          <Radio size={14} className="text-emerald-500" />
          {live.length === 0 ? 'No campaigns in the field right now.' : `${live.length} campaign${live.length === 1 ? '' : 's'} live`}
        </p>
      </header>

      {live.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center max-w-xl">
          <MapPin size={28} className="mx-auto text-text-muted mb-2" />
          <p className="text-base font-semibold">Nothing to track yet</p>
          <p className="text-sm text-text-muted mt-2 max-w-md mx-auto">
            Live tracking lights up once droppers start an assignment for an active campaign. Create a campaign,
            wait for admin approval, then come back here.
          </p>
          <a href="/campaigns" className="btn-primary mt-5 inline-flex">
            Go to Campaigns <ArrowRight size={14} />
          </a>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {live.map((j) => (
            <a
              key={j.id}
              href={`/campaigns/${j.id}/track`}
              className="bg-white border border-border rounded-2xl p-5 hover:shadow-md transition-shadow block"
            >
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[.12em] font-bold text-emerald-600 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {j.status.replace('_', ' ')}
              </div>
              <p className="font-bold text-base leading-tight truncate">{j.title}</p>
              <p className="text-xs text-text-muted mt-1">{j.jobCode}</p>
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-text-muted">{j.leafletCount.toLocaleString()} drops</span>
                <span className="text-primary font-semibold inline-flex items-center gap-1">
                  Watch live <ArrowRight size={13} />
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
      <AppSidebar active="tracking" />
      <main className="p-8 lg:p-10 max-w-[1280px]">{children}</main>
    </div>
  );
}
