'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { StepBar } from '@/components/StepBar';
import { getSession } from '@/lib/auth';
import { clearDraft, loadDraft, type SmartZoneEstimate } from '@/lib/draft';
import { api, type ApiJob } from '@/lib/api';

export default function CreatePay() {
  const router = useRouter();
  const [draft, setDraft] = useState<ReturnType<typeof loadDraft>>({});
  const [estimate, setEstimate] = useState<SmartZoneEstimate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getSession()) router.replace('/login');
    const d = loadDraft();
    setDraft(d);
    if (d.zone) {
      api
        .post<SmartZoneEstimate>('/api/jobs/estimate', {
          polygon: d.zone,
          leafletCount: d.leafletCount,
        })
        .then(setEstimate)
        .catch((err) => setError(err.message ?? 'Failed to estimate'));
    }
  }, [router]);

  async function confirmAndCreate() {
    if (!draft.zone || !draft.title) {
      setError('Draft is incomplete — go back to step 1.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        title: draft.title,
        campaignType: draft.campaignType,
        leafletCount: draft.leafletCount ?? estimate?.estimatedLetterboxes,
        leafletSize: draft.leafletSize ?? 'dl',
        startDate: draft.startDate,
        deadline: draft.deadline,
        skipNoJunkMail: draft.skipNoJunkMail !== false,
        skipApartments: !!draft.skipApartments,
        specialInstructions: draft.specialInstructions,
        zone: draft.zone,
      };
      let job: ApiJob;
      if (draft.id) {
        job = await api.patch<ApiJob>(`/api/jobs/${draft.id}`, payload);
      } else {
        const result = await api.post<{ job: ApiJob }>('/api/jobs', payload);
        job = result.job;
      }
      // Create a pending invoice that admin will mark paid.
      await api.post(`/api/jobs/${job.id}/confirm`);
      clearDraft();
      router.push(`/campaigns?created=1&job=${job.id}`);
    } catch (err) {
      const msg = (err as { body?: { message?: unknown } }).body?.message;
      setError(typeof msg === 'string' ? msg : (err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <AppSidebar active={draft.id ? 'campaigns' : 'create'} />
      <main className="ml-[252px] p-10 max-w-[1000px]">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Review &amp; Confirm{' '}
            <span className="font-serif italic font-normal text-text-secondary">
              — one final look.
            </span>
          </h1>
          <a href="/dashboard" className="btn-ghost">Cancel</a>
        </div>

        <StepBar step={3} />
        <p className="text-text-muted text-xs mt-1 mb-6">Step 3 of 3 · Confirm campaign details</p>

        <div className="grid gap-5" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          <div>
            <div className="card p-6 mb-4">
              <h3 className="font-semibold text-base mb-4">Campaign summary</h3>
              <div className="grid grid-cols-2 gap-3.5 text-sm">
                <Cell label="Campaign" value={draft.title ?? '—'} />
                <Cell label="Type" value={draft.campaignType ?? '—'} />
                <Cell label="Leaflets" value={(draft.leafletCount ?? estimate?.estimatedLetterboxes ?? '—').toLocaleString?.() ?? '—'} />
                <Cell label="Size" value={draft.leafletSize ?? 'dl'} />
                <Cell label="Start date" value={draft.startDate ?? '—'} />
                <Cell label="Deadline" value={draft.deadline ?? '—'} />
              </div>
              {estimate && (
                <div className="mt-4 pt-4 border-t border-border text-sm text-text-muted">
                  Zone area <strong className="text-text-primary">{estimate.areaKm2} km²</strong> · est. walk{' '}
                  <strong className="text-text-primary">{estimate.estimatedDistanceKm} km</strong> ·{' '}
                  density <strong className="text-text-primary">{estimate.density.replace('_', ' ')}</strong>
                </div>
              )}
            </div>

            <div
              className="card p-4.5"
              style={{ background: '#FEF3C7', borderColor: '#FCD34D' }}
            >
              <div className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: '#92400E' }}>
                <TriangleAlert size={14} /> Cancellation Policy
              </div>
              <p className="text-[13px] mt-2 leading-relaxed" style={{ color: '#78350F' }}>
                Cancellations &gt;48 hrs before start: refund minus $50 fee.
                <br />
                Cancellations within 48 hrs or after start: <strong>no refund</strong>.
              </p>
            </div>
          </div>

          <div>
            <div className="card p-6 sticky top-6">
              <h3 className="font-semibold text-base mb-4">Order summary</h3>
              {estimate ? (
                <>
                  <SummaryRow
                    label={`${estimate.priceBreakdown.leafletCount.toLocaleString()} leaflets × ${fmtCents(estimate.priceBreakdown.ratePerLeafletCents)}`}
                    value={fmtCents(estimate.priceBreakdown.subtotalCents)}
                  />
                  <SummaryRow
                    label={`GST (${pctLabel(estimate.priceBreakdown.gstCents, estimate.priceBreakdown.netCents)})`}
                    value={fmtCents(estimate.priceBreakdown.gstCents)}
                  />
                  <div className="border-t border-border my-3.5 pt-3.5 flex justify-between text-lg font-bold">
                    <span>Total <span className="text-xs font-normal text-text-muted">(inc. GST)</span></span>
                    <span>{fmtCents(estimate.priceBreakdown.totalCents)}</span>
                  </div>
                </>
              ) : (
                <div className="text-text-muted text-sm">Calculating…</div>
              )}

              <button
                onClick={confirmAndCreate}
                disabled={!estimate || submitting}
                className="btn-primary w-full justify-center mt-2 py-3.5 text-[15px] disabled:opacity-50"
              >
                <CheckCircle2 size={16} />
                {submitting ? 'Creating campaign…' : 'Confirm & Create Campaign'}
              </button>

              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {error}
                </div>
              )}

              <p className="text-[11px] text-text-muted mt-3 text-center">
                By confirming you agree to our <a href="#" className="text-primary">Terms</a> and our{' '}
                <a href="#" className="text-primary">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <a href="/create/zone" className="btn-ghost">← Back</a>
        </div>
      </main>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-muted text-xs">{label}</div>
      <strong className="text-sm">{value}</strong>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`flex justify-between mb-2.5 text-sm ${muted ? 'text-text-muted' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

function pctLabel(numeratorCents: number, denominatorCents: number): string {
  if (!denominatorCents) return '0%';
  const pct = (numeratorCents / denominatorCents) * 100;
  return `${pct.toFixed(pct >= 10 ? 0 : 1)}%`;
}
