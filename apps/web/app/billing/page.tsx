'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';

type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partial_refund';

interface PaymentRow {
  id: string;
  invoiceNumber: string;
  jobCode: string;
  jobTitle: string;
  amountTotalCents: number;
  status: PaymentStatus;
  receiptUrl: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  data: PaymentRow[];
}

type TabKey = 'all' | 'paid' | 'refunds';
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'refunds', label: 'Refunds' },
];

const GST_PCT = 0.1; // hard-coded for display only; backend computes the canonical numbers

export default function BillingPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('all');

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    void load();
  }, [router]);

  async function load() {
    try {
      const res = await api.get<ListResponse>('/api/me/payments');
      setRows(res.data ?? []);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // ── Aggregations ──
  const stats = useMemo(() => {
    const succeeded = (rows ?? []).filter((r) => r.status === 'succeeded');
    const totalCents = succeeded.reduce((acc, r) => acc + r.amountTotalCents, 0);

    // Australian financial year: Jul 1 → Jun 30
    const now = new Date();
    const fyStart = new Date(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1, 6, 1);
    const fyEnd = new Date(now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear(), 5, 30, 23, 59, 59);
    const fyLabel = `${fyEnd.getFullYear()} financial year`;

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthLabel = thisMonthStart.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

    const thisMonth = succeeded.filter((r) => new Date(r.createdAt) >= thisMonthStart);
    const thisMonthCents = thisMonth.reduce((acc, r) => acc + r.amountTotalCents, 0);

    const ytd = succeeded.filter((r) => {
      const d = new Date(r.createdAt);
      return d >= fyStart && d <= fyEnd;
    });
    const ytdCents = ytd.reduce((acc, r) => acc + r.amountTotalCents, 0);

    // GST embedded in the totals: total = (1 + gstPct) × net  →  gst = total × gstPct / (1 + gstPct)
    const gstCents = Math.round((ytdCents * GST_PCT) / (1 + GST_PCT));

    // Default card (any most-recent succeeded payment with card info).
    const cardSource = [...succeeded].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];

    return {
      thisMonthCents,
      thisMonthLabel,
      thisMonthCount: thisMonth.length,
      ytdCents,
      fyLabel,
      gstCents,
      defaultCardBrand: cardSource?.cardBrand ?? null,
      defaultCardLast4: cardSource?.cardLast4 ?? null,
      hasAnySucceeded: succeeded.length > 0,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (tab === 'all') return rows;
    if (tab === 'paid') return rows.filter((r) => r.status === 'succeeded');
    if (tab === 'refunds') return rows.filter((r) => r.status === 'refunded' || r.status === 'partial_refund');
    return rows;
  }, [rows, tab]);

  return (
    <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
      <AppSidebar active="billing" />

      <main className="p-8 lg:p-10 max-w-[1280px]">
        {/* ── Header ── */}
        <header className="flex items-start justify-between gap-6 mb-7 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-[44px] leading-[1.05] font-bold tracking-tight">
              Billing{' '}
              <span className="font-serif italic font-normal text-text-secondary">
                — invoices, methods &amp; spend.
              </span>
            </h1>
            <p className="mt-3 text-sm text-text-muted">
              Tax invoices issued in AUD · GST registered (10%)
            </p>
          </div>
          <button
            className="btn-ghost h-11 disabled:opacity-50"
            type="button"
            onClick={() => downloadStatementCsv(filtered)}
            disabled={!rows || filtered.length === 0}
            title={!rows || filtered.length === 0 ? 'Nothing to download yet' : 'Download CSV of the current view'}
          >
            <Download size={14} /> Download statement
          </button>
        </header>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Stat cards ── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-7">
          <StatCard
            label="Spent this month"
            value={fmtCents(stats.thisMonthCents)}
            hint={`${stats.thisMonthLabel} · ${stats.thisMonthCount} campaign${stats.thisMonthCount === 1 ? '' : 's'}`}
            loading={rows === null}
          />
          <StatCard
            label="Spent YTD"
            value={fmtCents(stats.ytdCents)}
            hint={stats.fyLabel}
            loading={rows === null}
          />
          <StatCard
            label="GST collected"
            value={fmtCents(stats.gstCents)}
            hint="10% incl. in totals"
            loading={rows === null}
          />
        </section>

        {/* ── Invoice history ── */}
        <section className="bg-white rounded-2xl border border-border shadow-[0_2px_6px_rgba(11,13,18,.04)] overflow-hidden">
          <div className="px-5 lg:px-6 pt-5 lg:pt-6 pb-3 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-bold text-lg tracking-tight">Invoice history</h2>
            <div className="flex bg-bg-muted/60 rounded-xl p-1 gap-0.5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    tab === t.key
                      ? 'bg-white text-text-primary shadow-[0_1px_3px_rgba(11,13,18,.08)]'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {rows === null ? (
            <div className="p-12 text-center text-sm text-text-muted">
              <Loader2 size={16} className="inline-block animate-spin mr-2" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyInvoices hasAny={(rows?.length ?? 0) > 0} tab={tab} />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-[.15em] text-text-muted font-bold">
                <tr className="border-t border-border">
                  <th className="text-left px-5 lg:px-6 py-3 font-bold">Invoice</th>
                  <th className="text-left px-3 py-3 font-bold">Campaign</th>
                  <th className="text-left px-3 py-3 font-bold">Date</th>
                  <th className="text-left px-3 py-3 font-bold">Status</th>
                  <th className="text-right px-3 py-3 font-bold">Amount</th>
                  <th className="text-right px-5 lg:px-6 py-3 font-bold">PDF</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-bg-muted/20">
                    <td className="px-5 lg:px-6 py-4 font-mono text-text-secondary text-xs whitespace-nowrap">
                      #{p.invoiceNumber || '—'}
                    </td>
                    <td className="px-3 py-4">
                      <div className="font-semibold truncate max-w-[260px]">{p.jobTitle}</div>
                      <div className="text-[11px] text-text-muted font-mono">{p.jobCode}</div>
                    </td>
                    <td className="px-3 py-4 text-text-secondary whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-4 text-right font-bold whitespace-nowrap">
                      {fmtCents(p.amountTotalCents)}
                      {p.cardLast4 && (
                        <div className="text-[11px] text-text-muted font-normal mt-0.5">
                          {(p.cardBrand ?? 'Card').toUpperCase()} •••• {p.cardLast4}
                        </div>
                      )}
                    </td>
                    <td className="px-5 lg:px-6 py-4 text-right">
                      {p.status === 'succeeded' || p.status === 'pending' ? (
                        <a
                          href={`/billing/invoice/${p.id}`}
                          className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {p.status === 'pending' ? 'View / Pay' : 'Invoice'} <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <p className="mt-5 text-xs text-text-muted leading-relaxed">
          Click <strong>Invoice</strong> on any paid row to open a printable PDF-ready tax invoice
          with full GST breakdown. Use your browser&rsquo;s Print → Save as PDF to keep a copy.
        </p>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-[0_2px_6px_rgba(11,13,18,.04)] p-5 lg:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-text-muted">{label}</p>
      <p className="font-display text-[44px] lg:text-[44px] leading-none tracking-tight mt-2 font-bold">
        {loading ? <span className="text-text-muted">—</span> : value}
      </p>
      <p className="text-xs text-text-muted mt-3">{hint}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, { bg: string; fg: string; icon: typeof CheckCircle2; label: string }> = {
    succeeded: { bg: 'bg-emerald-50', fg: 'text-emerald-700', icon: CheckCircle2, label: 'Paid' },
    pending: { bg: 'bg-amber-50', fg: 'text-amber-700', icon: Clock, label: 'Pending' },
    failed: { bg: 'bg-red-50', fg: 'text-red-700', icon: XCircle, label: 'Failed' },
    refunded: { bg: 'bg-sky-50', fg: 'text-sky-700', icon: RotateCcw, label: 'Refunded' },
    partial_refund: { bg: 'bg-amber-50', fg: 'text-amber-700', icon: RotateCcw, label: 'Partial refund' },
  };
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.fg}`}
    >
      {s.label}
    </span>
  );
}

function EmptyInvoices({ hasAny, tab }: { hasAny: boolean; tab: TabKey }) {
  return (
    <div className="p-12 text-center border-t border-border">
      <CreditCard size={20} className="text-text-muted mx-auto mb-3" />
      <p className="text-sm font-semibold">
        {!hasAny ? 'No payments yet' : `Nothing in ${tab}`}
      </p>
      <p className="text-xs text-text-muted mt-1">
        {!hasAny
          ? 'Once you pay for a campaign, the invoice will appear here.'
          : 'Try a different tab.'}
      </p>
    </div>
  );
}

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
}

/**
 * Stream the current view as a CSV that Excel / Google Sheets / Xero opens
 * cleanly. Amount is decimal AUD (e.g. 226.60), not cents.
 */
function downloadStatementCsv(rows: PaymentRow[]) {
  const header = ['Invoice', 'Campaign', 'Job code', 'Date', 'Status', 'Amount (AUD)'];
  const body = rows.map((r) => [
    r.invoiceNumber || '',
    r.jobTitle,
    r.jobCode,
    new Date(r.createdAt).toISOString().slice(0, 10),
    r.status,
    (r.amountTotalCents / 100).toFixed(2),
  ]);
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...body].map((row) => row.map(escape).join(',')).join('\n');

  // BOM keeps Excel happy with UTF-8 (so $ and emoji-suburb names don't garble).
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `droptrack-statement-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
