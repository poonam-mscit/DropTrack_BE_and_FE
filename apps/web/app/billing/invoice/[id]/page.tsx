'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { LogoMark } from '@/components/Logo';

interface Invoice {
  paymentId: string;
  invoiceNumber: string;
  amountNetCents: number;
  gstCents: number;
  amountTotalCents: number;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partial_refund';
  currency: string;
  createdAt: string;
  updatedAt: string;
  jobCode: string;
  jobTitle: string;
  leafletCount: number;
  clientEmail: string;
  businessName: string | null;
  abn: string | null;
  gstRegistered: boolean | null;
  addressLine1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
}

const COMPANY = {
  name: 'DropTrack Pty Ltd',
  abn: '12 345 678 901',
  address: 'Level 5, 100 George St, Sydney NSW 2000',
  email: 'hello@droptrack.com.au',
  web: 'droptrack.com.au',
  bank: {
    accountName: 'DropTrack Pty Ltd',
    bsb: '012-951',
    accountNumber: '813491871',
  },
};

export default function InvoicePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.get<Invoice>(`/api/me/invoices/${id}`);
      setInv(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    void load();
  }, [router, load]);

  if (error) {
    return (
      <main className="p-10 max-w-2xl mx-auto">
        <div className="p-5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          <p className="font-semibold mb-1">Invoice not available</p>
          <p>{error}</p>
          <a href="/billing" className="btn-ghost mt-3 inline-flex">
            <ArrowLeft size={14} /> Back to billing
          </a>
        </div>
      </main>
    );
  }
  if (!inv) {
    return (
      <main className="p-10 text-text-muted text-sm">
        <Loader2 size={14} className="inline animate-spin mr-2" /> Loading invoice…
      </main>
    );
  }

  const ratePerLeafletCents =
    inv.leafletCount > 0 ? Math.round(inv.amountNetCents / inv.leafletCount) : 0;
  const created = new Date(inv.createdAt);
  const dueDate = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);

  return (
    <div className="min-h-screen bg-bg-muted/40">
      {/* Top toolbar — hidden when printing */}
      <div className="print:hidden bg-white border-b border-border">
        <div className="max-w-[820px] mx-auto p-4 flex items-center justify-between">
          <a href="/billing" className="text-sm text-text-muted inline-flex items-center gap-1.5 hover:text-text-primary">
            <ArrowLeft size={14} /> Back to billing
          </a>
          <button onClick={() => window.print()} className="btn-primary text-sm">
            <Printer size={14} /> Print / Save as PDF
          </button>
        </div>
      </div>

      <main className="max-w-[820px] mx-auto p-10 print:p-0 print:max-w-none">
        <article className="bg-white shadow-sm print:shadow-none border border-border print:border-0 rounded-2xl print:rounded-none p-10">
          {/* ── Header ── */}
          <header className="flex items-start justify-between mb-8 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <LogoMark size={36} />
                <span className="text-2xl font-extrabold tracking-tight text-text-primary">DropTrack</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {COMPANY.address}
                <br />
                ABN {COMPANY.abn} · {COMPANY.email}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[.18em] text-text-muted font-bold">Tax invoice</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums">{inv.invoiceNumber}</p>
              <p className="text-xs text-text-muted mt-1">
                Issued {created.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </header>

          {/* ── Parties ── */}
          <section className="grid grid-cols-2 gap-6 mb-8 pb-8 border-b border-border">
            <div>
              <p className="text-[10px] uppercase tracking-[.15em] text-text-muted font-bold mb-2">Billed to</p>
              <p className="font-semibold">{inv.businessName ?? inv.clientEmail}</p>
              <p className="text-sm text-text-secondary mt-1">
                {inv.clientEmail}
                {inv.addressLine1 && (
                  <>
                    <br />
                    {inv.addressLine1}
                  </>
                )}
                {(inv.suburb || inv.state || inv.postcode) && (
                  <>
                    <br />
                    {[inv.suburb, inv.state, inv.postcode].filter(Boolean).join(' ')}
                  </>
                )}
              </p>
              {inv.abn && <p className="text-xs text-text-muted mt-2">ABN {inv.abn}</p>}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[.15em] text-text-muted font-bold mb-2">Details</p>
              <dl className="text-sm space-y-1">
                <Row label="Status" value={<StatusPill status={inv.status} />} />
                <Row
                  label="Due"
                  value={dueDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                />
                <Row label="Campaign" value={inv.jobCode} />
              </dl>
            </div>
          </section>

          {/* ── Line items ── */}
          <table className="w-full mb-6 text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[.12em] text-text-muted font-bold">
                <th className="text-left pb-3 border-b border-border">Description</th>
                <th className="text-right pb-3 border-b border-border w-24">Qty</th>
                <th className="text-right pb-3 border-b border-border w-28">Rate</th>
                <th className="text-right pb-3 border-b border-border w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="py-4">
                  <p className="font-semibold">{inv.jobTitle}</p>
                  <p className="text-xs text-text-muted mt-1">Door-to-door leaflet delivery</p>
                </td>
                <td className="py-4 text-right tabular-nums">{inv.leafletCount.toLocaleString()}</td>
                <td className="py-4 text-right tabular-nums">{fmtCents(ratePerLeafletCents)}</td>
                <td className="py-4 text-right tabular-nums">
                  {fmtCents(inv.amountNetCents)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Totals ── */}
          <section className="flex justify-end mb-6">
            <dl className="w-72 space-y-2 text-sm">
              <SumRow label="Subtotal (excl. GST)" value={fmtCents(inv.amountNetCents)} />
              <SumRow label={`GST (10%)`} value={fmtCents(inv.gstCents)} />
              <div className="border-t border-border pt-3 mt-3">
                <SumRow label="Total (AUD)" value={fmtCents(inv.amountTotalCents)} bold />
              </div>
            </dl>
          </section>

          {/* ── Bank details (only for unpaid invoices) ── */}
          {inv.status !== 'succeeded' && (
            <section className="mb-6 p-5 rounded-2xl bg-bg-muted/40 border border-border">
              <p className="text-[10px] uppercase tracking-[.15em] text-text-muted font-bold mb-3">
                Pay by bank transfer
              </p>
              <dl className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">Account name</dt>
                  <dd className="font-semibold mt-0.5">{COMPANY.bank.accountName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">BSB</dt>
                  <dd className="font-mono font-semibold tabular-nums mt-0.5">{COMPANY.bank.bsb}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Account number</dt>
                  <dd className="font-mono font-semibold tabular-nums mt-0.5">{COMPANY.bank.accountNumber}</dd>
                </div>
              </dl>
              <p className="text-xs text-text-muted mt-3">
                Please use <strong className="text-text-secondary">{inv.invoiceNumber}</strong> as the
                payment reference so we can match it to your campaign.
              </p>
            </section>
          )}

          {/* ── Footer ── */}
          <footer className="pt-6 border-t border-border text-xs text-text-muted leading-relaxed">
            <p className="font-semibold text-text-secondary mb-2">Payment terms</p>
            <p>
              Net 14 days from the issue date. Bank-transfer details are above; for questions on this
              invoice contact {COMPANY.email}.
            </p>
            <p className="mt-4">
              This document is a valid tax invoice for Australian GST purposes. {COMPANY.name} · ABN{' '}
              {COMPANY.abn} · {COMPANY.web}
            </p>
          </footer>
        </article>
      </main>

      <style jsx global>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function SumRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={bold ? 'font-bold' : 'text-text-secondary'}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold' : ''}`}>{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: Invoice['status'] }) {
  const styles: Record<Invoice['status'], string> = {
    succeeded: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    failed: 'bg-red-50 text-red-700',
    refunded: 'bg-slate-100 text-slate-700',
    partial_refund: 'bg-slate-100 text-slate-700',
  };
  const labels: Record<Invoice['status'], string> = {
    succeeded: 'Paid',
    pending: 'Pending',
    failed: 'Failed',
    refunded: 'Refunded',
    partial_refund: 'Part refund',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status]}`}>{labels[status]}</span>
  );
}

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}
