'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Loader2,
  Mail,
  Map,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { setSession, type Role } from '@/lib/auth';
import { Logo } from '@/components/Logo';

interface DevUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  context: string;
  to: string;
  initials: string;
  bg: string;
}

// Dev shortcuts — only used when Cognito isn't on or for fast role-switching.
const DEV_USERS: DevUser[] = [
  {
    id: '661a4974-b7ae-4243-949e-ae9acf048683',
    email: 'sarah@belleproperty.com.au',
    name: 'Sarah Nguyen',
    role: 'client',
    context: 'Belle Property — Bondi',
    to: '/dashboard',
    initials: 'SN',
    bg: 'linear-gradient(135deg,#4f46e5,#a3e635)',
  },
  {
    id: '_admin_',
    email: 'ops@droptrack.au',
    name: 'Ops Console',
    role: 'admin',
    context: 'Super Admin · Sydney',
    to: '/admin/jobs',
    initials: 'OP',
    bg: 'linear-gradient(135deg,#0b0d12,#3730a3)',
  },
  {
    id: '_james_',
    email: 'james@droptrack.au',
    name: 'James Kowalski',
    role: 'dropper',
    context: 'EMP-0124 · Bondi',
    to: '/dashboard',
    initials: 'JK',
    bg: 'linear-gradient(135deg,#0ea5e9,#10b981)',
  },
];

interface LoginResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string | null;
  expiresIn: number;
  provisioned: boolean;
  userId?: string;
  email?: string;
  role?: Role;
  message?: string;
}

interface ChallengeResponse {
  code: 'NEW_PASSWORD_REQUIRED';
  session: string;
  message: string;
}

const ROLE_HOME: Record<Role, string> = {
  client: '/dashboard',
  admin: '/admin/jobs',
  dropper: '/dashboard',
};

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDev, setShowDev] = useState(false);

  // NEW_PASSWORD_REQUIRED step
  const [challenge, setChallenge] = useState<{ session: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json()) as LoginResponse | ChallengeResponse | { message?: string };

      if (!res.ok) {
        if ((body as ChallengeResponse).code === 'NEW_PASSWORD_REQUIRED') {
          const c = body as ChallengeResponse;
          setChallenge({ session: c.session, email });
          return;
        }
        throw new Error((body as { message?: string }).message ?? 'Login failed');
      }

      acceptTokens(body as LoginResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/new-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: challenge.email,
          newPassword,
          session: challenge.session,
        }),
      });
      const body = (await res.json()) as LoginResponse | { message?: string };
      if (!res.ok) throw new Error((body as { message?: string }).message ?? 'Could not set password');
      acceptTokens(body as LoginResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function acceptTokens(b: LoginResponse) {
    if (!b.provisioned || !b.userId || !b.role) {
      setError(b.message ?? 'No DropTrack profile linked to this email. Contact your admin.');
      return;
    }
    setSession({
      id: b.userId,
      email: b.email ?? email,
      role: b.role,
      accessToken: b.accessToken,
      idToken: b.idToken,
      refreshToken: b.refreshToken,
      expiresAt: Date.now() + b.expiresIn * 1000,
    });
    router.push(ROLE_HOME[b.role]);
  }

  async function devPick(u: DevUser) {
    // Dev picker — no Cognito tokens; relies on the API guard's dev fallback.
    const res = await fetch(`/internal/lookup-by-email?email=${encodeURIComponent(u.email)}`).catch(
      () => null,
    );
    let id = u.id;
    if (res?.ok) {
      const j = (await res.json()) as { id: string };
      id = j.id;
    }
    setSession({ id, email: u.email, role: u.role });
    router.push(u.to);
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <aside
        className="relative p-12 text-white flex flex-col justify-between"
        style={{
          background:
            'radial-gradient(800px circle at 0% 0%, rgba(163,230,53,.25), transparent 50%), radial-gradient(700px circle at 100% 100%, rgba(124,58,237,.45), transparent 55%), linear-gradient(135deg, #4f46e5 0%, #3730a3 50%, #1e1b4b 100%)',
        }}
      >
        <Logo size={40} className="text-white" />
        <div>
          <h1 className="text-[38px] font-extrabold leading-[1.15] tracking-tight max-w-md">
            Australia's first{' '}
            <span
              style={{
                background: 'linear-gradient(90deg, #A3E635, #FFFFFF)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              AI-powered
            </span>{' '}
            leaflet distribution platform.
          </h1>
          <div className="flex flex-wrap gap-2 mt-6 max-w-md">
            <Pill icon={<ShieldCheck size={13} />}>AI Fraud Shield</Pill>
            <Pill icon={<Map size={13} />}>AI Route Planner</Pill>
            <Pill icon={<BarChart3 size={13} />}>AI Insights</Pill>
            <Pill icon={<MessageSquare size={13} />}>AI Job Creator</Pill>
          </div>
        </div>
        <p className="text-xs text-white/60">
          © 2026 DropTrack · Privacy Act 1988 compliant · AU data residency
        </p>
      </aside>

      <main className="p-12 flex flex-col justify-center max-w-[480px] w-full mx-auto">
        <h2 className="text-2xl font-bold">{challenge ? 'Set your password' : 'Welcome back'}</h2>
        <p className="mt-2 mb-6 text-text-muted text-sm">
          {challenge
            ? 'First-time login — choose a permanent password to continue.'
            : 'Sign in to your DropTrack account.'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {!challenge ? (
          <form onSubmit={submitLogin} className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-text-secondary">
              Email or mobile
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full border border-border rounded-xl px-4 py-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary"
                placeholder="agent@realestate.com.au"
                autoComplete="email"
              />
            </label>
            <label className="text-xs font-semibold text-text-secondary">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full border border-border rounded-xl px-4 py-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary"
                autoComplete="current-password"
              />
            </label>
            <div className="flex justify-end -mt-1">
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary justify-center py-3.5">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Sign in
            </button>

            <div className="flex items-center gap-3 my-1 text-text-muted text-xs">
              <span className="flex-1 h-px bg-border" />
              or
              <span className="flex-1 h-px bg-border" />
            </div>

            <Link
              href="/login/email"
              className="border border-border rounded-xl px-4 py-3 text-sm font-semibold text-text-primary hover:bg-bg-muted transition-colors flex items-center gap-2 justify-center"
            >
              <Mail size={15} /> Email me a one-time code
            </Link>

            <p className="text-center mt-4 text-text-muted text-xs">
              New to DropTrack?{' '}
              <Link href="/signup" className="text-primary font-semibold hover:underline">
                Create account
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={submitNewPassword} className="flex flex-col gap-3">
            <p className="text-xs text-text-muted">
              Signing in as <span className="font-semibold">{challenge.email}</span>. Choose a
              password (8+ chars, mixed case, number).
            </p>
            <label className="text-xs font-semibold text-text-secondary">
              New password
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full border border-border rounded-xl px-4 py-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary"
                autoComplete="new-password"
              />
            </label>
            <button type="submit" disabled={submitting} className="btn-primary mt-2 justify-center">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Set password &amp; sign in
            </button>
            <button
              type="button"
              onClick={() => setChallenge(null)}
              className="text-xs text-text-muted hover:text-text-primary mt-1"
            >
              ← Back to sign-in
            </button>
          </form>
        )}

        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-8 pt-6 border-t border-border">
            <button
              type="button"
              onClick={() => setShowDev((v) => !v)}
              className="text-xs text-text-muted hover:text-text-primary font-medium"
            >
              {showDev ? '↑ Hide' : '↓ Show'} dev shortcuts
            </button>
            {showDev && (
              <div className="flex flex-col gap-2 mt-4">
                {DEV_USERS.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => devPick(u)}
                    className="card p-3 flex items-center gap-3 text-left hover:border-primary/30 transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold shrink-0 text-xs"
                      style={{ background: u.bg }}
                    >
                      {u.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{u.name}</div>
                      <div className="text-[11px] text-text-muted truncate">{u.context}</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-primary px-1.5 py-0.5 rounded bg-primary-50">
                      {u.role}
                    </span>
                  </button>
                ))}
                <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                  Dev shortcuts skip Cognito and use the API&rsquo;s <code>x-dev-user-id</code> fallback.
                  Only works while <code>NODE_ENV !== production</code>.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-full"
      style={{
        background: 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {icon}
      {children}
    </span>
  );
}
