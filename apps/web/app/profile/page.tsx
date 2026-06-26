'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  AtSign,
  Bell,
  Building2,
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  Key,
  Loader2,
  MapPin,
  Monitor,
  Save,
  ShieldAlert,
  Users as UsersIcon,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';

type Industry = 'real_estate' | 'medical' | 'political' | 'food' | 'retail' | 'education' | 'government' | 'other';
type BusinessSize = 'solo' | '2_10' | '11_50' | '50_plus';
type AuState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
type NotificationKey = 'campaignLaunched' | 'campaignCompleted' | 'paymentReceipts' | 'weeklySummary' | 'productUpdates';
type NotificationPrefs = Partial<Record<NotificationKey, boolean>>;
const NOTIFICATION_DEFAULTS: Record<NotificationKey, boolean> = {
  campaignLaunched: true,
  campaignCompleted: true,
  paymentReceipts: true,
  weeklySummary: false,
  productUpdates: false,
};

interface Profile {
  user: {
    id: string;
    email: string;
    mobile: string | null;
    role: 'client' | 'dropper' | 'admin';
    createdAt: string;
    notificationPrefs: NotificationPrefs | null;
  };
  business: {
    businessName: string;
    industry: Industry;
    businessSize: BusinessSize | null;
    abn: string | null;
    gstRegistered: boolean;
    addressLine1: string | null;
    suburb: string | null;
    state: AuState | null;
    postcode: string | null;
    logoS3Key: string | null;
    logoUrl?: string | null;
  } | null;
}

const INDUSTRY_LABEL: Record<Industry, string> = {
  real_estate: 'Real Estate',
  medical: 'Medical / Clinic',
  political: 'Political',
  food: 'Food & Hospitality',
  retail: 'Retail',
  education: 'Education',
  government: 'Government',
  other: 'Other',
};

const BUSINESS_SIZE_LABEL: Record<BusinessSize, string> = {
  solo: '1 — Solo',
  '2_10': '2–10',
  '11_50': '11–50',
  '50_plus': '50+',
};

interface SectionDef {
  key: string;
  group: string;
  label: string;
  icon: typeof Building2;
}
const SECTIONS: SectionDef[] = [
  { key: 'business',     group: 'Profile',     label: 'Business',          icon: Building2 },
  { key: 'contact',      group: 'Profile',     label: 'Contact',           icon: AtSign },
  { key: 'billing',      group: 'Profile',     label: 'Billing address',   icon: MapPin },
  { key: 'branding',     group: 'Profile',     label: 'Branding',          icon: ImageIcon },

  { key: 'notifications', group: 'Preferences', label: 'Notifications',     icon: Bell },
  { key: 'region',       group: 'Preferences', label: 'Region & language', icon: Globe },

  { key: 'password',     group: 'Security',    label: 'Password & 2FA',    icon: Key },
  { key: 'sessions',     group: 'Security',    label: 'Active sessions',   icon: Monitor },

  { key: 'members',      group: 'Team',        label: 'Members',           icon: UsersIcon },

  { key: 'privacy',      group: 'Data',        label: 'Privacy & data',    icon: ShieldAlert },
  { key: 'danger',       group: 'Data',        label: 'Danger zone',       icon: AlertTriangle },
];

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<
    Partial<NonNullable<Profile['business']> & { mobile: string | null; notificationPrefs: NotificationPrefs }>
  >({});
  const [active, setActive] = useState<string>('business');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    void load();
  }, [router]);

  async function load() {
    try {
      const p = await api.get<Profile>('/api/me/profile');
      setProfile(p);
      setForm({
        mobile: p.user.mobile,
        businessName: p.business?.businessName ?? '',
        industry: p.business?.industry ?? 'other',
        businessSize: p.business?.businessSize ?? null,
        abn: p.business?.abn ?? '',
        gstRegistered: p.business?.gstRegistered ?? false,
        addressLine1: p.business?.addressLine1 ?? '',
        suburb: p.business?.suburb ?? '',
        state: p.business?.state ?? null,
        postcode: p.business?.postcode ?? '',
        notificationPrefs: { ...NOTIFICATION_DEFAULTS, ...(p.user.notificationPrefs ?? {}) },
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function field<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const patch = { ...form };
      // Clean empty strings to null where the API expects nullable text.
      if (patch.abn === '') patch.abn = null;
      if (patch.addressLine1 === '') patch.addressLine1 = null;
      if (patch.suburb === '') patch.suburb = null;
      if (patch.postcode === '') patch.postcode = null;
      const next = await api.patch<Profile>('/api/me/profile', patch);
      setProfile(next);
      setSavedAt(new Date());
    } catch (err) {
      const body = (err as { body?: { message?: unknown } }).body?.message;
      setError(typeof body === 'string' ? body : (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeLogo() {
    if (!window.confirm('Remove your logo? You can upload a new one any time.')) return;
    setError(null);
    setLogoUploading(true);
    try {
      const next = await api.delete<Profile>('/api/me/profile/logo');
      setProfile(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLogoUploading(false);
    }
  }

  async function uploadLogo(file: File) {
    setError(null);
    setLogoUploading(true);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Logo is too large — max 2 MB.');
      const presign = await api.post<{ s3Key: string; uploadUrl: string; publicUrl: string; contentType: string }>(
        '/api/me/profile/logo/presign',
        { contentType: file.type, byteSize: file.size },
      );
      // Direct browser PUT to S3.
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': presign.contentType },
        body: file,
      });
      if (!put.ok) throw new Error(`S3 upload failed (${put.status})`);
      const next = await api.post<Profile>('/api/me/profile/logo/commit', { s3Key: presign.s3Key });
      setProfile(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  const memberSince = useMemo(() => {
    if (!profile) return '';
    const d = new Date(profile.user.createdAt);
    return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  }, [profile]);

  const initial = (profile?.business?.businessName ?? profile?.user.email ?? 'D')[0]?.toUpperCase() ?? 'D';

  const sectionGroups = useMemo(() => {
    const groups = new Map<string, SectionDef[]>();
    for (const s of SECTIONS) {
      const existing = groups.get(s.group) ?? [];
      existing.push(s);
      groups.set(s.group, existing);
    }
    return groups;
  }, []);

  return (
    <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
      <AppSidebar active="profile" />

      <main className="p-8 lg:p-10 max-w-[1280px]">
        {/* Header */}
        <header className="flex items-start justify-between gap-6 mb-7 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-[44px] leading-[1.05] font-bold tracking-tight">
              Profile &amp; settings{' '}
              <span className="font-serif italic font-normal text-text-secondary">
                — everything about you.
              </span>
            </h1>
            <p className="mt-3 text-sm text-text-muted">
              {savedAt
                ? `Saved at ${savedAt.toLocaleTimeString('en-AU')}.`
                : 'Changes are saved when you click Save.'}
            </p>
          </div>
          <button onClick={save} disabled={saving || !profile} className="btn-primary h-11 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save changes
          </button>
        </header>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}
        {savedAt && !error && (
          <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 inline-flex items-center gap-2">
            <CheckCircle2 size={14} /> Profile saved.
          </div>
        )}

        <div className="grid grid-cols-[260px_1fr] gap-6">
          {/* ── Left rail ── */}
          <aside className="space-y-5">
            {Array.from(sectionGroups.entries()).map(([group, items]) => (
              <div key={group}>
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-text-muted px-3 mb-2">
                  {group}
                </p>
                <nav className="flex flex-col gap-0.5">
                  {items.map((s) => {
                    const Icon = s.icon;
                    const isActive = active === s.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setActive(s.key)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-left transition-colors ${
                          isActive
                            ? 'bg-indigo-50 text-primary'
                            : 'text-text-secondary hover:bg-bg-muted/40 hover:text-text-primary'
                        }`}
                      >
                        <Icon size={15} className={isActive ? 'text-primary' : 'text-text-muted'} />
                        {s.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </aside>

          {/* ── Main panel ── */}
          <div className="space-y-5 min-w-0">
            {profile === null ? (
              <div className="bg-white rounded-2xl border border-border p-12 text-center text-sm text-text-muted">
                <Loader2 size={16} className="inline-block animate-spin mr-2" />
                Loading profile…
              </div>
            ) : (
              <>
                {/* Identity card — always at the top */}
                <section className="bg-white rounded-2xl border border-border shadow-[0_2px_6px_rgba(11,13,18,.04)] p-5 lg:p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      {profile.business?.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profile.business.logoUrl}
                          alt="Logo"
                          className="w-16 h-16 rounded-2xl object-cover border border-border bg-white shrink-0"
                        />
                      ) : (
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shrink-0"
                          style={{ background: 'linear-gradient(135deg,#6366f1 0%,#7c3aed 60%,#a3e635 100%)' }}
                        >
                          {initial}
                        </div>
                      )}
                      <div>
                        <h2 className="font-bold text-lg">
                          {form.businessName || profile.user.email.split('@')[0]}
                        </h2>
                        <p className="text-sm text-text-muted mt-0.5">
                          {profile.user.email} · Member since {memberSince}
                        </p>
                      </div>
                    </div>
                    <button
                      className="btn-ghost text-xs"
                      type="button"
                      onClick={() => {
                        setActive('branding');
                        // Defer click so React renders the Branding card first.
                        setTimeout(() => logoInputRef.current?.click(), 0);
                      }}
                    >
                      {profile.business?.logoUrl ? 'Change logo' : 'Add logo'}
                    </button>
                  </div>
                </section>

                {/* Business details */}
                {active === 'business' && (
                  <Card title="Business details" hint="Used for invoicing &amp; GST.">
                    <Field label="Business name">
                      <input
                        type="text"
                        className="input w-full"
                        value={form.businessName ?? ''}
                        onChange={(e) => field('businessName', e.target.value)}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Industry">
                        <select
                          className="input w-full"
                          value={form.industry ?? 'other'}
                          onChange={(e) => field('industry', e.target.value as Industry)}
                        >
                          {(Object.keys(INDUSTRY_LABEL) as Industry[]).map((i) => (
                            <option key={i} value={i}>{INDUSTRY_LABEL[i]}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Business size">
                        <select
                          className="input w-full"
                          value={form.businessSize ?? ''}
                          onChange={(e) => field('businessSize', (e.target.value || null) as BusinessSize | null)}
                        >
                          <option value="">— Choose —</option>
                          {(Object.keys(BUSINESS_SIZE_LABEL) as BusinessSize[]).map((i) => (
                            <option key={i} value={i}>{BUSINESS_SIZE_LABEL[i]}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label={<>ABN <span className="text-text-muted font-normal">(optional)</span></>}>
                        <input
                          type="text"
                          className="input w-full"
                          placeholder="11 222 333 444"
                          value={form.abn ?? ''}
                          onChange={(e) => field('abn', e.target.value)}
                        />
                      </Field>
                      <Field label="GST registered">
                        <select
                          className="input w-full"
                          value={form.gstRegistered ? 'yes' : 'no'}
                          onChange={(e) => field('gstRegistered', e.target.value === 'yes')}
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </Field>
                    </div>
                  </Card>
                )}

                {/* Contact */}
                {active === 'contact' && (
                  <Card title="Contact" hint="How we reach you for support &amp; campaign updates.">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Email">
                        <input
                          type="email"
                          className="input w-full bg-bg-muted/50 text-text-secondary cursor-not-allowed"
                          value={profile.user.email}
                          readOnly
                          title="Email is your sign-in identity — change it from /forgot-password if needed."
                        />
                      </Field>
                      <Field label="Mobile">
                        <input
                          type="tel"
                          className="input w-full"
                          placeholder="04xx xxx xxx"
                          value={form.mobile ?? ''}
                          onChange={(e) => field('mobile', e.target.value)}
                        />
                      </Field>
                    </div>
                  </Card>
                )}

                {/* Billing address */}
                {active === 'billing' && (
                  <Card title="Billing address" hint="Appears on your Stripe-hosted tax invoices.">
                    <Field label="Street address">
                      <input
                        type="text"
                        className="input w-full"
                        placeholder="12 Curlewis St"
                        value={form.addressLine1 ?? ''}
                        onChange={(e) => field('addressLine1', e.target.value)}
                      />
                    </Field>
                    <div className="grid grid-cols-3 gap-4">
                      <Field label="Suburb">
                        <input
                          type="text"
                          className="input w-full"
                          placeholder="Bondi"
                          value={form.suburb ?? ''}
                          onChange={(e) => field('suburb', e.target.value)}
                        />
                      </Field>
                      <Field label="State">
                        <select
                          className="input w-full"
                          value={form.state ?? ''}
                          onChange={(e) => field('state', (e.target.value || null) as AuState | null)}
                        >
                          <option value="">—</option>
                          {(['NSW','VIC','QLD','WA','SA','TAS','ACT','NT'] as AuState[]).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Postcode">
                        <input
                          type="text"
                          maxLength={4}
                          className="input w-full"
                          placeholder="2026"
                          value={form.postcode ?? ''}
                          onChange={(e) => field('postcode', e.target.value)}
                        />
                      </Field>
                    </div>
                  </Card>
                )}

                {active === 'branding' && (
                  <Card title="Branding" hint="Logo shown on tax invoices &amp; the client dashboard.">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadLogo(f);
                      }}
                    />
                    <div className="flex items-center gap-5">
                      {profile.business?.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profile.business.logoUrl}
                          alt="Business logo"
                          className="w-20 h-20 rounded-2xl object-cover border border-border bg-white"
                        />
                      ) : (
                        <div
                          className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-3xl"
                          style={{ background: 'linear-gradient(135deg,#6366f1 0%,#7c3aed 60%,#a3e635 100%)' }}
                        >
                          {initial}
                        </div>
                      )}
                      <div className="text-sm">
                        <p className="font-semibold">Upload your logo</p>
                        <p className="text-text-muted mt-1">PNG, JPEG, WebP or SVG · ≤ 2 MB · square works best.</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={logoUploading}
                            className="btn-primary text-xs disabled:opacity-50"
                          >
                            {logoUploading ? 'Uploading…' : profile.business?.logoUrl ? 'Replace…' : 'Choose file…'}
                          </button>
                          {profile.business?.logoUrl && (
                            <button
                              type="button"
                              onClick={removeLogo}
                              disabled={logoUploading}
                              className="btn-ghost text-xs disabled:opacity-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {active === 'notifications' && (
                  <Card title="Notifications" hint="Choose what lands in your inbox. Saves with the top-right button.">
                    <Toggle
                      label="Campaign launched"
                      hint="A worker is en-route."
                      checked={form.notificationPrefs?.campaignLaunched ?? NOTIFICATION_DEFAULTS.campaignLaunched}
                      onChange={(v) => field('notificationPrefs', { ...form.notificationPrefs, campaignLaunched: v })}
                    />
                    <Toggle
                      label="Campaign completed"
                      hint="All zones delivered + photo proof attached."
                      checked={form.notificationPrefs?.campaignCompleted ?? NOTIFICATION_DEFAULTS.campaignCompleted}
                      onChange={(v) => field('notificationPrefs', { ...form.notificationPrefs, campaignCompleted: v })}
                    />
                    <Toggle
                      label="Payment receipts"
                      hint="Stripe receipts forwarded to your billing email."
                      checked={form.notificationPrefs?.paymentReceipts ?? NOTIFICATION_DEFAULTS.paymentReceipts}
                      onChange={(v) => field('notificationPrefs', { ...form.notificationPrefs, paymentReceipts: v })}
                    />
                    <Toggle
                      label="Weekly summary"
                      hint="Spend, reach, suburbs covered."
                      checked={form.notificationPrefs?.weeklySummary ?? NOTIFICATION_DEFAULTS.weeklySummary}
                      onChange={(v) => field('notificationPrefs', { ...form.notificationPrefs, weeklySummary: v })}
                    />
                    <Toggle
                      label="Product updates"
                      hint="New features &amp; tips, no spam."
                      checked={form.notificationPrefs?.productUpdates ?? NOTIFICATION_DEFAULTS.productUpdates}
                      onChange={(v) => field('notificationPrefs', { ...form.notificationPrefs, productUpdates: v })}
                    />
                  </Card>
                )}

                {active === 'region' && (
                  <Card title="Region &amp; language" hint="Currency follows your region.">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Region">
                        <select className="input w-full" defaultValue="AU">
                          <option value="AU">Australia (AUD)</option>
                          <option value="NZ" disabled>New Zealand (NZD) — coming soon</option>
                        </select>
                      </Field>
                      <Field label="Timezone">
                        <select className="input w-full" defaultValue="Australia/Sydney">
                          <option>Australia/Sydney</option>
                          <option>Australia/Melbourne</option>
                          <option>Australia/Brisbane</option>
                          <option>Australia/Perth</option>
                          <option>Australia/Adelaide</option>
                          <option>Australia/Hobart</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Language">
                      <select className="input w-full" defaultValue="en-AU">
                        <option value="en-AU">English (Australia)</option>
                      </select>
                    </Field>
                  </Card>
                )}

                {active === 'password' && (
                  <Card title="Password &amp; 2FA" hint="Sign-in security for this account.">
                    <div className="flex items-center justify-between p-4 bg-bg-muted/40 rounded-xl">
                      <div>
                        <p className="font-semibold text-sm">Password</p>
                        <p className="text-xs text-text-muted mt-0.5">Last changed when you signed up.</p>
                      </div>
                      <a href="/forgot-password" className="btn-ghost text-xs">Change password</a>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-bg-muted/40 rounded-xl">
                      <div>
                        <p className="font-semibold text-sm">Two-factor authentication</p>
                        <p className="text-xs text-text-muted mt-0.5">Adds a 6-digit code at sign-in.</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700">Coming soon</span>
                    </div>
                  </Card>
                )}

                {active === 'sessions' && (
                  <Card title="Active sessions" hint="Devices currently signed in to your account.">
                    <div className="flex items-center justify-between p-4 bg-bg-muted/40 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                          <Monitor size={16} className="text-emerald-700" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">This device</p>
                          <p className="text-xs text-text-muted mt-0.5">Signed in now · {typeof navigator !== 'undefined' ? navigator.platform : '—'}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Current</span>
                    </div>
                    <p className="text-xs text-text-muted">Per-device session history will land alongside 2FA.</p>
                  </Card>
                )}

                {active === 'members' && (
                  <Card
                    title={
                      <span className="inline-flex items-center gap-2">
                        Members
                        <span className="text-[10px] font-bold uppercase tracking-[.12em] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Coming soon
                        </span>
                      </span>
                    }
                    hint="Invite teammates to share campaigns &amp; billing."
                  >
                    <div className="p-6 border-2 border-dashed border-border rounded-xl text-center">
                      <UsersIcon size={20} className="inline-block text-text-muted mb-2" />
                      <p className="text-sm font-semibold">You are the only member</p>
                      <p className="text-xs text-text-muted mt-1 mb-3">Add up to 3 teammates on the Starter plan.</p>
                      <button className="btn-primary text-xs" disabled>Invite teammate</button>
                    </div>
                  </Card>
                )}

                {active === 'privacy' && (
                  <Card
                    title={
                      <span className="inline-flex items-center gap-2">
                        Privacy &amp; data
                        <span className="text-[10px] font-bold uppercase tracking-[.12em] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Coming soon
                        </span>
                      </span>
                    }
                    hint="Australian Privacy Principles apply."
                  >
                    <div className="flex items-center justify-between p-4 bg-bg-muted/40 rounded-xl">
                      <div>
                        <p className="font-semibold text-sm">Export my data</p>
                        <p className="text-xs text-text-muted mt-0.5">Download all campaigns, payments &amp; profile as JSON.</p>
                      </div>
                      <button className="btn-ghost text-xs" disabled>Request export</button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-bg-muted/40 rounded-xl">
                      <div>
                        <p className="font-semibold text-sm">Marketing communications</p>
                        <p className="text-xs text-text-muted mt-0.5">Receive tips &amp; product news.</p>
                      </div>
                      <Toggle inline defaultChecked={false} />
                    </div>
                  </Card>
                )}

                {active === 'danger' && (
                  <Card title="Danger zone" hint="These actions cannot be undone.">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-red-200 bg-red-50/40">
                      <div>
                        <p className="font-semibold text-sm text-red-700">Delete account</p>
                        <p className="text-xs text-red-700/70 mt-0.5">Removes profile, campaigns, and payment history.</p>
                      </div>
                      <button className="text-xs font-semibold px-3 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-40" disabled>
                        Delete account
                      </button>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Reusable bits
// ──────────────────────────────────────────────────────────────

function Card({ title, hint, children }: { title: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-border shadow-[0_2px_6px_rgba(11,13,18,.04)] p-5 lg:p-6">
      <h3 className="font-bold text-base">{title}</h3>
      {hint && <p className="text-sm text-text-muted mt-1 mb-5" dangerouslySetInnerHTML={{ __html: hint }} />}
      {!hint && <div className="mb-5" />}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  hint,
  defaultChecked = false,
  checked,
  onChange,
  inline = false,
}: {
  label?: string;
  hint?: string;
  defaultChecked?: boolean;
  /** Controlled — pass with onChange to lift state to the parent. */
  checked?: boolean;
  onChange?: (next: boolean) => void;
  inline?: boolean;
}) {
  const [internal, setInternal] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const on = isControlled ? checked : internal;
  const knob = (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        if (!isControlled) setInternal(next);
        onChange?.(next);
      }}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-primary' : 'bg-border'}`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`}
      />
    </button>
  );
  if (inline) return knob;
  return (
    <div className="flex items-start justify-between gap-4 p-3 -mx-3 rounded-xl hover:bg-bg-muted/30">
      <div>
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {hint && <p className="text-xs text-text-muted mt-0.5" dangerouslySetInnerHTML={{ __html: hint }} />}
      </div>
      {knob}
    </div>
  );
}


function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-text-primary mb-1.5">{label}</span>
      {children}
    </label>
  );
}
