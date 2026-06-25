/**
 * Tiny API client.
 *
 * Auth header is added on every request:
 *   - Cognito-backed session → Authorization: Bearer <accessToken>
 *   - Dev impersonation     → x-dev-user-id: <uuid>
 *
 * If the Cognito access token is about to expire (or already has), we
 * silently exchange the refresh token for a new pair before sending the
 * actual request. If refresh fails, we clear the session and bounce the
 * user back to /login.
 */
import { clearSession, getSession, isTokenExpired, setSession, type SessionUser } from './auth';

class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`HTTP ${status}`);
  }
}

interface RefreshResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

// Share a single in-flight refresh across concurrent requests so we don't
// spam Cognito with N refresh calls when N requests all fire at once.
let refreshInFlight: Promise<SessionUser | null> | null = null;

async function refreshIfNeeded(): Promise<SessionUser | null> {
  const s = getSession();
  if (!s) return null;
  if (!s.accessToken || !s.refreshToken) return s;
  if (!isTokenExpired(s)) return s;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: s.email, refreshToken: s.refreshToken }),
        });
        if (!res.ok) {
          // Refresh failed — token revoked or expired.
          clearSession();
          if (typeof window !== 'undefined') window.location.href = '/login';
          return null;
        }
        const body = (await res.json()) as RefreshResponse;
        const next: SessionUser = {
          ...s,
          accessToken: body.accessToken,
          idToken: body.idToken,
          refreshToken: body.refreshToken ?? s.refreshToken,
          expiresAt: Date.now() + body.expiresIn * 1000,
        };
        setSession(next);
        return next;
      } catch {
        clearSession();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // 1. Refresh access token if expired (no-op for dev sessions).
  const session = (await refreshIfNeeded()) ?? getSession();

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  } else if (session) {
    // Dev mode fallback — picker on /login sets id without tokens.
    headers.set('x-dev-user-id', session.id);
  }

  const res = await fetch(path, { ...init, headers });

  // If the server thinks the token is invalid (race condition or out-of-band
  // revocation), force re-login.
  if (res.status === 401 && session?.accessToken) {
    clearSession();
    if (typeof window !== 'undefined' && !path.startsWith('/api/auth/')) {
      window.location.href = '/login';
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { ApiError };

// ─── Shared API types (mirror the NestJS responses) ───
export type JobStatus =
  | 'draft'
  | 'paid_unassigned'
  | 'assigned'
  | 'upcoming'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface ApiJob {
  id: string;
  jobCode: string;
  clientUserId: string;
  title: string;
  campaignType: string;
  leafletCount: number;
  status: JobStatus;
  startDate: string | null;
  deadline: string | null;
  createdAt: string;
  paidAt: string | null;
  paymentStatus: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partial_refund' | null;
  amountTotalCents: number | null;
}
