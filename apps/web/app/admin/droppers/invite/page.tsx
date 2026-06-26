'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Loader2, Send } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';

interface Invite {
  id: string;
  email: string;
  prefill: { firstName?: string; lastName?: string; primaryZone?: string } | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}
interface CreatedInvite extends Invite {}
interface CreateResponse {
  invite: CreatedInvite;
  acceptUrl: string;
  deepLink: string;
}

export default function AdminInviteDropper() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [primaryZone, setPrimaryZone] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateResponse | null>(null);

  const [rows, setRows] = useState<Invite[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: Invite[] }>('/api/admin/dropper-invites');
      setRows(res.data ?? []);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace('/login');
      return;
    }
    if (s.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }
    void load();
  }, [router, load]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<CreateResponse>('/api/admin/dropper-invites', {
        email,
        firstName,
        lastName: lastName || undefined,
        primaryZone: primaryZone || undefined,
        expiresInDays,
      });
      setCreated(res);
      void load();
      setEmail('');
      setFirstName('');
      setLastName('');
      setPrimaryZone('');
    } catch (err) {
      const body = (err as { body?: { message?: unknown } }).body?.message;
      setError(typeof body === 'string' ? body : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text);
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
      <AppSidebar />
      <main className="p-8 lg:p-10 max-w-[1100px]">
        <a href="/campaigns" className="text-sm text-text-muted inline-flex items-center gap-1.5 hover:text-text-primary">
          <ArrowLeft size={14} /> Back
        </a>
        <h1 className="mt-3 text-[40px] leading-[1.05] font-bold tracking-tight">
          Invite dropper{' '}
          <span className="font-serif italic font-normal text-text-secondary">— send a sign-up link.</span>
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Creates a one-time link. Until they accept, the email stays unclaimed.
        </p>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6 mt-7">
          {/* Form */}
          <section className="bg-white rounded-2xl border border-border shadow-[0_2px_6px_rgba(11,13,18,.04)] p-6">
            <h3 className="font-bold text-base mb-4">New invite</h3>
            <Label>Email</Label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="input w-full"
              autoComplete="off"
            />

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label>First name</Label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input w-full" />
              </div>
              <div>
                <Label>Last name <span className="text-text-muted font-normal">(optional)</span></Label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input w-full" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label>Primary zone</Label>
                <input
                  value={primaryZone}
                  onChange={(e) => setPrimaryZone(e.target.value)}
                  placeholder="e.g. Bondi / Eastern Suburbs"
                  className="input w-full"
                />
              </div>
              <div>
                <Label>Expires in</Label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="input w-full"
                >
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>
            </div>

            <button
              onClick={send}
              disabled={busy || !email || !firstName}
              className="btn-primary w-full justify-center mt-5 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Generate invite
            </button>

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
            )}

            {created && (
              <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-sm font-semibold text-emerald-800">
                  Invite created for {created.invite.email}
                </p>
                <p className="text-xs text-emerald-700/80 mt-1">Share one of the links below.</p>

                <div className="mt-3 space-y-2">
                  <LinkRow label="Web link" value={created.acceptUrl} onCopy={copy} />
                  <LinkRow label="Mobile deep link" value={created.deepLink} onCopy={copy} />
                </div>
              </div>
            )}
          </section>

          {/* Existing invites */}
          <section className="bg-white rounded-2xl border border-border shadow-[0_2px_6px_rgba(11,13,18,.04)] p-6">
            <h3 className="font-bold text-base mb-4">Recent invites</h3>
            {rows === null ? (
              <p className="text-sm text-text-muted">
                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
              </p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-text-muted">No invites yet.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => {
                  const expired = new Date(r.expiresAt) < new Date();
                  const accepted = !!r.acceptedAt;
                  return (
                    <div key={r.id} className="p-3 rounded-xl border border-border">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold truncate">{r.email}</p>
                        <StatusPill accepted={accepted} expired={expired} />
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        {r.prefill?.firstName ?? ''} {r.prefill?.lastName ?? ''}
                        {r.prefill?.primaryZone ? ` · ${r.prefill.primaryZone}` : ''}
                      </p>
                      <p className="text-[11px] text-text-muted mt-1">
                        Sent {new Date(r.createdAt).toLocaleDateString('en-AU')} ·{' '}
                        {accepted
                          ? `Accepted ${new Date(r.acceptedAt!).toLocaleDateString('en-AU')}`
                          : expired
                            ? 'Expired'
                            : `Expires ${new Date(r.expiresAt).toLocaleDateString('en-AU')}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-[.08em]">{children}</p>;
}

function LinkRow({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs">
      <span className="text-emerald-700/70 font-semibold w-32 shrink-0">{label}</span>
      <span className="text-text-secondary font-mono truncate flex-1">{value}</span>
      <button onClick={() => onCopy(value)} className="text-emerald-700 hover:text-emerald-900" title="Copy">
        <Copy size={14} />
      </button>
    </div>
  );
}

function StatusPill({ accepted, expired }: { accepted: boolean; expired: boolean }) {
  if (accepted) return <span className="text-[10px] font-bold uppercase tracking-[.12em] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Accepted</span>;
  if (expired) return <span className="text-[10px] font-bold uppercase tracking-[.12em] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">Expired</span>;
  return <span className="text-[10px] font-bold uppercase tracking-[.12em] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pending</span>;
}
