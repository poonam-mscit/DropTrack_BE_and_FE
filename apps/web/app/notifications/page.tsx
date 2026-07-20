'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  CheckCheck,
  DollarSign,
  Loader2,
  MapPin,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';
import {
  notifyBadgeStale,
  type Notification,
  type NotificationType,
} from '@/lib/notifications';

const ICONS: Record<NotificationType, React.ReactNode> = {
  campaign_milestone: <MapPin size={16} className="text-emerald-600" />,
  ai_report_ready: <Sparkles size={16} className="text-indigo-600" />,
  payment_received: <DollarSign size={16} className="text-amber-600" />,
  fraud_alert: <ShieldAlert size={16} className="text-red-600" />,
  assignment: <CheckCheck size={16} className="text-blue-600" />,
  system: <Bell size={16} className="text-slate-500" />,
};

export default function NotificationsInbox() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (cur: string | null) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '30' });
      if (cur) qs.set('cursor', cur);
      const res = await api.get<{
        data: Notification[];
        nextCursor: string | null;
        unreadCount: number;
      }>(`/api/me/notifications?${qs.toString()}`);
      setItems((prev) => (cur && prev ? [...prev, ...res.data] : res.data));
      setNextCursor(res.nextCursor);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getSession()) return router.replace('/login');
    void load(null);
  }, [router, load]);

  async function markOne(n: Notification) {
    if (n.readAt) return;
    setItems((prev) =>
      prev?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? prev,
    );
    notifyBadgeStale();
    try {
      await api.patch(`/api/me/notifications/${n.id}/read`);
    } catch {
      // ignore — next reload reconciles
    }
  }

  async function markAll() {
    setMarkingAll(true);
    setItems((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? prev);
    notifyBadgeStale();
    try {
      await api.post('/api/me/notifications/read-all');
    } catch {
      void load(null);
    } finally {
      setMarkingAll(false);
    }
  }

  const hasUnread = items?.some((n) => !n.readAt) ?? false;

  return (
    <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
      <AppSidebar active="notifications" />
      <main className="p-8 lg:p-10 max-w-3xl">
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Notifications{' '}
              <span className="font-serif italic font-normal text-text-secondary">— what changed lately.</span>
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Payments, dropper assignments, live-campaign milestones, and AI reports as they land.
            </p>
          </div>
          {hasUnread && (
            <button
              onClick={markAll}
              disabled={markingAll}
              className="btn-ghost text-sm disabled:opacity-50"
            >
              {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
              Mark all read
            </button>
          )}
        </header>

        <section className="bg-white rounded-2xl border border-border overflow-hidden">
          {items === null && (
            <div className="p-10 text-center text-text-muted text-sm">
              <Loader2 size={18} className="inline animate-spin mr-2" /> Loading…
            </div>
          )}
          {items && items.length === 0 && (
            <div className="p-14 text-center">
              <Bell size={26} className="mx-auto text-text-muted mb-3" />
              <p className="text-sm font-semibold">Nothing here yet</p>
              <p className="text-xs text-text-muted mt-2 max-w-xs mx-auto">
                We'll ping you when a campaign hits a milestone, an admin marks a payment received, or your AI report is ready.
              </p>
            </div>
          )}
          {items && items.length > 0 && (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const inner = (
                  <div
                    className={`flex gap-4 px-5 py-4 hover:bg-bg-muted/60 transition-colors ${
                      n.readAt ? '' : 'bg-indigo-50/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-bg-muted flex items-center justify-center shrink-0">
                      {ICONS[n.type]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{n.title}</p>
                        {!n.readAt && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 rounded-full px-1.5 py-0.5">
                            New
                          </span>
                        )}
                      </div>
                      {n.body && (
                        <p className="text-sm text-text-secondary mt-1 leading-snug">{n.body}</p>
                      )}
                      <p className="text-[11px] text-text-muted mt-1.5">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.linkUrl ? (
                      <Link
                        href={n.linkUrl}
                        onClick={() => void markOne(n)}
                        className="block"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button onClick={() => void markOne(n)} className="block w-full text-left">
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {nextCursor && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => {
                setCursor(nextCursor);
                void load(nextCursor);
              }}
              disabled={loading}
              className="btn-ghost text-sm disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Load older
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 90) return '1 min ago';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 7200) return '1 hour ago';
  if (s < 86_400) return `${Math.round(s / 3600)} hours ago`;
  if (s < 172_800) return 'yesterday';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
