import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/nav/types';
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
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { LogoMark } from '@/components/LogoMark';
import { Wordmark } from '@/components/Wordmark';
import { GradientButton } from '@/components/GradientButton';
import { colors, font, radii, spacing } from '@/theme';

/**
 * Sign in step 1 — email + password against the Nest API's Cognito hook.
 * Dev mode: tapping "Use demo account" pulls dropper Maya's user-id and signs
 * in via the x-dev-user-id impersonation header (same path the web app uses).
 */
type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export function LoginScreen() {
  const nav = useNavigation<Nav>();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      // Same endpoint + response shape the web app uses.
      const res = await api.post<{
        accessToken: string;
        idToken: string;
        refreshToken: string;
        expiresIn: number;
        provisioned: boolean;
        userId?: string;
        email?: string;
        role?: 'client' | 'dropper' | 'admin';
        message?: string;
      }>('/api/auth/login', { email, password });

      if (!res.provisioned) {
        setError(res.message ?? 'No DropTrack profile for this email yet.');
        return;
      }
      if (res.role !== 'dropper' && res.role !== 'admin') {
        setError('This account is not a dropper — sign in on the web instead.');
        return;
      }
      await signIn({
        userId: res.userId!,
        email: res.email!,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
    } catch (err) {
      const body = (err as { body?: { message?: unknown } }).body?.message;
      setError(typeof body === 'string' ? body : 'Sign-in failed — check your details.');
    } finally {
      setBusy(false);
    }
  }

  // Dev impersonation — bypasses Cognito so you can test against the running API.
  async function useDemoAccount() {
    await signIn({
      userId: '4c723024-6a16-4509-813c-f60c3a770862', // James (dropper) in the seeded DB
      email: 'james@droptrack.au',
      devUserId: '4c723024-6a16-4509-813c-f60c3a770862',
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.logoWrap}>
            <LogoMark size={72} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }}>
              <Wordmark size={24} />
              <View style={s.badge}>
                <Text style={s.badgeText}>DROPPER</Text>
              </View>
            </View>
            <Text style={s.subtitle}>Welcome back. Let&rsquo;s get walking.</Text>
          </View>

          <View style={s.form}>
            <Text style={s.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={s.input}
            />
            <Text style={[s.label, { marginTop: spacing.md }]}>Password</Text>
            <View style={s.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                style={[s.input, s.passwordInput]}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                style={s.eyeBtn}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            {error && <Text style={s.error}>{error}</Text>}

            <GradientButton
              onPress={handleSignIn}
              loading={busy}
              disabled={!email || !password}
              style={{ marginTop: spacing.lg }}
            >
              Sign in
            </GradientButton>

            <Text style={s.divider}>or</Text>
            <Pressable onPress={useDemoAccount} style={s.btnGhost}>
              <Text style={s.btnGhostText}>Use demo account (dev)</Text>
            </Pressable>

            <View style={s.registerRow}>
              <Text style={s.registerText}>New here? </Text>
              <Pressable onPress={() => nav.navigate('EnterInviteCode')} hitSlop={6}>
                <Text style={s.registerLink}>Register with invite code</Text>
              </Pressable>
            </View>
          </View>

          <Text style={s.fineprint}>
            By signing in you agree DropTrack owns all GPS &amp; tracking data collected during shifts.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingTop: spacing.xxl, alignItems: 'stretch' },
  logoWrap: { alignItems: 'center', marginBottom: spacing.xxl },
  title: { color: colors.text, fontWeight: '800', fontSize: 24, letterSpacing: -0.4 },
  badge: { backgroundColor: colors.card, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 6 },
  form: { width: '100%' },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: spacing.md,
    backgroundColor: 'rgba(239,68,68,0.08)',
    padding: spacing.md,
    borderRadius: radii.md,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  btnPrimaryText: { color: '#0a0a0a', fontWeight: '700', fontSize: 15 },
  divider: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: spacing.md },
  btnGhost: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhostText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl },
  registerText: { color: colors.textMuted, fontSize: 13 },
  registerLink: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  fineprint: { color: colors.textFaint, fontSize: 10, marginTop: spacing.xxl, textAlign: 'center', lineHeight: 14 },
});
