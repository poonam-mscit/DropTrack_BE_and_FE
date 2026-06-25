/**
 * Client-side auth helper.
 *
 * - Cognito mode: stores access/id/refresh tokens; API client sends Bearer.
 * - Dev mode (no Cognito): just the impersonated user-id; API client sends x-dev-user-id.
 */
export type Role = 'client' | 'dropper' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  accessToken?: string;
  idToken?: string;
  refreshToken?: string | null;
  expiresAt?: number; // ms epoch
}

const KEY = 'droptrack.session';

export function getSession(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setSession(user: SessionUser) {
  window.localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem(KEY);
}

export function isTokenExpired(s: SessionUser | null): boolean {
  if (!s?.expiresAt) return false;
  return Date.now() >= s.expiresAt - 30_000; // 30s skew
}
