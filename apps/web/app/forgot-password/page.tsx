'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, Loader2, Mail } from 'lucide-react';
import { Logo } from '@/components/Logo';

type Step = 'request' | 'confirm' | 'done';

interface ErrorBody {
  message?: string;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json()) as ErrorBody;
      if (!res.ok) throw new Error(body.message ?? 'Could not start reset');
      setStep('confirm');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/confirm-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const body = (await res.json()) as ErrorBody;
      if (!res.ok) throw new Error(body.message ?? 'Could not confirm');
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
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
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight">
            Reset your password.
          </h1>
          <p className="mt-6 text-white/70 text-lg max-w-md">
            We'll email you a 6-digit code. Enter it on the next screen with your new password.
          </p>
        </div>
        <p className="text-xs text-white/50">© 2026 DropTrack · Privacy Act 1988 compliant</p>
      </aside>

      <main className="p-12 flex flex-col justify-center max-w-[480px] w-full mx-auto">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="text-xs text-text-muted hover:text-text-primary font-medium flex items-center gap-1.5 mb-6 self-start"
        >
          <ArrowLeft size={12} /> Back to sign-in
        </button>

        <h2 className="text-2xl font-bold">Forgot password</h2>
        <p className="mt-2 mb-6 text-text-muted text-sm">
          {step === 'request' &&
            'Enter your email — we\'ll send you a reset code.'}
          {step === 'confirm' &&
            `Code sent to ${email}. Check your inbox.`}
          {step === 'done' && 'Password updated. You can sign in now.'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 'request' && (
          <form onSubmit={requestCode} className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-text-secondary">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full border border-border rounded-xl px-4 py-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary"
                placeholder="you@agency.com.au"
                autoComplete="email"
              />
            </label>
            <button type="submit" disabled={submitting} className="btn-primary mt-2 justify-center">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <Mail size={14} /> Send reset code
            </button>
          </form>
        )}

        {step === 'confirm' && (
          <form onSubmit={confirmReset} className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-text-secondary">
              Reset code
              <input
                type="text"
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full border border-border rounded-xl px-4 py-3 text-base font-mono tracking-[.3em] focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary"
                placeholder="123456"
                autoComplete="one-time-code"
              />
            </label>
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
                placeholder="At least 8 characters"
              />
            </label>
            <button type="submit" disabled={submitting} className="btn-primary mt-2 justify-center">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <KeyRound size={14} /> Reset password
            </button>
            <button
              type="button"
              onClick={() => setStep('request')}
              className="text-xs text-text-muted hover:text-text-primary mt-1"
            >
              Didn't get a code? Resend
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="flex flex-col gap-3">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
              Your password has been updated. Sign in to continue.
            </div>
            <Link href="/login" className="btn-primary justify-center">
              Go to sign-in
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
