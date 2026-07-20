/**
 * Mobile API client — Cognito JWT bearer with **transparent auto-refresh**.
 *
 * When any request comes back 401 and we have a refresh token on file, we
 * POST /api/auth/refresh once (deduped across concurrent requests), persist
 * the new tokens, and replay the original request. Only when refresh itself
 * fails do we clear the session and force the user to re-login. This matches
 * how Facebook / Instagram behave — a fresh access token is minted silently
 * as long as the refresh token is still valid.
 */
import Constants from 'expo-constants';
import { getSession, setSession, clearSession, type Session } from '@/auth/storage';

const BASE: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'http://localhost:3001';

class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`HTTP ${status}`);
  }
}

interface RefreshResponse {
  accessToken?: string | null;
  idToken?: string | null;
  refreshToken?: string | null;
}

/** In-flight refresh promise so N concurrent 401s only refresh once. */
let refreshInFlight: Promise<Session | null> | null = null;

async function refreshTokens(current: Session): Promise<Session | null> {
  if (!current.refreshToken || !current.email) return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: current.email, refreshToken: current.refreshToken }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as RefreshResponse;
      if (!body.accessToken) return null;
      const next: Session = {
        ...current,
        accessToken: body.accessToken,
        refreshToken: body.refreshToken ?? current.refreshToken,
      };
      await setSession(next);
      return next;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function doFetch(path: string, init: RequestInit, session: Session | null): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  if (session?.devUserId) {
    headers.set('x-dev-user-id', session.devUserId);
  }
  return fetch(`${BASE}${path}`, { ...init, headers });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession();
  let res = await doFetch(path, init, session);

  if (res.status === 401 && session?.refreshToken) {
    const refreshed = await refreshTokens(session);
    if (refreshed) {
      res = await doFetch(path, init, refreshed);
    } else {
      // Refresh failed — session is truly dead. Log the user out cleanly.
      await clearSession();
      throw new ApiError(401, 'Session expired');
    }
  }
  if (res.status === 401) {
    // No refresh token to try, or refresh itself came back 401.
    await clearSession();
    throw new ApiError(401, 'Session expired');
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, b?: unknown) => request<T>(p, { method: 'POST', body: b ? JSON.stringify(b) : undefined }),
  patch: <T>(p: string, b?: unknown) => request<T>(p, { method: 'PATCH', body: b ? JSON.stringify(b) : undefined }),
  delete: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
};
