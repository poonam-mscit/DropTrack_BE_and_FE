'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { setSession } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { PasswordInput } from '@/components/PasswordInput';

interface InviteInfo {
  email: string;
  role: 'dropper';
  prefill: { firstName?: string; lastName?: string; primaryZone?: string } | null;
  expiresAt: string;
}

interface AcceptResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  role: 'dropper';
}

const DROPPER_DEEP_LINK_BASE = 'droptrackdropper://accept';

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<CenterLoader />}>
      <AcceptInviteInner />
    </Suspense>
  );
}

function AcceptInviteInner() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get('token') ?? '';

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError('Missing invite token. Please use the exact link from your invite email.');
      return;
    }
    api
      .get<InviteInfo>(`/api/invites/${token}`)
      .then(setInfo)
      .catch((err) => {
        const body = (err as { body?: { message?: unknown } }).body?.message;
        setLoadError(typeof body === 'string' ? body : 'This invite link is invalid, used, or expired.');
      });
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (password.length < 10) {
      setSubmitError('Password must be at least 10 characters.');
      return;
    }
    if (password !== confirm) {
      setSubmitError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<AcceptResponse>('/api/auth/accept-dropper-invite', {
        token,
        password,
      });
      setSession({
        id: res.userId,
        email: res.email,
        role: res.role,
        accessToken: res.accessToken,
        idToken: res.idToken,
        refreshToken: res.refreshToken,
      });
      setAccepted(true);
    } catch (err) {
      const body = (err as { body?: { message?: unknown } }).body?.message;
      setSubmitError(typeof body === 'string' ? body : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_2px_10px_rgba(11,13,18,.06)] border border-border p-8">
        <div className="flex justify-center mb-5">
          <Logo />
        </div>

        {loadError ? (
          <>
            <h1 className="text-xl font-bold text-center">Invite unavailable</h1>
            <p className="mt-3 text-sm text-text-muted text-center">{loadError}</p>
            <Link href="/login" className="btn-ghost w-full justify-center mt-6">
              Go to sign in
            </Link>
          </>
        ) : !info ? (
          <CenterLoader />
        ) : accepted ? (
          <SuccessPanel email={info.email} token={token} />
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <h1 className="text-xl font-bold">You&rsquo;re invited to DropTrack</h1>
            <p className="text-sm text-text-muted">
              Welcome{info.prefill?.firstName ? `, ${info.prefill.firstName}` : ''}. Set a password to
              activate your dropper account for <strong>{info.email}</strong>.
            </p>

            <label className="text-xs font-semibold text-text-secondary mt-3">
              Password (at least 10 characters)
              <PasswordInput
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Choose a strong password"
              />
            </label>
            <label className="text-xs font-semibold text-text-secondary">
              Confirm password
              <PasswordInput
                required
                minLength={10}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Re-enter password"
              />
            </label>

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !password || !confirm}
              className="btn-primary w-full justify-center mt-2 disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Create account
            </button>

            <p className="text-[11px] text-text-muted text-center mt-3">
              Invite expires {new Date(info.expiresAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}.
              By continuing you agree to our{' '}
              <Link href="/terms" className="text-primary hover:underline">Terms</Link> and{' '}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

function SuccessPanel({ email, token }: { email: string; token: string }) {
  const deepLink = `${DROPPER_DEEP_LINK_BASE}?token=${token}`;
  return (
    <div className="text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
        <CheckCircle2 size={28} className="text-emerald-700" />
      </div>
      <h1 className="text-xl font-bold">You&rsquo;re in</h1>
      <p className="text-sm text-text-muted mt-2">
        Account <strong>{email}</strong> is ready.
      </p>
      <p className="text-sm text-text-muted mt-3">
        Continue in your browser, or download the mobile app when it&rsquo;s available in the stores.
      </p>

      <div className="mt-5 space-y-2">
        <a
          href="https://dropper.droptrack.com.au"
          className="btn-primary w-full justify-center"
        >
          <Smartphone size={14} /> Continue on web →
        </a>
        <a
          href="https://apps.apple.com/au/app/id6786642908"
          target="_blank"
          rel="noreferrer"
          className="btn-ghost w-full justify-center"
        >
          Open on App Store
        </a>
        <a
          href="https://play.google.com/store/apps/details?id=app.droptrack.com.au"
          target="_blank"
          rel="noreferrer"
          className="btn-ghost w-full justify-center"
        >
          Open on Google Play
        </a>
        <a href={deepLink} className="btn-ghost w-full justify-center">
          Already installed — open the app
        </a>
      </div>

      <p className="text-[11px] text-text-muted text-center mt-4">
        Tip: on your phone, tap <strong>Continue on web</strong> then <strong>Add to Home Screen</strong> to install it like an app.
      </p>
    </div>
  );
}

function CenterLoader() {
  return (
    <div className="flex items-center justify-center py-6 text-text-muted text-sm">
      <Loader2 size={16} className="animate-spin mr-2" /> Loading invite…
    </div>
  );
}
