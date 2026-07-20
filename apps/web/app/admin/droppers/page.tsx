'use client';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Check,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Copy,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { getSession } from '@/lib/auth';
import { api } from '@/lib/api';

interface DropperDetail {
  state: 'active' | 'invited';
  user: {
    id: string;
    email: string;
    status: string;
    mobile: string | null;
    createdAt: string;
    cognitoLinked: boolean;
  } | null;
  profile: {
    employeeId: string;
    firstName: string;
    lastName: string;
    dob: string | null;
    addressLine1: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    tfnLast4: string | null;
    superFundName: string | null;
    superMemberNumber: string | null;
    bankBsb: string | null;
    bankAccountLast4: string | null;
    wwccNumber: string | null;
    wwccExpiresAt: string | null;
    primaryZone: string | null;
    onboardingStatus: 'partial' | 'complete';
    onboardingCompletedAt: string | null;
    employmentType: string | null;
    preferredTransport: string | null;
    ratingAvg: string | null;
    jobsDone: number;
    contractSignedAt: string | null;
    startDate: string | null;
  } | null;
  invite: {
    createdAt: string;
    acceptedAt: string | null;
    expiresAt: string;
  } | null;
  assignments: Array<{
    assignment: {
      id: string;
      status: 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
      targetLeaflets: number | null;
      dropsCompleted: number;
      distanceWalkedM: number;
      startedAt: string | null;
      completedAt: string | null;
      createdAt: string;
    };
    job: {
      id: string;
      jobCode: string;
      title: string;
      leafletCount: number;
      startDate: string | null;
      deadline: string | null;
      status: string;
    };
    subZone: { id: string; label: string } | null;
    client: { businessName: string | null } | null;
  }>;
}

interface Dropper {
  userId: string;
  email: string;
  status: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  primaryZone: string | null;
  onboardingStatus: 'partial' | 'complete';
  ratingAvg: string | null;
  jobsDone: number;
  employmentType: string | null;
  activeAssignments: number;
  state: 'active' | 'invited';
  /** Fine-grained lifecycle state, matches the coloured pill. */
  accountState: 'invited' | 'accepted' | 'onboarding' | 'complete';
  invitedAt?: string;
  invitedExpiresAt?: string;
  /** Present only on invited rows — raw invite id + accept URL for copy/resend. */
  inviteId?: string;
  acceptUrl?: string;
  deepLink?: string;
}

export default function AdminDroppers() {
  const router = useRouter();
  const [droppers, setDroppers] = useState<Dropper[] | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ data: Dropper[] }>('/api/droppers')
      .then((r) => setDroppers(r.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const s = getSession();
    if (!s) return router.replace('/login');
    if (s.role !== 'admin') return router.replace('/dashboard');
    load();
  }, [router, load]);

  const activeCount = droppers?.filter((d) => d.activeAssignments > 0).length ?? 0;
  const completeCount = droppers?.filter((d) => d.onboardingStatus === 'complete').length ?? 0;
  const invitedCount = droppers?.filter((d) => d.state === 'invited').length ?? 0;
  const acceptedCount = droppers?.filter((d) => d.accountState === 'accepted').length ?? 0;

  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Dropper | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, DropperDetail | 'loading' | 'error'>>({});

  async function toggleExpand(d: Dropper) {
    if (expanded === d.userId) {
      setExpanded(null);
      return;
    }
    setExpanded(d.userId);
    if (detail[d.userId] && detail[d.userId] !== 'error') return;
    setDetail((prev) => ({ ...prev, [d.userId]: 'loading' }));
    try {
      const res = await api.get<DropperDetail>(`/api/droppers/${d.userId}`);
      setDetail((prev) => ({ ...prev, [d.userId]: res }));
    } catch {
      setDetail((prev) => ({ ...prev, [d.userId]: 'error' }));
    }
  }

  const [copied, setCopied] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<{ email: string; ok: boolean; msg: string } | null>(null);

  async function copyInviteLink(d: Dropper) {
    if (!d.acceptUrl) return;
    try {
      await navigator.clipboard.writeText(d.acceptUrl);
      setCopied(d.userId);
      setTimeout(() => setCopied((c) => (c === d.userId ? null : c)), 2000);
    } catch {
      window.prompt('Copy this invite link:', d.acceptUrl);
    }
  }

  async function resendInvite(d: Dropper) {
    if (!d.inviteId) return;
    setResending(d.userId);
    try {
      await api.post(`/api/admin/dropper-invites/${d.inviteId}/resend`);
      setResendResult({ email: d.email, ok: true, msg: `Invite re-sent to ${d.email}` });
      load();
    } catch (err) {
      const body = (err as { body?: { message?: unknown } }).body?.message;
      const msg = typeof body === 'string' ? body : (err as Error).message;
      setResendResult({ email: d.email, ok: false, msg });
    } finally {
      setResending(null);
      setTimeout(() => setResendResult((r) => (r?.email === d.email ? null : r)), 5000);
    }
  }

  async function doDelete(d: Dropper) {
    setDeleting(d.userId);
    try {
      await api.delete(`/api/droppers/${d.userId}`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      const body = (err as { body?: { message?: unknown } }).body?.message;
      alert(typeof body === 'string' ? body : (err as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <AdminSidebar active="droppers" />
      <main className="ml-[252px] p-10">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              Droppers{' '}
              <span className="font-serif italic font-normal text-text-secondary">
                — your team.
              </span>
            </h1>
            <p className="text-text-muted text-sm mt-1.5">
              {droppers?.length ?? '—'} total · {invitedCount} invited · {acceptedCount} accepted · {activeCount} working now · {completeCount} fully onboarded
            </p>
          </div>
          <button className="btn-primary" onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} /> Invite dropper
          </button>
        </div>

        <div className="card overflow-hidden">
          {!droppers && <div className="p-6 text-text-muted text-sm">Loading…</div>}
          {droppers && droppers.length === 0 && (
            <div className="p-10 text-center text-text-muted">No droppers yet.</div>
          )}
          {droppers && droppers.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted font-semibold bg-[#FAFBFC] border-b border-border">
                  <th className="py-3.5 px-5">Employee</th>
                  <th className="py-3.5 px-5">Zone</th>
                  <th className="py-3.5 px-5 text-right">Jobs done</th>
                  <th className="py-3.5 px-5 text-right">Rating</th>
                  <th className="py-3.5 px-5 text-right">Active now</th>
                  <th className="py-3.5 px-5 text-right">Status</th>
                  <th className="py-3.5 px-5 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {droppers.map((d) => (
                  <Fragment key={d.userId}>
                  <tr
                    onClick={() => toggleExpand(d)}
                    className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                      expanded === d.userId ? 'bg-bg-muted/60' : 'hover:bg-bg-muted/40'
                    }`}
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <span className="text-text-muted">
                          {expanded === d.userId ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
                        </span>
                        <div
                          className="w-9 h-9 rounded-lg text-white text-xs font-bold flex items-center justify-center shrink-0"
                          style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
                        >
                          {(d.firstName[0] ?? d.email[0] ?? '?').toUpperCase()}
                          {(d.lastName[0] ?? '').toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold">
                            {d.firstName} {d.lastName}
                          </div>
                          <div className="text-xs text-text-muted mt-0.5">
                            {d.employeeId} · {d.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-text-secondary">{d.primaryZone ?? '—'}</td>
                    <td className="py-4 px-5 text-right tabular-nums">{d.jobsDone}</td>
                    <td className="py-4 px-5 text-right tabular-nums">★ {d.ratingAvg ?? '—'}</td>
                    <td className="py-4 px-5 text-right">
                      {d.activeAssignments > 0 ? (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: '#DCFCE7', color: '#15803D' }}
                        >
                          ● {d.activeAssignments} live
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <AccountPill dropper={d} />
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {d.state === 'invited' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyInviteLink(d);
                              }}
                              className="text-text-muted hover:text-primary p-1.5 rounded-md hover:bg-indigo-50"
                              title="Copy invite link"
                            >
                              {copied === d.userId ? (
                                <Check size={14} className="text-emerald-600" />
                              ) : (
                                <LinkIcon size={14} />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                resendInvite(d);
                              }}
                              disabled={resending === d.userId}
                              className="text-text-muted hover:text-primary p-1.5 rounded-md hover:bg-indigo-50 disabled:opacity-40"
                              title="Resend invitation email"
                            >
                              {resending === d.userId ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <RefreshCw size={14} />
                              )}
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(d);
                          }}
                          disabled={deleting === d.userId}
                          className="text-text-muted hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 disabled:opacity-40"
                          title={d.state === 'invited' ? 'Cancel invite' : 'Delete dropper'}
                        >
                          {deleting === d.userId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === d.userId && (
                    <tr className="border-b border-border last:border-0 bg-bg-muted/30">
                      <td colSpan={7} className="p-6">
                        <DetailPanel state={detail[d.userId]} dropper={d} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onCreated={() => load()}
        />
      )}
      {confirmDelete && (
        <ConfirmDeleteModal
          dropper={confirmDelete}
          busy={deleting === confirmDelete.userId}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => doDelete(confirmDelete)}
        />
      )}
      {resendResult && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${
            resendResult.ok
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {resendResult.msg}
        </div>
      )}
    </div>
  );
}

function DetailPanel({
  state,
  dropper,
}: {
  state: DropperDetail | 'loading' | 'error' | undefined;
  dropper: Dropper;
}) {
  if (!state || state === 'loading')
    return (
      <div className="text-sm text-text-muted flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading full profile…
      </div>
    );
  if (state === 'error')
    return <div className="text-sm text-red-600">Couldn't load this dropper's details.</div>;

  const p = state.profile;
  const u = state.user;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      {/* LEFT: profile detail */}
      <div className="space-y-5">
        <Card title="Account">
          <Field label="Email" value={u?.email ?? '—'} />
          <Field label="Mobile" value={u?.mobile ?? '—'} />
          <Field
            label="Signed up"
            value={u?.createdAt ? new Date(u.createdAt).toLocaleString('en-AU') : '—'}
          />
          <Field label="Cognito linked" value={u?.cognitoLinked ? 'Yes' : 'No'} />
          <Field label="Employee ID" value={p?.employeeId ?? '—'} />
        </Card>

        <Card title="Personal">
          <Field label="First name" value={p?.firstName ?? '—'} />
          <Field label="Last name" value={p?.lastName ?? '—'} />
          <Field label="Date of birth" value={p?.dob ?? '—'} />
          <Field label="Preferred transport" value={p?.preferredTransport ?? '—'} />
        </Card>

        <Card title="Address">
          <Field label="Street" value={p?.addressLine1 ?? '—'} />
          <Field
            label="Suburb / state / postcode"
            value={[p?.suburb, p?.state, p?.postcode].filter(Boolean).join(' ') || '—'}
          />
          <Field label="Primary zone" value={p?.primaryZone ?? '—'} />
        </Card>

        <Card title="Emergency contact">
          <Field label="Name" value={p?.emergencyContactName ?? '—'} />
          <Field label="Phone" value={p?.emergencyContactPhone ?? '—'} />
        </Card>

        <Card title="Payroll">
          <Field
            label="TFN"
            value={p?.tfnLast4 ? `•••• ${p.tfnLast4}` : '—'}
            hint={p?.tfnLast4 ? 'Last 4 shown for security' : undefined}
          />
          <Field label="Super fund" value={p?.superFundName ?? '—'} />
          <Field label="Super member #" value={p?.superMemberNumber ?? '—'} />
          <Field label="BSB" value={p?.bankBsb ?? '—'} />
          <Field
            label="Account"
            value={p?.bankAccountLast4 ? `•••• ${p.bankAccountLast4}` : '—'}
          />
          <Field label="Employment type" value={p?.employmentType ?? '—'} />
        </Card>

        <Card title="WWCC">
          <Field label="Number" value={p?.wwccNumber ?? '—'} />
          <Field label="Expires" value={p?.wwccExpiresAt ?? '—'} />
        </Card>

        <Card title="Onboarding">
          <Field label="Status" value={p?.onboardingStatus ?? '—'} />
          <Field
            label="Completed at"
            value={
              p?.onboardingCompletedAt
                ? new Date(p.onboardingCompletedAt).toLocaleString('en-AU')
                : '—'
            }
          />
          <Field label="Contract signed" value={p?.contractSignedAt ? new Date(p.contractSignedAt).toLocaleDateString('en-AU') : '—'} />
          <Field label="Start date" value={p?.startDate ?? '—'} />
        </Card>
      </div>

      {/* RIGHT: performance + assignments */}
      <div className="space-y-5">
        <Card title="Performance">
          <div className="grid grid-cols-2 gap-4 mt-1">
            <Stat label="Jobs done" value={p?.jobsDone?.toString() ?? '0'} />
            <Stat label="Rating" value={p?.ratingAvg ? `★ ${p.ratingAvg}` : '—'} />
          </div>
        </Card>

        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-[.14em] text-text-muted mb-2">
            Assignments ({state.assignments.length})
          </h4>
          {state.assignments.length === 0 ? (
            <p className="text-sm text-text-muted italic">
              No assignments yet.{' '}
              {dropper.accountState === 'complete'
                ? 'Assign from the Assignment Queue.'
                : "They'll appear here once onboarding is complete."}
            </p>
          ) : (
            <ul className="space-y-2">
              {state.assignments.map((a) => (
                <li
                  key={a.assignment.id}
                  className="rounded-xl border border-border bg-white p-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <AssignmentPill status={a.assignment.status} />
                      <span className="text-xs text-text-muted">{a.job.jobCode}</span>
                    </div>
                    <p className="font-semibold text-sm mt-1 truncate">{a.job.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {a.client?.businessName ?? 'Client'}
                      {a.subZone?.label ? ` · ${a.subZone.label}` : ''}
                    </p>
                    <p className="text-[11px] text-text-muted mt-1 tabular-nums">
                      {a.assignment.dropsCompleted} / {a.assignment.targetLeaflets ?? a.job.leafletCount} drops
                      {a.assignment.distanceWalkedM > 0 &&
                        ` · ${(a.assignment.distanceWalkedM / 1000).toFixed(2)} km walked`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Link
                      href={`/admin/track/${a.job.id}`}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Live <ExternalLink size={11} />
                    </Link>
                    <Link
                      href={`/admin/jobs`}
                      className="text-xs text-text-secondary hover:text-primary inline-flex items-center gap-1"
                    >
                      Job page <ExternalLink size={11} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-[.14em] text-text-muted mb-2">
        {title}
      </h4>
      <div className="rounded-xl bg-white border border-border p-4 divide-y divide-border">
        {children}
      </div>
    </div>
  );
}
function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm font-semibold text-right break-all">
        {value}
        {hint && <span className="block text-[10px] text-text-muted font-normal mt-0.5">{hint}</span>}
      </span>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg-muted p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</p>
      <p className="text-lg font-extrabold mt-1 tabular-nums">{value}</p>
    </div>
  );
}
function AssignmentPill({ status }: { status: DropperDetail['assignments'][number]['assignment']['status'] }) {
  const map: Record<typeof status, { bg: string; fg: string; label: string }> = {
    pending: { bg: '#F4F5FB', fg: '#4A4E6B', label: 'Pending' },
    started: { bg: '#FEF3C7', fg: '#92400E', label: 'Live' },
    paused: { bg: '#E0E7FF', fg: '#3730A3', label: 'Paused' },
    completed: { bg: '#DCFCE7', fg: '#15803D', label: '✓ Done' },
    abandoned: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Cancelled' },
  };
  const st = map[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: st.bg, color: st.fg }}
    >
      {st.label}
    </span>
  );
}

function AccountPill({ dropper }: { dropper: Dropper }) {
  const s = dropper.accountState;
  const styles: Record<Dropper['accountState'], { bg: string; fg: string; label: string }> = {
    invited: { bg: '#E0E7FF', fg: '#3730A3', label: 'Invited' },
    accepted: { bg: '#CFFAFE', fg: '#155E75', label: 'Accepted' },
    onboarding: { bg: '#FEF3C7', fg: '#92400E', label: 'Onboarding' },
    complete: { bg: '#DCFCE7', fg: '#15803D', label: 'Complete' },
  };
  const st = styles[s];
  const title =
    s === 'invited' && dropper.invitedExpiresAt
      ? `Expires ${new Date(dropper.invitedExpiresAt).toLocaleDateString('en-AU')}`
      : s === 'accepted'
        ? 'Logged in — profile not filled yet'
        : undefined;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: st.bg, color: st.fg }}
      title={title}
    >
      {st.label}
    </span>
  );
}

function ConfirmDeleteModal({
  dropper,
  busy,
  onCancel,
  onConfirm,
}: {
  dropper: Dropper;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isInvite = dropper.state === 'invited';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <Trash2 size={16} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold">
              {isInvite ? 'Cancel this invite?' : `Delete ${dropper.firstName || dropper.email}?`}
            </h2>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
              {isInvite ? (
                <>
                  The invite link for <strong>{dropper.email}</strong> will stop working. You can send a
                  new invite from the button above.
                </>
              ) : (
                <>
                  Permanently removes their Cognito login, dropper profile, chat history, notifications
                  and GPS/drop history. <strong>Cannot be undone.</strong> Historical completed
                  assignments are also deleted.
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="btn-ghost" disabled={busy}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {isInvite ? 'Cancel invite' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CreateResponse {
  invite: { id: string; email: string };
  acceptUrl: string;
  deepLink: string;
}

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [primaryZone, setPrimaryZone] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateResponse | null>(null);

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
      onCreated();
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Invite dropper</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
            <X size={18} />
          </button>
        </div>

        {!created ? (
          <>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-[.08em] mb-1.5">
              Email
            </label>
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
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-[.08em] mb-1.5">
                  First name
                </label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-[.08em] mb-1.5">
                  Last name
                </label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input w-full" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-[.08em] mb-1.5">
                  Primary zone
                </label>
                <input
                  value={primaryZone}
                  onChange={(e) => setPrimaryZone(e.target.value)}
                  placeholder="e.g. Bondi"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-[.08em] mb-1.5">
                  Expires in
                </label>
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

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={send}
              disabled={busy || !email || !firstName}
              className="btn-primary w-full justify-center mt-5 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send invite
            </button>
          </>
        ) : (
          <div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 mb-4">
              <p className="text-sm font-semibold text-emerald-800">
                Invite sent to {created.invite.email}
              </p>
              <p className="text-xs text-emerald-700/80 mt-1">
                Also share these links directly if they don't get the email.
              </p>
            </div>

            <div className="space-y-2">
              <LinkRow label="Web link" value={created.acceptUrl} onCopy={copy} />
              <LinkRow label="Mobile deep link" value={created.deepLink} onCopy={copy} />
            </div>

            <button onClick={onClose} className="btn-primary w-full justify-center mt-5">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LinkRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2 text-xs">
      <span className="text-text-muted font-semibold w-28 shrink-0">{label}</span>
      <span className="text-text-secondary font-mono truncate flex-1">{value}</span>
      <button onClick={() => onCopy(value)} className="text-primary hover:text-primary/80" title="Copy">
        <Copy size={14} />
      </button>
    </div>
  );
}
