'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { getSocket } from '@/lib/socket';

export type NotificationType =
  | 'campaign_milestone'
  | 'ai_report_ready'
  | 'payment_received'
  | 'fraud_alert'
  | 'assignment'
  | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Shared unread-count hook. Used by both sidebars so the menu badge stays
 * live without each surface reinventing polling + socket wiring.
 *
 * - Polls `unread-count` every 30 s (cheap)
 * - Joins the user's socket room to bump the badge on `notification.created`
 *   pushes without waiting for the next poll
 * - Also refreshes whenever a `notifications:changed` window event fires,
 *   so pages that mark rows read can tell every sidebar instance to redraw
 */
const POLL_MS = 30_000;

export function useUnreadCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let sock: ReturnType<typeof getSocket> | null = null;
    let userId: string | null = null;

    const refresh = async () => {
      try {
        const res = await api.get<{ unreadCount: number }>('/api/me/notifications/unread-count');
        if (!cancelled) setCount(res.unreadCount);
      } catch {
        // silent — badge just stays at last known value
      }
    };

    const s = getSession();
    if (!s) return;
    userId = s.id;

    void refresh();
    const t = setInterval(refresh, POLL_MS);

    try {
      sock = getSocket();
      sock.emit('join:user', userId);
      sock.on('notification.created', () => setCount((c) => (c ?? 0) + 1));
    } catch {
      // socket optional — poll still works
    }

    // Same-tab hint: pages that mark rows read fire this custom event
    // so every mounted sidebar drops its badge instantly.
    const onChanged = () => void refresh();
    window.addEventListener('notifications:changed', onChanged);

    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener('notifications:changed', onChanged);
      if (sock && userId) {
        sock.off('notification.created');
        sock.emit('leave:user', userId);
      }
    };
  }, []);

  return count;
}

/** Convenience event dispatcher so pages don't need to know the event name. */
export function notifyBadgeStale() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notifications:changed'));
  }
}
