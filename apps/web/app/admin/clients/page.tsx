'use client';
import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { getSession } from '@/lib/auth';
import { api } from '@/lib/api';

interface Client {
  userId: string;
  email: string;
  status: string;
  createdAt: string;
  businessName: string | null;
  industry: string | null;
  abn: string | null;
  suburb: string | null;
  state: string | null;
  mobile: string | null;
  totalJobs: number;
  totalSpendCents: number;
}

interface ClientDetail {
  user: {
    id: string;
    email: string;
    status: string;
    mobile: string | null;
    createdAt: string;
    cognitoLinked: boolean;
  };
  business: {
    businessName: string;
    industry: string;
    businessSize: string | null;
    abn: string | null;
    gstRegistered: boolean;
    addressLine1: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    mobile: string | null;
    logoS3Key: string | null;
    stripeCustomerId: string | null;
  } | null;
  spend: {
    totalPaidCents: number;
    totalPendingCents: number;
    refundedCents: number;
  };
  campaigns: Array<{
    job: {
      id: string;
      jobCode: string;
      title: string;
      leafletCount: number;
      campaignType: string;
      startDate: string | null;
      deadline: string | null;
      status: string;
      createdAt: string;
      paidAt: string | null;
    };
    payment: {
      status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partial_refund' | null;
      amountTotalCents: number | null;
    } | null;
    assignmentsCount: number;
    assignedLeaflets: number;
    dropsCompleted: number;
  }>;
}

function fmtCents(cents: number) {
  return (cents / 100).toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  });
}

export default function AdminClients() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, ClientDetail | 'loading' | 'error'>>({});

  useEffect(() => {
    const s = getSession();
    if (!s) return router.replace('/login');
    if (s.role !== 'admin') return router.replace('/dashboard');
    api
      .get<{ data: Client[] }>('/api/admin/clients')
      .then((r) => setClients(r.data))
      .catch(console.error);
  }, [router]);

  async function toggleExpand(c: Client) {
    if (expanded === c.userId) {
      setExpanded(null);
      return;
    }
    setExpanded(c.userId);
    if (detail[c.userId] && detail[c.userId] !== 'error') return;
    setDetail((prev) => ({ ...prev, [c.userId]: 'loading' }));
    try {
      const res = await api.get<ClientDetail>(`/api/admin/clients/${c.userId}`);
      setDetail((prev) => ({ ...prev, [c.userId]: res }));
    } catch {
      setDetail((prev) => ({ ...prev, [c.userId]: 'error' }));
    }
  }

  const totalSpend = clients?.reduce((n, c) => n + Number(c.totalSpendCents ?? 0), 0) ?? 0;
  const activeCount = clients?.filter((c) => c.totalJobs > 0).length ?? 0;

  return (
    <div>
      <AdminSidebar active="clients" />
      <main className="ml-[252px] p-10">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              Clients{' '}
              <span className="font-serif italic font-normal text-text-secondary">
                — every business you serve.
              </span>
            </h1>
            <p className="text-text-muted text-sm mt-1.5">
              {clients?.length ?? '—'} accounts · {activeCount} with campaigns ·{' '}
              {fmtCents(totalSpend)} lifetime revenue
            </p>
          </div>
        </div>

        <div className="card overflow-hidden">
          {!clients && <div className="p-6 text-text-muted text-sm">Loading…</div>}
          {clients && clients.length === 0 && (
            <div className="p-10 text-center text-text-muted">No client accounts yet.</div>
          )}
          {clients && clients.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted font-semibold bg-[#FAFBFC] border-b border-border">
                  <th className="py-3.5 px-5">Business</th>
                  <th className="py-3.5 px-5">Industry</th>
                  <th className="py-3.5 px-5">Location</th>
                  <th className="py-3.5 px-5 text-right">Campaigns</th>
                  <th className="py-3.5 px-5 text-right">Lifetime spend</th>
                  <th className="py-3.5 px-5 text-right">Joined</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <Fragment key={c.userId}>
                    <tr
                      onClick={() => toggleExpand(c)}
                      className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                        expanded === c.userId ? 'bg-bg-muted/60' : 'hover:bg-bg-muted/40'
                      }`}
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <span className="text-text-muted">
                            {expanded === c.userId ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRightIcon size={14} />
                            )}
                          </span>
                          <div
                            className="w-9 h-9 rounded-lg text-white text-xs font-bold flex items-center justify-center shrink-0"
                            style={{ background: 'linear-gradient(135deg,#0EA5E9,#4F46E5)' }}
                          >
                            {(c.businessName?.[0] ?? c.email[0] ?? '?').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold">
                              {c.businessName ?? (
                                <span className="text-text-muted">— no business name</span>
                              )}
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">
                              {c.email}
                              {c.abn ? ` · ABN ${c.abn}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-text-secondary capitalize">
                        {c.industry?.replace(/_/g, ' ') ?? '—'}
                      </td>
                      <td className="py-4 px-5 text-text-secondary">
                        {[c.suburb, c.state].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="py-4 px-5 text-right tabular-nums">{c.totalJobs}</td>
                      <td className="py-4 px-5 text-right tabular-nums font-semibold">
                        {fmtCents(Number(c.totalSpendCents ?? 0))}
                      </td>
                      <td className="py-4 px-5 text-right text-xs text-text-muted">
                        {new Date(c.createdAt).toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                    {expanded === c.userId && (
                      <tr className="border-b border-border last:border-0 bg-bg-muted/30">
                        <td colSpan={6} className="p-6">
                          <DetailPanel state={detail[c.userId]} />
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
    </div>
  );
}

function DetailPanel({ state }: { state: ClientDetail | 'loading' | 'error' | undefined }) {
  if (!state || state === 'loading')
    return (
      <div className="text-sm text-text-muted flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading client detail…
      </div>
    );
  if (state === 'error')
    return <div className="text-sm text-red-600">Couldn't load this client's details.</div>;

  const { user, business, spend, campaigns } = state;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      {/* LEFT: account + business */}
      <div className="space-y-5">
        <Card title="Account">
          <Field label="Email" value={user.email} />
          <Field label="Mobile" value={user.mobile ?? business?.mobile ?? '—'} />
          <Field
            label="Signed up"
            value={new Date(user.createdAt).toLocaleString('en-AU')}
          />
          <Field label="Cognito linked" value={user.cognitoLinked ? 'Yes' : 'No'} />
          <Field label="Status" value={user.status} />
        </Card>

        <Card title="Business">
          <Field label="Business name" value={business?.businessName ?? '—'} />
          <Field
            label="Industry"
            value={business?.industry ? business.industry.replace(/_/g, ' ') : '—'}
          />
          <Field label="Size" value={business?.businessSize ?? '—'} />
          <Field label="ABN" value={business?.abn ?? '—'} />
          <Field
            label="GST registered"
            value={business ? (business.gstRegistered ? 'Yes' : 'No') : '—'}
          />
        </Card>

        <Card title="Address">
          <Field label="Street" value={business?.addressLine1 ?? '—'} />
          <Field
            label="Suburb / state / postcode"
            value={
              [business?.suburb, business?.state, business?.postcode]
                .filter(Boolean)
                .join(' ') || '—'
            }
          />
        </Card>

        <Card title="Billing">
          <Field
            label="Stripe customer"
            value={business?.stripeCustomerId ?? '— not created yet'}
            hint={
              business?.stripeCustomerId
                ? 'Charged for online payments'
                : 'Bank-transfer only until Stripe onboarding'
            }
          />
        </Card>
      </div>

      {/* RIGHT: spend + campaigns */}
      <div className="space-y-5">
        <Card title="Spend">
          <div className="grid grid-cols-3 gap-3 mt-1">
            <Stat label="Paid" value={fmtCents(spend.totalPaidCents)} tint="emerald" />
            <Stat label="Pending" value={fmtCents(spend.totalPendingCents)} tint="amber" />
            <Stat label="Refunded" value={fmtCents(spend.refundedCents)} tint="slate" />
          </div>
        </Card>

        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-[.14em] text-text-muted mb-2">
            Campaigns ({campaigns.length})
          </h4>
          {campaigns.length === 0 ? (
            <p className="text-sm text-text-muted italic">This client hasn't created any campaigns yet.</p>
          ) : (
            <ul className="space-y-2">
              {campaigns.map((c) => (
                <li
                  key={c.job.id}
                  className="rounded-xl border border-border bg-white p-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <JobStatusPill status={c.job.status} />
                      {c.payment && <PaymentPill status={c.payment.status} />}
                      <span className="text-xs text-text-muted">{c.job.jobCode}</span>
                    </div>
                    <p className="font-semibold text-sm mt-1 truncate">{c.job.title}</p>
                    <p className="text-xs text-text-muted mt-0.5 capitalize">
                      {c.job.campaignType.replace(/_/g, ' ')}
                      {c.job.startDate ? ` · starts ${c.job.startDate}` : ''}
                    </p>
                    <p className="text-[11px] text-text-muted mt-1 tabular-nums">
                      {c.dropsCompleted} / {c.job.leafletCount.toLocaleString()} drops
                      {c.assignmentsCount > 0 &&
                        ` · ${c.assignmentsCount} dropper${c.assignmentsCount === 1 ? '' : 's'} assigned`}
                      {c.payment?.amountTotalCents != null &&
                        ` · ${fmtCents(c.payment.amountTotalCents)}`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Link
                      href={`/admin/track/${c.job.id}`}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Live <ExternalLink size={11} />
                    </Link>
                    <Link
                      href="/admin/invoices"
                      className="text-xs text-text-secondary hover:text-primary inline-flex items-center gap-1"
                    >
                      Invoice <ExternalLink size={11} />
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
      <span className="text-sm font-semibold text-right break-all capitalize">
        {value}
        {hint && (
          <span className="block text-[10px] text-text-muted font-normal mt-0.5">{hint}</span>
        )}
      </span>
    </div>
  );
}
function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: 'emerald' | 'amber' | 'slate';
}) {
  const bg =
    tint === 'emerald' ? 'bg-emerald-50' : tint === 'amber' ? 'bg-amber-50' : 'bg-slate-100';
  const fg =
    tint === 'emerald'
      ? 'text-emerald-700'
      : tint === 'amber'
        ? 'text-amber-700'
        : 'text-slate-700';
  return (
    <div className={`rounded-lg ${bg} p-3`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${fg}`}>{label}</p>
      <p className="text-base font-extrabold mt-1 tabular-nums">{value}</p>
    </div>
  );
}
function JobStatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    draft: { bg: '#F4F5FB', fg: '#4A4E6B', label: 'Draft' },
    paid_unassigned: { bg: '#FEF3C7', fg: '#92400E', label: 'Paid · unassigned' },
    assigned: { bg: '#E0E7FF', fg: '#3730A3', label: 'Assigned' },
    upcoming: { bg: '#E0E7FF', fg: '#3730A3', label: 'Upcoming' },
    active: { bg: '#DCFCE7', fg: '#15803D', label: 'Active' },
    completed: { bg: '#DCFCE7', fg: '#15803D', label: '✓ Complete' },
    cancelled: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Cancelled' },
  };
  const st = map[status] ?? { bg: '#F4F5FB', fg: '#4A4E6B', label: status };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: st.bg, color: st.fg }}
    >
      {st.label}
    </span>
  );
}
function PaymentPill({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    pending: { bg: '#FEF3C7', fg: '#92400E', label: 'Pending' },
    succeeded: { bg: '#DCFCE7', fg: '#15803D', label: 'Paid' },
    failed: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Failed' },
    refunded: { bg: '#F4F5FB', fg: '#4A4E6B', label: 'Refunded' },
    partial_refund: { bg: '#F4F5FB', fg: '#4A4E6B', label: 'Part refund' },
  };
  const st = map[status];
  if (!st) return null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: st.bg, color: st.fg }}
    >
      {st.label}
    </span>
  );
}
