'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Loader2, Mail } from 'lucide-react';
import { setSession, type Role } from '@/lib/auth';
import { Logo } from '@/components/Logo';

type Step = 'form' | 'verify';

interface SignupRequestResult {
  requiresVerification: boolean;
  email: string;
  deliveryDestination?: string;
  message?: string;
}

interface ConfirmResult {
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

export default function Signup() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Verify step state
  const [code, setCode] = useState('');
  const [delivery, setDelivery] = useState('');
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, mobile, password, acceptedTerms }),
      });
      const body = (await res.json()) as SignupRequestResult | { message?: string };
      if (!res.ok) throw new Error((body as { message?: string }).message ?? 'Could not create account');
      const b = body as SignupRequestResult;
      setDelivery(b.deliveryDestination ?? email);
      setStep('verify');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendNotice(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/confirm-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password }),
      });
      const body = (await res.json()) as ConfirmResult | { message?: string };
      if (!res.ok) throw new Error((body as { message?: string }).message ?? 'Invalid code');
      const b = body as ConfirmResult;
      if (!b.userId || !b.role) {
        throw new Error(b.message ?? 'Account confirmed but no DropTrack profile attached.');
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
      router.push('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setResendNotice(null);
    setError(null);
    try {
      const res = await fetch('/api/auth/resend-signup-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json()) as { deliveryDestination?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? 'Resend failed');
      setResendNotice(`We sent a new code to ${body.deliveryDestination ?? email}.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left panel */}
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
            Verified leaflet distribution,{' '}
            <span
              style={{
                background: 'linear-gradient(90deg, #A3E635, #FFFFFF)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              powered by AI.
            </span>
          </h1>

          <div className="mt-10 flex flex-col gap-5 max-w-md">
            <Bullet title="Every drop GPS-verified" body="Fraud Shield blocks spoofed locations in real time" />
            <Bullet title="AI sets your zone & price" body="Smart Zones counts letterboxes and suggests fair cost" />
            <Bullet title="Beautiful campaign reports" body="AI summary delivered when your job completes" />
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

        {step === 'form' ? (
          <>
            <h2 className="text-3xl font-bold tracking-tight">Create your account</h2>
            <p className="mt-2 mb-7 text-text-muted text-sm">
              Start your first campaign in under 5 minutes.
            </p>

            {error && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={submitSignup} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name">
                  <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" placeholder="Sarah" autoComplete="given-name" />
                </Field>
                <Field label="Last name">
                  <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" placeholder="Nguyen" autoComplete="family-name" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="sarah@belleproperty.com.au" autoComplete="email" />
                </Field>
                <Field label="Mobile">
                  <input value={mobile} onChange={(e) => setMobile(e.target.value)} className="input" placeholder="04xx xxx xxx" autoComplete="tel" />
                </Field>
              </div>

              <Field label="Password">
                <input type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="At least 10 characters" autoComplete="new-password" />
              </Field>

              <label className="flex items-start gap-3 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-border accent-primary shrink-0"
                />
                <span className="text-xs text-text-secondary leading-relaxed">
                  I agree to the{' '}
                  <a href="https://droptrack.com.au/terms" target="_blank" rel="noopener" className="text-primary font-semibold hover:underline">Terms of Service</a>{' '}
                  and acknowledge the{' '}
                  <a href="https://droptrack.com.au/privacy" target="_blank" rel="noopener" className="text-primary font-semibold hover:underline">Privacy Policy</a>,
                  including that DropTrack owns all GPS and tracking data collected during campaigns.
                </span>
              </label>

              <button type="submit" disabled={submitting || !acceptedTerms} className="btn-primary justify-center py-3.5 mt-3 disabled:opacity-50">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {submitting ? 'Creating your account…' : 'Create account'}
              </button>

              <p className="text-center mt-3 text-text-muted text-xs">
                Already have an account?{' '}
                <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
              </p>
            </form>
          </>
        ) : (
          <>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
              style={{
                background: 'linear-gradient(135deg,#6366f1,#a855f7,#a3e635)',
                boxShadow: '0 14px 30px -10px rgba(99,102,241,0.5)',
              }}
            >
              <Mail size={20} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Check your email</h2>
            <p className="mt-2 mb-7 text-text-muted text-sm">
              We emailed a 6-digit verification code to{' '}
              <span className="text-text-primary font-semibold">{delivery}</span>. Enter it below to
              finish creating your account.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
            {resendNotice && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                {resendNotice}
              </div>
            )}

            <form onSubmit={confirmCode} className="flex flex-col gap-3">
              <Field label="Verification code">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="input text-2xl font-mono tracking-[.4em] text-center"
                  placeholder="000000"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </Field>

              <button type="submit" disabled={submitting || code.length < 6} className="btn-primary justify-center py-3.5 mt-2 disabled:opacity-50">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {submitting ? 'Verifying…' : 'Verify & continue'}
              </button>

              <div className="flex justify-between mt-3 text-xs">
                <button type="button" onClick={() => { setStep('form'); setCode(''); setError(null); }} className="text-text-muted hover:text-text-primary">
                  ← Use a different email
                </button>
                <button type="button" onClick={resend} className="text-primary font-semibold hover:underline">
                  Resend code
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold text-text-secondary">
      {label}
      <div className="mt-1">{children}</div>
    </label>
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
