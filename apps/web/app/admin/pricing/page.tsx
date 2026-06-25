'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, DollarSign, Loader2, Save } from 'lucide-react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';

interface PricingResponse {
  basePerLeafletCents: number;
  platformFeePct: number;
  gstPct: number;
  defaults: {
    basePerLeafletCents: number;
    platformFeePct: number;
    gstPct: number;
  };
}

export default function AdminPricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [data, setData] = useState<PricingResponse | null>(null);

  // Form state — stored as strings so users can type freely.
  const [baseCents, setBaseCents] = useState('');
  const [feePctStr, setFeePctStr] = useState('');
  const [gstPctStr, setGstPctStr] = useState('');

  useEffect(() => {
    const s = getSession();
    if (!s) return void router.replace('/login');
    if (s.role !== 'admin') return void router.replace('/dashboard');
    void load();
  }, [router]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await api.get<PricingResponse>('/api/admin/settings/pricing');
      setData(d);
      setBaseCents(String(d.basePerLeafletCents));
      setFeePctStr(String(d.platformFeePct * 100));
      setGstPctStr(String(d.gstPct * 100));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const patch: Record<string, number> = {};
      const baseN = Number(baseCents);
      const feeN = Number(feePctStr);
      const gstN = Number(gstPctStr);
      if (!data) throw new Error('No baseline loaded');
      if (Number.isInteger(baseN) && baseN >= 1 && baseN <= 500 && baseN !== data.basePerLeafletCents) {
        patch.basePerLeafletCents = baseN;
      }
      const newFee = feeN / 100;
      if (Number.isFinite(newFee) && newFee >= 0 && newFee <= 0.5 && newFee !== data.platformFeePct) {
        patch.platformFeePct = newFee;
      }
      const newGst = gstN / 100;
      if (Number.isFinite(newGst) && newGst >= 0 && newGst <= 0.3 && newGst !== data.gstPct) {
        patch.gstPct = newGst;
      }
      if (Object.keys(patch).length === 0) {
        setSaving(false);
        setError('Nothing to save — values unchanged.');
        return;
      }
      const d = await api.patch<PricingResponse>('/api/admin/settings/pricing', patch);
      setData(d);
      setSavedAt(new Date());
    } catch (e) {
      const body = (e as { body?: { message?: unknown } }).body?.message;
      setError(typeof body === 'string' ? body : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    if (!data) return;
    setBaseCents(String(data.defaults.basePerLeafletCents));
    setFeePctStr(String(data.defaults.platformFeePct * 100));
    setGstPctStr(String(data.defaults.gstPct * 100));
  }

  // Live preview — what 1,000 leaflets would cost with the form's CURRENT values.
  const baseN = Number(baseCents);
  const feeN = Number(feePctStr) / 100;
  const gstN = Number(gstPctStr) / 100;
  const sample = 1000;
  const subtotal = Number.isFinite(baseN) ? sample * baseN : 0;
  const fee = Number.isFinite(feeN) ? Math.round(subtotal * feeN) : 0;
  const net = subtotal + fee;
  const gst = Number.isFinite(gstN) ? Math.round(net * gstN) : 0;
  const total = net + gst;
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });

  return (
    <div className="min-h-screen pl-[252px]">
      <AdminSidebar active="pricing" />
      <main className="p-8 max-w-[1000px]">
        <header className="mb-7">
          <p className="text-[11px] uppercase tracking-[.18em] text-text-muted font-bold mb-1">
            Settings
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Tune base rate, platform fee, and GST. Changes take effect within ~30 seconds across
            every active session.
          </p>
        </header>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {savedAt && (
          <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle2 size={14} /> Saved at {savedAt.toLocaleTimeString('en-AU')} — propagating to all clients within 30 s.
          </div>
        )}

        {loading || !data ? (
          <div className="card p-10 text-center text-sm text-text-muted">
            <Loader2 size={16} className="inline-block animate-spin mr-2" />
            Loading…
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_360px] gap-5">
            {/* ── Form ── */}
            <div className="card p-6 space-y-5">
              <Field
                label="Base rate"
                helper="Cents per leaflet (AUD). Default $0.20 = 20¢."
                suffix="¢ / leaflet"
                value={baseCents}
                onChange={setBaseCents}
                type="number"
                step="1"
                min={1}
                max={500}
              />
              <Field
                label="Platform fee"
                helper="DropTrack's percentage cut on top of the base rate."
                suffix="%"
                value={feePctStr}
                onChange={setFeePctStr}
                type="number"
                step="0.1"
                min={0}
                max={50}
              />
              <Field
                label="GST"
                helper="Australian Goods & Services Tax. Standard rate is 10%."
                suffix="%"
                value={gstPctStr}
                onChange={setGstPctStr}
                type="number"
                step="0.1"
                min={0}
                max={30}
              />

              <div className="flex items-center gap-3 pt-2 border-t border-border">
                <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save changes
                </button>
                <button onClick={resetToDefaults} disabled={saving} className="btn-ghost text-xs">
                  Reset to defaults
                </button>
              </div>
            </div>

            {/* ── Live preview ── */}
            <aside className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign size={14} className="text-primary" />
                <h3 className="font-bold text-sm">Live preview · 1,000 leaflets</h3>
              </div>
              <div className="space-y-2 text-sm">
                <PreviewRow label="Subtotal" value={fmt(subtotal)} />
                <PreviewRow label={`Platform fee (${feePctStr || 0}%)`} value={fmt(fee)} muted />
                <PreviewRow label="Net" value={fmt(net)} muted />
                <PreviewRow label={`GST (${gstPctStr || 0}%)`} value={fmt(gst)} muted />
                <div className="pt-3 border-t border-border">
                  <PreviewRow label="Total inc. GST" value={fmt(total)} bold />
                </div>
              </div>

              <p className="text-[11px] text-text-muted mt-5 leading-relaxed">
                Currently saved:{' '}
                <strong className="text-text-secondary">
                  {data.basePerLeafletCents}¢ · {(data.platformFeePct * 100).toFixed(1)}% fee ·{' '}
                  {(data.gstPct * 100).toFixed(1)}% GST
                </strong>
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

interface FieldProps {
  label: string;
  helper?: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  min?: number;
  max?: number;
}
function Field({ label, helper, suffix, value, onChange, type = 'text', step, min, max }: FieldProps) {
  return (
    <div>
      <label className="text-sm font-semibold text-text-primary">{label}</label>
      <div className="relative mt-1">
        <input
          type={type}
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input w-full pr-20"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
            {suffix}
          </span>
        )}
      </div>
      {helper && <p className="text-xs text-text-muted mt-1.5">{helper}</p>}
    </div>
  );
}

function PreviewRow({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? 'text-text-muted text-xs' : 'text-text-secondary'}>{label}</span>
      <span className={bold ? 'font-bold' : muted ? 'text-text-muted text-xs' : 'font-medium'}>
        {value}
      </span>
    </div>
  );
}
