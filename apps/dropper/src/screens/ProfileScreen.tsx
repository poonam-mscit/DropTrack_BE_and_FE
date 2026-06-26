/**
 * Dropper profile editor — sectioned form covering every dropper_profiles field.
 * Saves via PATCH /api/me/dropper-profile.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { BrandHeader } from '@/components/BrandHeader';
import { GradientButton } from '@/components/GradientButton';
import { colors, radii, spacing } from '@/theme';

type AuState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
const AU_STATES: AuState[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

interface Dropper {
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
  contractSignedAt: string | null;
}
interface MeProfile {
  user: { email: string; mobile: string | null };
  dropper: Dropper | null;
}

interface FormState {
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

const BLANK: FormState = {
  firstName: '', lastName: '', dob: '', mobile: '',
  addressLine1: '', suburb: '', state: '', postcode: '',
  emergencyContactName: '', emergencyContactPhone: '',
  tfn: '', superFundName: '', superMemberNumber: '',
  bankBsb: '', bankAccountNumber: '',
  wwccNumber: '', wwccExpiresAt: '', primaryZone: '',
};

export function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await api.get<MeProfile>('/api/me/profile');
      setProfile(p);
      setForm({
        firstName: cap(p.dropper?.firstName) ?? '',
        lastName: cap(p.dropper?.lastName) ?? '',
        dob: p.dropper?.dob ?? '',
        mobile: p.user.mobile ?? '',
        addressLine1: p.dropper?.addressLine1 ?? '',
        suburb: p.dropper?.suburb ?? '',
        state: p.dropper?.state ?? '',
        postcode: p.dropper?.postcode ?? '',
        emergencyContactName: p.dropper?.emergencyContactName ?? '',
        emergencyContactPhone: p.dropper?.emergencyContactPhone ?? '',
        tfn: '',
        superFundName: p.dropper?.superFundName ?? '',
        superMemberNumber: p.dropper?.superMemberNumber ?? '',
        bankBsb: p.dropper?.bankBsb ?? '',
        bankAccountNumber: '',
        wwccNumber: p.dropper?.wwccNumber ?? '',
        wwccExpiresAt: p.dropper?.wwccExpiresAt ?? '',
        primaryZone: p.dropper?.primaryZone ?? '',
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // Mobile lives on users; everything else on dropper_profiles.
      if (form.mobile !== (profile?.user.mobile ?? '')) {
        await api.patch('/api/me/profile', { mobile: form.mobile || null });
      }

      const dp: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dob: form.dob || null,
        addressLine1: form.addressLine1.trim() || null,
        suburb: form.suburb.trim() || null,
        state: (form.state || null) as AuState | null,
        postcode: form.postcode.trim() || null,
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
        superFundName: form.superFundName.trim() || null,
        superMemberNumber: form.superMemberNumber.trim() || null,
        bankBsb: form.bankBsb.trim() || null,
        wwccNumber: form.wwccNumber.trim() || null,
        wwccExpiresAt: form.wwccExpiresAt || null,
        primaryZone: form.primaryZone.trim() || null,
      };
      // Only send sensitive fields when user actually typed something — empty
      // string keeps the existing stored value untouched.
      if (form.tfn) dp.tfn = form.tfn.replace(/\s/g, '');
      if (form.bankAccountNumber) dp.bankAccountNumber = form.bankAccountNumber.replace(/\s/g, '');

      const next = await api.patch<MeProfile>('/api/me/dropper-profile', dp);
      setProfile(next);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2200);
    } catch (err) {
      const body = (err as { body?: { message?: unknown } }).body?.message;
      setError(typeof body === 'string' ? body : (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // 6-section completeness gauge — drives the status card progress bar.
  const progress = useMemo(() => sectionCompleteness(profile, form), [profile, form]);

  if (!profile) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <BrandHeader />
        <View style={[s.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const initials = ((profile.dropper?.firstName?.[0] ?? '') + (profile.dropper?.lastName?.[0] ?? '')).toUpperCase() || 'DT';
  const complete = progress.done === progress.total;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <BrandHeader initials={initials} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Identity */}
          <View style={s.identityRow}>
            <View style={s.avatarLg}>
              <Text style={s.avatarLgText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.identityName}>{profile.dropper?.firstName} {profile.dropper?.lastName}</Text>
              <Text style={s.identitySub}>
                {profile.dropper?.employeeId ?? 'New dropper'} · {profile.user.email}
              </Text>
            </View>
          </View>

          {/* Status banner */}
          <View style={[s.statusCard, complete && s.statusCardOk]}>
            <View style={s.statusHead}>
              <View style={[s.statusIcon, complete && { backgroundColor: colors.accent }]}>
                <Ionicons name={complete ? 'checkmark' : 'alert'} size={18} color="#0a0a0a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statusTitle}>
                  {complete ? 'Profile complete' : 'Profile incomplete'}
                </Text>
                <Text style={s.statusSub}>
                  {complete
                    ? 'Admin can assign you jobs.'
                    : "Admin can't assign jobs until you're done."}
                </Text>
              </View>
            </View>
            <Text style={s.statusBody}>
              Fill in the sections below — should take about 10 minutes. Save anytime and come back.
            </Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, complete && { backgroundColor: colors.accent }, { width: `${(progress.done / progress.total) * 100}%` }]} />
            </View>
            <Text style={s.progressText}>{progress.done} of {progress.total} sections complete</Text>
          </View>

          {/* Personal */}
          <Section title="Personal details" icon="person-outline" done={progress.flags.personal}>
            <Row two>
              <Field label="First name" value={form.firstName} onChangeText={(v) => field('firstName', v)} />
              <Field label="Last name" value={form.lastName} onChangeText={(v) => field('lastName', v)} />
            </Row>
            <Field
              label="Date of birth"
              value={form.dob}
              placeholder="YYYY-MM-DD"
              onChangeText={(v) => field('dob', v)}
              maxLength={10}
              keyboardType="numbers-and-punctuation"
            />
            <Field
              label="Mobile"
              value={form.mobile}
              placeholder="04xx xxx xxx"
              onChangeText={(v) => field('mobile', v)}
              keyboardType="phone-pad"
            />
          </Section>

          {/* Address */}
          <Section title="Address" icon="home-outline" done={progress.flags.address}>
            <Field
              label="Street address"
              value={form.addressLine1}
              placeholder="12 King St"
              onChangeText={(v) => field('addressLine1', v)}
            />
            <Row two>
              <Field
                label="Suburb"
                value={form.suburb}
                onChangeText={(v) => field('suburb', v)}
              />
              <Field
                label="Postcode"
                value={form.postcode}
                onChangeText={(v) => field('postcode', v)}
                keyboardType="number-pad"
                maxLength={4}
              />
            </Row>
            <SelectField
              label="State"
              value={form.state}
              options={AU_STATES.map((x) => ({ value: x, label: x }))}
              onChange={(v) => field('state', v as AuState)}
            />
            <Field
              label="Primary work zone"
              value={form.primaryZone}
              placeholder="e.g. Bondi / Eastern Suburbs"
              onChangeText={(v) => field('primaryZone', v)}
            />
          </Section>

          {/* Emergency */}
          <Section title="Emergency contact" icon="medkit-outline" done={progress.flags.emergency}>
            <Field
              label="Name"
              value={form.emergencyContactName}
              onChangeText={(v) => field('emergencyContactName', v)}
            />
            <Field
              label="Phone"
              value={form.emergencyContactPhone}
              onChangeText={(v) => field('emergencyContactPhone', v)}
              placeholder="0412 345 678"
              keyboardType="phone-pad"
            />
          </Section>

          {/* TFN */}
          <Section title="Tax File Number" icon="receipt-outline" done={progress.flags.tfn}>
            <Field
              label={profile.dropper?.tfnLast4 ? `TFN  •••• ${profile.dropper.tfnLast4}` : 'TFN'}
              value={form.tfn}
              onChangeText={(v) => field('tfn', v)}
              placeholder={profile.dropper?.tfnLast4 ? 'Leave blank to keep existing' : '000 000 000'}
              keyboardType="number-pad"
              maxLength={11}
              secureTextEntry={!!profile.dropper?.tfnLast4 && !form.tfn}
            />
          </Section>

          {/* Super */}
          <Section title="Superannuation" icon="trending-up-outline" done={progress.flags.super}>
            <Field
              label="Fund name"
              value={form.superFundName}
              onChangeText={(v) => field('superFundName', v)}
              placeholder="e.g. Australian Retirement Trust"
            />
            <Field
              label="Member number"
              value={form.superMemberNumber}
              onChangeText={(v) => field('superMemberNumber', v)}
            />
          </Section>

          {/* Bank */}
          <Section title="Bank for payroll" icon="cash-outline" done={progress.flags.bank}>
            <Row two>
              <Field
                label="BSB"
                value={form.bankBsb}
                onChangeText={(v) => field('bankBsb', v)}
                placeholder="000-000"
                keyboardType="number-pad"
              />
              <Field
                label={profile.dropper?.bankAccountLast4 ? `Acc •••• ${profile.dropper.bankAccountLast4}` : 'Account'}
                value={form.bankAccountNumber}
                onChangeText={(v) => field('bankAccountNumber', v)}
                placeholder={profile.dropper?.bankAccountLast4 ? 'Leave blank to keep' : '0000 0000'}
                keyboardType="number-pad"
              />
            </Row>
          </Section>

          {/* WWCC */}
          <Section title="WWCC (optional)" icon="shield-checkmark-outline" done={progress.flags.wwcc}>
            <Field
              label="WWCC number"
              value={form.wwccNumber}
              onChangeText={(v) => field('wwccNumber', v)}
              placeholder="Skip if N/A"
            />
            <Field
              label="Expires"
              value={form.wwccExpiresAt}
              onChangeText={(v) => field('wwccExpiresAt', v)}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </Section>

          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {savedTick && (
            <View style={s.savedBox}>
              <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
              <Text style={s.savedText}>Saved</Text>
            </View>
          )}

          <GradientButton onPress={save} loading={saving} style={{ marginTop: spacing.lg }}>
            Save progress
          </GradientButton>

          <Pressable onPress={signOut} style={s.signOut}>
            <Text style={s.signOutText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Reusable bits ─────────────────────────────────────────────────

function Section({
  title,
  icon,
  done,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <View style={s.sectionTitleRow}>
          <Ionicons name={icon} size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <Text style={s.sectionTitle}>{title}</Text>
        </View>
        <View style={[s.pill, done ? s.pillDone : s.pillTodo]}>
          {done && <Ionicons name="checkmark" size={11} color={colors.accent} style={{ marginRight: 2 }} />}
          <Text style={[s.pillText, done ? s.pillTextDone : s.pillTextTodo]}>
            {done ? 'Done' : 'To do'}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad' | 'numbers-and-punctuation';
  maxLength?: number;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize="words"
        style={s.input}
      />
    </View>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.selectRow}>
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(selected ? '' : o.value)}
              style={[s.chip, selected && s.chipSelected]}
            >
              <Text style={[s.chipText, selected && s.chipTextSelected]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Row({ children, two }: { children: React.ReactNode; two?: boolean }) {
  return <View style={[s.row, two && { gap: spacing.sm }]}>{children}</View>;
}

// ── Helpers ───────────────────────────────────────────────────────

function cap(s?: string | null): string | null {
  if (!s) return null;
  return s[0].toUpperCase() + s.slice(1);
}

function sectionCompleteness(p: MeProfile | null, f: FormState) {
  const flags = {
    personal: !!f.firstName && !!f.lastName && !!(f.dob || p?.dropper?.dob) && !!f.mobile,
    address: !!f.addressLine1 && !!f.suburb && !!f.state && !!f.postcode,
    emergency: !!f.emergencyContactName && !!f.emergencyContactPhone,
    tfn: !!(p?.dropper?.tfnLast4 || f.tfn),
    super: !!f.superFundName,
    bank: !!f.bankBsb && !!(p?.dropper?.bankAccountLast4 || f.bankAccountNumber),
    wwcc: true, // optional — counts as complete
  };
  const done = Object.values(flags).filter(Boolean).length;
  return { done, total: 7, flags };
}

// ── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  avatarLg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLgText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  identityName: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  identitySub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  statusCard: {
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.3)',
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  statusCardOk: {
    backgroundColor: 'rgba(163,230,53,0.10)',
    borderColor: 'rgba(163,230,53,0.35)',
  },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  statusSub: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  statusBody: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 8, marginBottom: 10, lineHeight: 18 },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#F59E0B' },
  progressText: { color: colors.textFaint, fontSize: 11, marginTop: 6 },

  section: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.borderSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillTodo: { backgroundColor: 'rgba(245,158,11,0.18)' },
  pillDone: { backgroundColor: 'rgba(163,230,53,0.2)' },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  pillTextTodo: { color: '#FBBF24' },
  pillTextDone: { color: colors.accent },

  label: { color: colors.textFaint, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radii.md,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 14,
  },
  row: { flexDirection: 'row' },

  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: '#0a0a0a' },

  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.3)',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: 12 },
  savedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  savedText: { color: colors.accent, fontSize: 12, fontWeight: '700' },

  signOut: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  signOutText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
});
