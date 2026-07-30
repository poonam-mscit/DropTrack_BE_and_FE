'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Edit2,
  Loader2,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
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

interface SuburbPricing {
  id: string;
  suburbId: string;
  suburbName: string;
  state: string;
  postcode: string;
  ratePerLeafletCents: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SuburbItem {
  id: string;
  name: string;
  state: string;
  postcode: string;
}

export default function AdminPricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [data, setData] = useState<PricingResponse | null>(null);

  // Form state
  const [baseCents, setBaseCents] = useState('');
  const [feePctStr, setFeePctStr] = useState('');
  const [gstPctStr, setGstPctStr] = useState('');

  // Suburb pricing state
  const [suburbRates, setSuburbRates] = useState<SuburbPricing[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<SuburbPricing | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) return void router.replace('/login');
    if (s.role !== 'admin') return void router.replace('/dashboard');
    void load();
    void loadSuburbRates();
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

  async function loadSuburbRates() {
    setRatesLoading(true);
    try {
      const res = await api.get<{ data: SuburbPricing[] }>('/api/admin/suburb-pricing');
      setSuburbRates(res.data);
    } catch (e) {
      console.error('Failed to load suburb rates:', e);
    } finally {
      setRatesLoading(false);
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

  async function toggleRateActive(item: SuburbPricing) {
    try {
      await api.patch(`/api/admin/suburb-pricing/${item.id}`, {
        isActive: !item.isActive,
      });
      void loadSuburbRates();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function deleteRate(item: SuburbPricing) {
    if (!confirm(`Are you sure you want to remove custom rate for ${item.suburbName}?`)) return;
    try {
      await api.delete(`/api/admin/suburb-pricing/${item.id}`);
      void loadSuburbRates();
    } catch (e) {
      alert((e as Error).message);
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
            Tune global base rate, platform fee, GST, and suburb-specific leaflet pricing rates.
          </p>
        </header>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {savedAt && (
          <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle2 size={14} /> Saved at {savedAt.toLocaleTimeString('en-AU')} — propagating across all sessions.
          </div>
        )}

        {loading || !data ? (
          <div className="card p-10 text-center text-sm text-text-muted">
            <Loader2 size={16} className="inline-block animate-spin mr-2" />
            Loading…
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-[1fr_360px] gap-5">
              {/* ── Form ── */}
              <div className="card p-6 space-y-5">
                <Field
                  label="Global Base rate"
                  helper="Default rate per leaflet (AUD) when no specific suburb rate matches. Default $0.20 = 20¢."
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

            {/* ── Suburb Area Rates Section ── */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <MapPin size={18} className="text-primary" />
                    Delivery Suburb Rates
                  </h2>
                  <p className="text-xs text-text-muted mt-1">
                    Assign custom per-leaflet rates to official Australian suburbs and localities. Campaigns inside these official boundaries will use the suburb's custom rate.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingRate(null);
                    setIsModalOpen(true);
                  }}
                  className="btn-primary text-xs h-9 px-3 flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add Suburb Rate
                </button>
              </div>

              {ratesLoading ? (
                <div className="p-8 text-center text-sm text-text-muted">
                  <Loader2 size={16} className="inline animate-spin mr-2" /> Loading suburb rates…
                </div>
              ) : suburbRates.length === 0 ? (
                <div className="p-8 border border-dashed border-border rounded-xl text-center text-sm text-text-muted">
                  No custom suburb rates configured. All campaigns are currently priced using the global base rate (${(data.basePerLeafletCents / 100).toFixed(2)}/leaflet).
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted font-semibold bg-[#FAFBFC] border-b border-border">
                        <th className="py-3 px-4">Suburb / Locality</th>
                        <th className="py-3 px-4">Postcode</th>
                        <th className="py-3 px-4">State</th>
                        <th className="py-3 px-4">Rate per Leaflet</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suburbRates.map((r) => (
                        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-bg-muted/30">
                          <td className="py-3.5 px-4 font-semibold text-text-primary">
                            {r.suburbName}
                          </td>
                          <td className="py-3.5 px-4 text-text-secondary">{r.postcode}</td>
                          <td className="py-3.5 px-4 text-text-secondary">{r.state}</td>
                          <td className="py-3.5 px-4 font-bold text-text-primary">
                            ${(r.ratePerLeafletCents / 100).toFixed(2)} <span className="text-xs font-normal text-text-muted">({r.ratePerLeafletCents}¢)</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => void toggleRateActive(r)}
                              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${
                                r.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {r.isActive ? 'Active' : 'Disabled'}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setEditingRate(r);
                                setIsModalOpen(true);
                              }}
                              className="btn-ghost p-1.5 text-xs text-text-secondary hover:text-text-primary"
                              title="Edit rate"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => void deleteRate(r)}
                              className="btn-ghost p-1.5 text-xs text-red-600 hover:text-red-700"
                              title="Delete rate rule"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Suburb Rate Modal ── */}
      {isModalOpen && (
        <SuburbModal
          initialData={editingRate}
          onClose={() => {
            setIsModalOpen(false);
            setEditingRate(null);
          }}
          onSave={() => {
            setIsModalOpen(false);
            setEditingRate(null);
            void loadSuburbRates();
          }}
        />
      )}
    </div>
  );
}

interface OsmSearchResult {
  name: string;
  display_name: string;
  postcode: string;
  state: string;
  osm_id: string;
  osm_type: string;
}

function SuburbModal({
  initialData,
  onClose,
  onSave,
}: {
  initialData: SuburbPricing | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [osmResults, setOsmResults] = useState<OsmSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedSuburb, setSelectedSuburb] = useState<SuburbItem | null>(
    initialData
      ? {
          id: initialData.suburbId,
          name: initialData.suburbName,
          state: initialData.state,
          postcode: initialData.postcode,
        }
      : null,
  );
  const [rateCents, setRateCents] = useState(
    initialData ? String(initialData.ratePerLeafletCents) : '24',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) {
      setOsmResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      api
        .get<{ data: OsmSearchResult[] }>(
          `/api/admin/suburbs/search?q=${encodeURIComponent(trimmed)}`,
        )
        .then((res) => setOsmResults(res.data))
        .catch((e) => console.error('Suburb search failed:', e))
        .finally(() => setSearching(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, initialData]);

  async function handleSelectOsmSuburb(item: OsmSearchResult) {
    setError(null);
    setImporting(true);
    try {
      const res = await api.post<{ data: SuburbItem }>('/api/admin/suburbs/import', {
        osmId: item.osm_id,
        osmType: item.osm_type,
        name: item.name,
        state: item.state,
        postcode: item.postcode,
      });
      setSelectedSuburb({
        id: res.data.id,
        name: res.data.name,
        state: res.data.state,
        postcode: res.data.postcode,
      });
    } catch (e) {
      const body = (e as { body?: { message?: unknown } }).body?.message;
      setError(
        typeof body === 'string'
          ? body
          : (e as Error).message || 'Failed to import official suburb boundary',
      );
    } finally {
      setImporting(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (!selectedSuburb) return setError('Please select an official Australian suburb from the list');
    const rN = Number(rateCents);
    if (!Number.isInteger(rN) || rN < 1 || rN > 1000) {
      return setError('Please enter a valid rate in cents (1 to 1000)');
    }

    setSaving(true);
    try {
      if (initialData) {
        await api.patch(`/api/admin/suburb-pricing/${initialData.id}`, {
          ratePerLeafletCents: rN,
        });
      } else {
        await api.post('/api/admin/suburb-pricing', {
          suburbId: selectedSuburb.id,
          ratePerLeafletCents: rN,
        });
      }
      onSave();
    } catch (e) {
      const body = (e as { body?: { message?: unknown } }).body?.message;
      setError(typeof body === 'string' ? body : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-lg">
            {initialData ? `Edit Rate: ${initialData.suburbName}` : 'Add Suburb Rate'}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {!initialData && (
          <div>
            <label className="text-xs font-semibold text-text-primary block mb-1">
              Search Official Australian Suburb (OpenStreetMap)
            </label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search suburb name or postcode (e.g. Bondi, Sydney CBD, Parramatta)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input w-full pl-9"
              />
            </div>

            <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-white">
              {searching || importing ? (
                <div className="p-4 text-center text-xs text-text-muted">
                  <Loader2 size={14} className="inline animate-spin mr-1.5" />
                  {importing ? 'Retrieving & storing official suburb boundary...' : 'Searching Australian suburbs…'}
                </div>
              ) : osmResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-text-muted">
                  {searchQuery ? 'No matching Australian suburbs found' : 'Type to search suburbs (e.g. Bondi, Parramatta)'}
                </div>
              ) : (
                osmResults.map((sub) => (
                  <button
                    key={`${sub.osm_type}-${sub.osm_id}`}
                    type="button"
                    onClick={() => void handleSelectOsmSuburb(sub)}
                    className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-bg-muted/50 transition-colors ${
                      selectedSuburb?.name === sub.name && selectedSuburb?.state === sub.state
                        ? 'bg-primary/10 font-bold text-primary'
                        : ''
                    }`}
                  >
                    <div>
                      <div className="font-medium text-text-primary">{sub.name} ({sub.state} {sub.postcode})</div>
                      <div className="text-[10px] text-text-muted truncate max-w-sm">{sub.display_name}</div>
                    </div>
                    {selectedSuburb?.name === sub.name && selectedSuburb?.state === sub.state && (
                      <CheckCircle2 size={14} className="text-primary flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {selectedSuburb && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
            <span className="font-semibold text-emerald-800">
              Selected Suburb: <span className="text-emerald-950 font-bold">{selectedSuburb.name} ({selectedSuburb.state} {selectedSuburb.postcode})</span>
            </span>
            <CheckCircle2 size={14} className="text-emerald-600" />
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-text-primary block mb-1">
            Rate per Leaflet (cents AUD)
          </label>
          <div className="relative">
            <input
              type="number"
              placeholder="24"
              value={rateCents}
              onChange={(e) => setRateCents(e.target.value)}
              className="input w-full pr-20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
              ¢ (${((Number(rateCents) || 0) / 100).toFixed(2)})
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-ghost text-xs">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || importing || !selectedSuburb}
            className="btn-primary text-xs px-4 py-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
            {initialData ? 'Save Changes' : 'Create Suburb Rate'}
          </button>
        </div>
      </div>
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
