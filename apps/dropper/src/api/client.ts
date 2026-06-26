/**
 * Mirror of the web's API client — Cognito JWT bearer with auto-refresh, plus
 * a dev-mode impersonation header for testing without Cognito hooked up on
 * the mobile build yet.
 */
import Constants from 'expo-constants';
import { getSession, clearSession } from '@/auth/storage';

const BASE: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'http://localhost:3001';

class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`HTTP ${status}`);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession();
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

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
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
