'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, DollarSign, Loader2, MapPin, ShieldAlert, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { getSocket } from '@/lib/socket';

const POLL_MS = 30_000;

type NotificationType =
  | 'campaign_milestone'
  | 'ai_report_ready'
  | 'payment_received'
  | 'fraud_alert'
  | 'assignment'
  | 'system';

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

interface ListResponse {
  data: Notification[];
  nextCursor: string | null;
  unreadCount: number;
}

const ICONS: Record<NotificationType, React.ReactNode> = {
  campaign_milestone: <MapPin size={14} className="text-emerald-600" />,
  ai_report_ready: <Sparkles size={14} className="text-indigo-600" />,
  payment_received: <DollarSign size={14} className="text-amber-600" />,
  fraud_alert: <ShieldAlert size={14} className="text-red-600" />,
  assignment: <CheckCheck size={14} className="text-blue-600" />,
  system: <Bell size={14} className="text-slate-500" />,
};

/**
 * Header notification bell + slide-in panel. Polls unread count every 30s
 * (cheap endpoint) and refetches the full list when the panel opens or the
 * user acts on it. Once we wire the notification.created websocket event
 * (Slice 2) we'll bump `unreadCount` optimistically on push and only fall
 * back to the poll when the socket is dead.
 */
export function NotificationsBell({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState<number | null>(null);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await api.get<{ unreadCount: number }>('/api/me/notifications/unread-count');
      setUnread(res.unreadCount);
    } catch {
      // stay silent on transient errors
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ListResponse>('/api/me/notifications?limit=20');
      setItems(res.data);
      setUnread(res.unreadCount);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Prime the badge + poll on mount.
  useEffect(() => {
    void refreshCount();
    const t = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(t);
  }, [refreshCount]);

  // Real-time push: join the user's socket room and listen for
  // `notification.created`. When one lands, bump the badge instantly and, if
  // the panel is open, prepend the row so the user sees it appear.
  useEffect(() => {
    const s = getSession();
    if (!s?.id) return;
    const sock = getSocket();
    sock.emit('join:user', s.id);
    const onCreated = (payload: {
      id: string;
      type: NotificationType;
      title: string;
      body: string | null;
      linkUrl: string | null;
      createdAt: string;
    }) => {
      setUnread((c) => (c ?? 0) + 1);
      setItems((prev) =>
        prev
          ? [
              {
                id: payload.id,
                userId: s.id,
                type: payload.type,
                title: payload.title,
                body: payload.body,
                linkUrl: payload.linkUrl,
                readAt: null,
                createdAt: payload.createdAt,
              },
              ...prev,
            ]
          : prev,
      );
    };
    sock.on('notification.created', onCreated);
    return () => {
      sock.off('notification.created', onCreated);
      sock.emit('leave:user', s.id);
    };
  }, []);

  // Load the list every time the panel opens.
  useEffect(() => {
    if (open) void loadList();
  }, [open, loadList]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function markOne(id: string) {
    setItems((prev) =>
      prev?.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) ?? prev,
    );
    setUnread((c) => (c && c > 0 ? c - 1 : c));
    try {
      await api.patch(`/api/me/notifications/${id}/read`);
    } catch {
      // If it fails, the next list refetch reconciles the state.
    }
  }

  async function markAll() {
    setItems((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? prev);
    setUnread(0);
    try {
      await api.post('/api/me/notifications/read-all');
    } catch {
      void loadList();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
        className={`relative w-11 h-11 rounded-xl bg-white border border-border flex items-center justify-center text-text-secondary hover:text-text-primary ${className}`}
      >
        <Bell size={16} />
        {unread != null && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/20" aria-hidden>
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            className="absolute top-3 right-3 w-[380px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] bg-white rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <p className="font-bold text-sm">Notifications</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {unread != null && unread > 0 ? `${unread} unread` : 'Nothing new'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {items && items.some((n) => !n.readAt) && (
                  <button
                    onClick={markAll}
                    className="text-xs text-primary hover:underline font-semibold px-2 py-1"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-text-muted hover:text-text-primary p-1.5 rounded-md hover:bg-bg-muted"
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading && (!items || items.length === 0) && (
                <div className="p-6 text-center text-text-muted text-sm">
                  <Loader2 size={16} className="inline animate-spin mr-2" /> Loading…
                </div>
              )}
              {!loading && items && items.length === 0 && (
                <div className="p-8 text-center">
                  <Bell size={22} className="mx-auto text-text-muted mb-2" />
                  <p className="text-sm font-semibold">You're all caught up</p>
                  <p className="text-xs text-text-muted mt-1">
                    We'll ping you when a campaign hits a milestone or a payment lands.
                  </p>
                </div>
              )}
              {items && items.length > 0 && (
                <ul className="divide-y divide-border">
                  {items.map((n) => {
                    const inner = (
                      <div
                        className={`flex gap-3 px-4 py-3 hover:bg-bg-muted/60 transition-colors ${
                          n.readAt ? '' : 'bg-indigo-50/50'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-bg-muted flex items-center justify-center shrink-0">
                          {ICONS[n.type]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{n.title}</p>
                          {n.body && (
                            <p className="text-xs text-text-muted mt-0.5 leading-snug line-clamp-2">
                              {n.body}
                            </p>
                          )}
                          <p className="text-[10px] text-text-muted mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.readAt && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />}
                      </div>
                    );
                    return (
                      <li key={n.id}>
                        {n.linkUrl ? (
                          <Link
                            href={n.linkUrl}
                            onClick={() => {
                              if (!n.readAt) void markOne(n.id);
                              setOpen(false);
                            }}
                            className="block"
                          >
                            {inner}
                          </Link>
                        ) : (
                          <button
                            onClick={() => !n.readAt && markOne(n.id)}
                            className="block w-full text-left"
                          >
                            {inner}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
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
  return `${Math.round(s / 86_400)} days ago`;
}
