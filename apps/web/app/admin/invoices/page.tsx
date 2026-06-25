'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';

interface AdminInvoice {
  id: string;
  jobId: string;
  jobCode: string;
  jobTitle: string;
  jobStatus: string;
  clientUserId: string;
  amountTotalCents: number;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partial_refund';
  createdAt: string;
}

export default function AdminInvoices() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: AdminInvoice[] }>('/api/admin/payments');
      setRows(res.data ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const s = getSession();
    if (!s) router.replace('/login');
    if (s && s.role !== 'admin') router.replace('/dashboard');
    void load();
  }, [router, load]);

  async function markPaid(id: string) {
    if (!window.confirm('Mark this invoice as paid? The client will no longer be able to edit the campaign.')) return;
    setMarking(id);
    try {
      await api.patch(`/api/admin/payments/${id}/mark-paid`, {});
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMarking(null);
    }
  }

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
      <AppSidebar />
      <main className="p-8 lg:p-10 max-w-[1280px]">
        <header className="flex items-start justify-between gap-6 mb-7">
          <div>
            <h1 className="text-[44px] leading-[1.05] font-bold tracking-tight">
              Invoices{' '}
              <span className="font-serif italic font-normal text-text-secondary">
                — admin payments.
              </span>
            </h1>
            <p className="mt-3 text-sm text-text-muted">
              {pendingCount} pending · {rows.length} total
            </p>
          </div>
          <button onClick={load} className="btn-ghost h-11">
            <RefreshCw size={14} /> Refresh
          </button>
        </header>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[.15em] text-text-muted border-b border-border">
                <th className="text-left px-5 py-3 font-bold">Campaign</th>
                <th className="text-left px-5 py-3 font-bold">Job status</th>
                <th className="text-left px-5 py-3 font-bold">Amount</th>
                <th className="text-left px-5 py-3 font-bold">Created</th>
                <th className="text-left px-5 py-3 font-bold">Status</th>
                <th className="text-right px-5 py-3 font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-text-muted">
                    <Loader2 size={16} className="inline animate-spin mr-2" /> Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-text-muted">
                    No invoices yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-4">
                      <div className="font-semibold">{r.jobTitle}</div>
                      <div className="text-xs text-text-muted mt-0.5">{r.jobCode}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-bg-muted text-text-secondary">
                        {r.jobStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {(r.amountTotalCents / 100).toLocaleString('en-AU', {
                        style: 'currency',
                        currency: 'AUD',
                      })}
                    </td>
                    <td className="px-5 py-4 text-text-muted">
                      {new Date(r.createdAt).toLocaleDateString('en-AU')}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      {r.status === 'pending' ? (
                        <button
                          onClick={() => markPaid(r.id)}
                          disabled={marking === r.id}
                          className="btn-primary text-xs disabled:opacity-50"
                        >
                          {marking === r.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={12} />
                          )}
                          Mark paid
                        </button>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: AdminInvoice['status'] }) {
  const styles: Record<AdminInvoice['status'], string> = {
    pending: 'bg-amber-50 text-amber-700',
    succeeded: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-red-50 text-red-700',
    refunded: 'bg-slate-100 text-slate-700',
    partial_refund: 'bg-slate-100 text-slate-700',
  };
  const labels: Record<AdminInvoice['status'], string> = {
    pending: 'Pending',
    succeeded: 'Paid',
    failed: 'Failed',
    refunded: 'Refunded',
    partial_refund: 'Part refund',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
