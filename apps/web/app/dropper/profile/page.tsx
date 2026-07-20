'use client';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { PasswordInput } from '@/components/PasswordInput';

type AuState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
const AU_STATES: AuState[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

interface MeProfile {
  user: { id: string; email: string; mobile?: string | null };
  dropper: {
    employeeId: string;
    firstName: string;
    lastName: string;
    dob: string | null;
    addressLine1: string | null;
    suburb: string | null;
    state: AuState | null;
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
  } | null;
}

interface Form {
  firstName: string;
  lastName: string;
  dob: string;
  mobile: string;
  addressLine1: string;
  suburb: string;
  state: AuState | '';
  postcode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  tfn: string;
  superFundName: string;
  superMemberNumber: string;
  bankBsb: string;
  bankAccountNumber: string;
  wwccNumber: string;
  wwccExpiresAt: string;
  primaryZone: string;
}

const empty: Form = {
  firstName: '', lastName: '', dob: '', mobile: '',
  addressLine1: '', suburb: '', state: '', postcode: '',
  emergencyContactName: '', emergencyContactPhone: '',
  tfn: '', superFundName: '', superMemberNumber: '',
  bankBsb: '', bankAccountNumber: '',
  wwccNumber: '', wwccExpiresAt: '', primaryZone: '',
};

function restrictName(v: string): string {
  return v.replace(/[^A-Za-z\s'\-]/g, '');
}

function restrictPhone(v: string): string {
  const clean = v.replace(/[^\d\s]/g, '');
  return clean.slice(0, 14);
}

function restrictDigits(v: string, maxLen?: number): string {
  const clean = v.replace(/\D/g, '');
  return maxLen ? clean.slice(0, maxLen) : clean;
}

function restrictBsb(v: string): string {
  const clean = v.replace(/[^\d\-]/g, '');
  return clean.slice(0, 7);
}

function validateProfileForm(form: Form, profile: MeProfile | null): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.firstName.trim()) {
    errors.firstName = 'First name is required';
  } else if (!/^[A-Za-z\s'\-]+$/.test(form.firstName.trim())) {
    errors.firstName = 'Letters, spaces, hyphens, and apostrophes only';
  }

  if (!form.lastName.trim()) {
    errors.lastName = 'Last name is required';
  } else if (!/^[A-Za-z\s'\-]+$/.test(form.lastName.trim())) {
    errors.lastName = 'Letters, spaces, hyphens, and apostrophes only';
  }

  if (!form.dob) {
    errors.dob = 'Date of birth is required';
  } else {
    const dobDate = new Date(form.dob);
    const today = new Date();
    if (isNaN(dobDate.getTime())) {
      errors.dob = 'Invalid date of birth';
    } else if (dobDate >= today) {
      errors.dob = 'Date of birth must be in the past';
    } else {
      const ageYears = (today.getTime() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears < 14) {
        errors.dob = 'Must be at least 14 years old';
      }
    }
  }

  const mobileDigits = form.mobile.replace(/\D/g, '');
  if (!form.mobile.trim()) {
    errors.mobile = 'Mobile number is required';
  } else if (mobileDigits.length !== 10) {
    errors.mobile = 'Mobile number must be 10 digits (e.g. 0412 345 678)';
  }

  if (!form.addressLine1.trim()) {
    errors.addressLine1 = 'Street address is required';
  }

  if (!form.suburb.trim()) {
    errors.suburb = 'Suburb is required';
  } else if (!/^[A-Za-z\s'\-]+$/.test(form.suburb.trim())) {
    errors.suburb = 'Letters, spaces, hyphens, and apostrophes only';
  }

  if (!form.state) {
    errors.state = 'State is required';
  }

  const postcodeDigits = form.postcode.replace(/\D/g, '');
  if (!form.postcode.trim()) {
    errors.postcode = 'Postcode is required';
  } else if (postcodeDigits.length !== 4) {
    errors.postcode = 'Postcode must be 4 digits';
  }

  if (!form.emergencyContactName.trim()) {
    errors.emergencyContactName = 'Emergency contact name is required';
  } else if (!/^[A-Za-z\s'\-]+$/.test(form.emergencyContactName.trim())) {
    errors.emergencyContactName = 'Letters, spaces, hyphens, and apostrophes only';
  }

  const emergencyDigits = form.emergencyContactPhone.replace(/\D/g, '');
  if (!form.emergencyContactPhone.trim()) {
    errors.emergencyContactPhone = 'Emergency contact phone is required';
  } else if (emergencyDigits.length < 8 || emergencyDigits.length > 11) {
    errors.emergencyContactPhone = 'Must be a valid phone number (e.g. 0412 345 678)';
  }

  const tfnDigits = form.tfn.replace(/\D/g, '');
  const hasExistingTfn = !!profile?.dropper?.tfnLast4;
  if (!hasExistingTfn && !form.tfn.trim()) {
    errors.tfn = 'TFN is required';
  } else if (form.tfn.trim() && (tfnDigits.length < 8 || tfnDigits.length > 9)) {
    errors.tfn = 'TFN must be 8 or 9 digits';
  }

  if (form.bankBsb.trim()) {
    const bsbDigits = form.bankBsb.replace(/\D/g, '');
    if (bsbDigits.length !== 6) {
      errors.bankBsb = 'BSB must be 6 digits (e.g. 012-345)';
    }
  }

  if (form.bankAccountNumber.trim()) {
    const accDigits = form.bankAccountNumber.replace(/\D/g, '');
    if (accDigits.length < 4 || accDigits.length > 12) {
      errors.bankAccountNumber = 'Account number must be between 4 and 12 digits';
    }
  }

  if (form.wwccExpiresAt.trim()) {
    const expiryDate = new Date(form.wwccExpiresAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(expiryDate.getTime())) {
      errors.wwccExpiresAt = 'Invalid expiry date';
    } else if (expiryDate < today) {
      errors.wwccExpiresAt = 'WWCC expiry date must be in the future';
    }
  }

  return errors;
}

export default function DropperProfilePage() {
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const p = await api.get<MeProfile>('/api/me/profile');
      setProfile(p);
      const d = p.dropper;
      setForm({
        firstName: d?.firstName ?? '',
        lastName: d?.lastName ?? '',
        dob: d?.dob ?? '',
        mobile: p.user.mobile ?? '',
        addressLine1: d?.addressLine1 ?? '',
        suburb: d?.suburb ?? '',
        state: d?.state ?? '',
        postcode: d?.postcode ?? '',
        emergencyContactName: d?.emergencyContactName ?? '',
        emergencyContactPhone: d?.emergencyContactPhone ?? '',
        tfn: '',
        superFundName: d?.superFundName ?? '',
        superMemberNumber: d?.superMemberNumber ?? '',
        bankBsb: d?.bankBsb ?? '',
        bankAccountNumber: '',
        wwccNumber: d?.wwccNumber ?? '',
        wwccExpiresAt: d?.wwccExpiresAt ?? '',
        primaryZone: d?.primaryZone ?? '',
      });
      setFieldErrors({});
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function setField<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((errs) => {
        const next = { ...errs };
        delete next[key];
        return next;
      });
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const errs = validateProfileForm(form, profile);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Please fix the highlighted errors before saving.');
      setSaving(false);
      return;
    }
    setFieldErrors({});

    try {
      if (form.mobile && form.mobile !== (profile?.user.mobile ?? '')) {
        await api.patch('/api/me/profile', { mobile: form.mobile || null });
      }
      const patch: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dob: form.dob || null,
        addressLine1: form.addressLine1.trim() || null,
        suburb: form.suburb.trim() || null,
        state: form.state || null,
        postcode: form.postcode.trim() || null,
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
        superFundName: form.superFundName.trim() || null,
        superMemberNumber: form.superMemberNumber.trim() || null,
        bankBsb: form.bankBsb.replace(/[^0-9]/g, '') || null,
        wwccNumber: form.wwccNumber.trim() || null,
        wwccExpiresAt: form.wwccExpiresAt || null,
        primaryZone: form.primaryZone.trim() || null,
      };
      if (form.tfn.trim()) patch.tfn = form.tfn.replace(/\s/g, '');
      if (form.bankAccountNumber.trim()) patch.bankAccountNumber = form.bankAccountNumber.replace(/\s/g, '');
      await api.patch('/api/me/dropper-profile', patch);
      setSaved(true);
      await load();
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      const body = (e as { body?: { message?: unknown } }).body?.message;
      setError(typeof body === 'string' ? body : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <div className="py-10 text-center text-white/40 text-sm"><Loader2 size={18} className="inline animate-spin mr-2" /> Loading…</div>;

  const complete = profile.dropper?.onboardingStatus === 'complete';

  return (
    <div className="pb-8">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xl font-extrabold">
          {(form.firstName[0] ?? profile.user.email[0]).toUpperCase()}
          {(form.lastName[0] ?? '').toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-base leading-tight truncate">{form.firstName} {form.lastName}</p>
          <p className="text-white/50 text-xs truncate">{profile.user.email}</p>
          {profile.dropper?.employeeId && <p className="text-white/40 text-[11px]">{profile.dropper.employeeId}</p>}
        </div>
      </div>

      <div className={`rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2 text-sm ${
        complete ? 'bg-emerald-400/10 text-emerald-200 border border-emerald-400/30' : 'bg-amber-400/10 text-amber-200 border border-amber-400/30'
      }`}>
        {complete ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
        <span>{complete ? 'Onboarding complete — you can be assigned jobs.' : 'Complete the four required sections below to be assignable.'}</span>
      </div>

      <Section title="Your name" required>
        <Grid>
          <Input label="First name" value={form.firstName} onChange={(v) => setField('firstName', restrictName(v))} error={fieldErrors.firstName} />
          <Input label="Last name" value={form.lastName} onChange={(v) => setField('lastName', restrictName(v))} error={fieldErrors.lastName} />
        </Grid>
        <Input label="Date of birth" type="date" value={form.dob} onChange={(v) => setField('dob', v)} error={fieldErrors.dob} />
        <Input label="Mobile" type="tel" value={form.mobile} onChange={(v) => setField('mobile', restrictPhone(v))} placeholder="04xx xxx xxx" error={fieldErrors.mobile} />
      </Section>

      <Section title="Home address" required>
        <Input label="Street address" value={form.addressLine1} onChange={(v) => setField('addressLine1', v)} placeholder="1 George St" error={fieldErrors.addressLine1} />
        <Grid>
          <Input label="Suburb" value={form.suburb} onChange={(v) => setField('suburb', restrictName(v))} error={fieldErrors.suburb} />
          <Select
            label="State"
            value={form.state}
            options={AU_STATES}
            onChange={(v) => setField('state', (v || '') as Form['state'])}
            error={fieldErrors.state}
          />
        </Grid>
        <Input label="Postcode" value={form.postcode} onChange={(v) => setField('postcode', restrictDigits(v, 4))} placeholder="2000" error={fieldErrors.postcode} />
      </Section>

      <Section title="Emergency contact" required>
        <Input label="Name" value={form.emergencyContactName} onChange={(v) => setField('emergencyContactName', restrictName(v))} error={fieldErrors.emergencyContactName} />
        <Input label="Phone" type="tel" value={form.emergencyContactPhone} onChange={(v) => setField('emergencyContactPhone', restrictPhone(v))} error={fieldErrors.emergencyContactPhone} />
      </Section>

      <Section title="Tax file number" required>
        <SecretInput
          label={profile.dropper?.tfnLast4 ? `Saved — ends ${profile.dropper.tfnLast4}` : 'TFN (9 digits)'}
          value={form.tfn}
          onChange={(v) => setField('tfn', restrictDigits(v, 9))}
          placeholder={profile.dropper?.tfnLast4 ? 'Enter a new TFN to replace' : '123 456 789'}
          error={fieldErrors.tfn}
        />
      </Section>

      <Section title="Superannuation" optional>
        <Input label="Super fund name" value={form.superFundName} onChange={(v) => setField('superFundName', v)} />
        <Input label="Member number" value={form.superMemberNumber} onChange={(v) => setField('superMemberNumber', v)} />
      </Section>

      <Section title="Bank account" optional>
        <Input label="BSB (6 digits)" value={form.bankBsb} onChange={(v) => setField('bankBsb', restrictBsb(v))} placeholder="012-345" error={fieldErrors.bankBsb} />
        <SecretInput
          label={profile.dropper?.bankAccountLast4 ? `Saved — ends ${profile.dropper.bankAccountLast4}` : 'Account number'}
          value={form.bankAccountNumber}
          onChange={(v) => setField('bankAccountNumber', restrictDigits(v, 12))}
          placeholder={profile.dropper?.bankAccountLast4 ? 'Enter a new account to replace' : ''}
          error={fieldErrors.bankAccountNumber}
        />
      </Section>

      <Section title="Working with children" optional>
        <Input label="WWCC number" value={form.wwccNumber} onChange={(v) => setField('wwccNumber', v)} />
        <Input label="Expires" type="date" value={form.wwccExpiresAt} onChange={(v) => setField('wwccExpiresAt', v)} error={fieldErrors.wwccExpiresAt} />
      </Section>

      <Section title="Preferred zone" optional>
        <Input label="Primary zone" value={form.primaryZone} onChange={(v) => setField('primaryZone', v)} placeholder="e.g. Griffith, Canberra" />
      </Section>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-200">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-400/10 border border-emerald-400/30 text-sm text-emerald-200 flex items-center gap-2">
          <CheckCircle2 size={14} /> Saved.
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 text-emerald-950 font-bold py-4 active:bg-emerald-500 disabled:opacity-50"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save profile
      </button>

      <p className="text-[11px] text-white/40 text-center mt-6">
        Drop Track Pty Ltd · ABN 39 697 128 920
      </p>
    </div>
  );
}

function Section({
  title,
  children,
  required,
  optional,
}: {
  title: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[.14em] text-white/50">{title}</h2>
        {required && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded px-1.5 py-0.5">
            Required
          </span>
        )}
        {optional && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
            Optional
          </span>
        )}
      </div>
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Input({
  label, value, onChange, placeholder, type = 'text', error,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; error?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[.08em] text-white/60 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl bg-white/5 border px-3 py-2.5 text-sm placeholder-white/30 focus:outline-none ${
          error ? 'border-red-500/50 focus:border-red-400' : 'border-white/15 focus:border-emerald-400'
        }`}
      />
      {error && <span className="block text-[11px] text-red-400 mt-1">{error}</span>}
    </label>
  );
}

function Select({
  label, value, options, onChange, error,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; error?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[.08em] text-white/60 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl bg-white/5 border px-3 py-2.5 text-sm focus:outline-none ${
          error ? 'border-red-500/50 focus:border-red-400' : 'border-white/15 focus:border-emerald-400'
        }`}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o} className="text-black">{o}</option>
        ))}
      </select>
      {error && <span className="block text-[11px] text-red-400 mt-1">{error}</span>}
    </label>
  );
}

function SecretInput({
  label, value, onChange, placeholder, error,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[.08em] text-white/60 mb-1">{label}</span>
      <PasswordInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl bg-white/5 border pl-3 pr-10 py-2.5 text-sm placeholder-white/30 focus:outline-none ${
          error ? 'border-red-500/50 focus:border-red-400' : 'border-white/15 focus:border-emerald-400'
        }`}
      />
      {error && <span className="block text-[11px] text-red-400 mt-1">{error}</span>}
    </label>
  );
}
