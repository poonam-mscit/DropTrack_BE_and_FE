import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { LogoMark } from '@/components/LogoMark';
import { Wordmark } from '@/components/Wordmark';
import { GradientButton } from '@/components/GradientButton';
import { colors, radii, spacing } from '@/theme';

interface InvitePeek {
  email: string;
  role: 'dropper';
  prefill: { firstName?: string; lastName?: string; primaryZone?: string } | null;
  expiresAt: string;
}

export function AcceptInviteScreen({ token, onCancel }: { token: string; onCancel: () => void }) {
  const { signIn } = useAuth();
  const [peek, setPeek] = useState<InvitePeek | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const p = await api.get<InvitePeek>(`/api/invites/${token}`);
        setPeek(p);
        setFirstName(p.prefill?.firstName ?? '');
        setLastName(p.prefill?.lastName ?? '');
      } catch (err) {
        const body = (err as { body?: { message?: unknown } }).body?.message;
        setVerifyError(typeof body === 'string' ? body : 'This invite is invalid, used, or expired.');
      }
    })();
  }, [token]);

  async function accept() {
    setSubmitError(null);
    if (password.length < 10) {
      setSubmitError('Password must be at least 10 characters.');
      return;
    }
    if (password !== confirm) {
      setSubmitError("Passwords don't match.");
      return;
    }
    setAccepted(true);
    try {
      const res = await api.post<{
        accessToken: string;
        refreshToken: string;
        userId: string;
        email: string;
      }>('/api/auth/accept-dropper-invite', {
        token,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      });
      await signIn({
        userId: res.userId,
        email: res.email,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
    } catch (err) {
      const body = (err as { body?: { message?: unknown } }).body?.message;
      setSubmitError(typeof body === 'string' ? body : (err as Error).message);
      setAccepted(false);
    }
  }

  if (verifyError) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={[s.center, { padding: spacing.xl, flex: 1 }]}>
          <Ionicons name="alert-circle" size={32} color={colors.danger} />
          <Text style={s.errorTitle}>Invite unavailable</Text>
          <Text style={s.errorBody}>{verifyError}</Text>
          <Pressable onPress={onCancel} style={s.linkBtn}>
            <Text style={s.linkBtnText}>Back to sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!peek) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={[s.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.topRow}>
            <LogoMark size={36} />
            <Wordmark size={16} />
            <View style={s.ribbon}>
              <Text style={s.ribbonText}>● Invite valid 7 days</Text>
            </View>
          </View>

          <Text style={s.hero}>
            Welcome{firstName ? `, ${firstName}` : ''} <Text style={s.heroSerif}>— let&rsquo;s set you up.</Text>
          </Text>
          <Text style={s.lede}>
            Create a password to activate your DropTrack account. You&rsquo;ll fill in the rest of your details
            after you sign in.
          </Text>

          <Field label="Email" value={peek.email} editable={false} />

          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <Field label="First name" value={firstName} onChangeText={setFirstName} />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="(optional)"
              />
            </View>
          </View>

          <PasswordField
            label="Create password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 10 characters"
            show={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />
          <PasswordField
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter password"
            show={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />

          {submitError && (
            <View style={s.errorBox}>
              <Text style={s.errorBoxText}>{submitError}</Text>
            </View>
          )}

          <GradientButton onPress={accept} loading={accepted} style={{ marginTop: spacing.lg }}>
            Create account
          </GradientButton>

          <Pressable onPress={onCancel} style={s.linkBtn}>
            <Text style={s.linkBtnText}>Already have an account? Sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        autoCapitalize="words"
        style={[s.input, !editable && { color: colors.textFaint }]}
      />
    </View>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  show,
  onToggle,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={s.label}>{label}</Text>
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          secureTextEntry={!show}
          autoCapitalize="none"
          style={[s.input, { paddingRight: 44 }]}
        />
        <Pressable onPress={onToggle} hitSlop={10} style={s.eyeBtn}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  center: { alignItems: 'center', justifyContent: 'center' },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg },
  ribbon: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(163,230,53,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ribbonText: { color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  hero: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 30, marginBottom: 8 },
  heroSerif: { color: colors.textFaint, fontWeight: '400', fontStyle: 'italic' },
  lede: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: spacing.lg },

  twoCol: { flexDirection: 'row', gap: spacing.sm },
  label: { color: colors.textFaint, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radii.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },

  errorBox: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.35)', borderWidth: 1 },
  errorBoxText: { color: colors.danger, fontSize: 12 },
  errorTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: spacing.md, marginBottom: 4 },
  errorBody: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  linkBtn: { alignSelf: 'center', marginTop: spacing.lg, padding: spacing.sm },
  linkBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
});
