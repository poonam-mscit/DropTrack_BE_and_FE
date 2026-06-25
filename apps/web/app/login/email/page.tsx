'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { setSession, type Role } from '@/lib/auth';
import { Logo } from '@/components/Logo';

type Step = 'request' | 'verify';

interface RequestCodeResult {
  session: string;
  deliveryDestination?: string;
}

interface VerifyResult {
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

const ROLE_HOME: Record<Role, string> = {
  client: '/dashboard',
  admin: '/admin/jobs',
  dropper: '/dashboard',
};

export default function EmailOtpPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [session, setSession_] = useState('');
  const [delivery, setDelivery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json()) as RequestCodeResult | { message?: string };
      if (!res.ok) throw new Error((body as { message?: string }).message ?? 'Could not send code');
      const r = body as RequestCodeResult;
      setSession_(r.session);
      setDelivery(r.deliveryDestination ?? email);
      setStep('verify');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, session }),
      });
      const body = (await res.json()) as VerifyResult | { message?: string };
      if (!res.ok) throw new Error((body as { message?: string }).message ?? 'Invalid code');
      const b = body as VerifyResult;
      if (!b.userId || !b.role) {
        throw new Error(b.message ?? 'Logged in but no DropTrack profile is linked to this email.');
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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left panel */}
      <aside
        className="relative p-12 text-white flex flex-col justify-between"
        style={{
          background:
            'radial-gradient(800px circle at 100% 100%, rgba(124,58,237,.45), transparent 55%), linear-gradient(135deg, #4f46e5 0%, #3730a3 50%, #1e1b4b 100%)',
        }}
      >
        <Logo size={40} className="text-white" />

        <div>
          <h1 className="text-[40px] font-extrabold leading-[1.1] tracking-tight max-w-md">
            Signing back in —{' '}
            <span
              style={{
                background: 'linear-gradient(90deg, #A3E635, #FFFFFF)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              no password needed.
            </span>
          </h1>

          <div className="mt-10 flex flex-col gap-5 max-w-md">
            <Bullet
              title="Passwordless & safer"
              body="One-time codes can't be reused or phished"
            />
            <Bullet
              title="Codes expire in 10 minutes"
              body="Short-lived & tied to your device"
            />
            <Bullet
              title="AU data residency"
              body="All authentication processed in Sydney"
            />
          </div>
        </div>

        <p className="text-xs text-white/60">
          © 2026 DropTrack · Privacy Act 1988 compliant · AU data residency
        </p>
      </aside>

      {/* Right panel */}
      <main className="p-12 flex flex-col justify-center max-w-[560px] w-full mx-auto">
        <Link
          href="/login"
          className="text-sm text-text-muted hover:text-text-primary flex items-center gap-1.5 mb-7 self-start"
        >
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
          style={{
            background: 'linear-gradient(135deg,#6366f1,#a855f7,#a3e635)',
            boxShadow: '0 14px 30px -10px rgba(99,102,241,0.5)',
          }}
        >
          <Mail size={20} className="text-white" />
        </div>

        <h2 className="text-3xl font-bold tracking-tight">
          {step === 'request' ? 'Sign in with email' : 'Enter your code'}
        </h2>
        <p className="mt-2 mb-7 text-text-muted text-sm max-w-md">
          {step === 'request' ? (
            <>
              Enter the email tied to your DropTrack account. We'll send a 6-digit code — no
              password needed.
            </>
          ) : (
            <>
              We emailed a 6-digit code to <span className="text-text-primary font-semibold">{delivery}</span>.
              It expires in 10 minutes.
            </>
          )}
        </p>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 'request' ? (
          <form onSubmit={requestCode} className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-text-secondary">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input mt-1"
                placeholder="sarah@belleproperty.com.au"
                autoComplete="email"
              />
            </label>
            <button type="submit" disabled={submitting} className="btn-primary justify-center py-3.5 mt-2">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {submitting ? 'Sending…' : 'Send me a code'}
            </button>
            <p className="text-xs text-text-muted mt-3">
              By continuing you agree to our{' '}
              <a href="https://droptrack.com.au/terms" target="_blank" rel="noopener" className="text-primary font-semibold hover:underline">
                Terms
              </a>{' '}
              and{' '}
              <a href="https://droptrack.com.au/privacy" target="_blank" rel="noopener" className="text-primary font-semibold hover:underline">
                Privacy Policy
              </a>
              .
            </p>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-text-secondary">
              6-digit code
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="input mt-1 text-2xl font-mono tracking-[.4em] text-center"
                placeholder="000000"
                autoComplete="one-time-code"
                autoFocus
              />
            </label>
            <button type="submit" disabled={submitting || code.length < 6} className="btn-primary justify-center py-3.5 mt-2 disabled:opacity-50">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {submitting ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('request');
                setCode('');
                setError(null);
              }}
              className="text-xs text-text-muted hover:text-text-primary mt-2"
            >
              ← Use a different email
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

function Bullet({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.18)',
        }}
      >
        <CheckCircle2 size={14} className="text-lime-300" />
      </div>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="text-sm text-white/65 leading-relaxed mt-0.5">{body}</p>
      </div>
    </div>
  );
}
