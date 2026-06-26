/**
 * Intermediate screen for droppers who got an invite via SMS or hand-typed
 * code rather than a tappable deep link.
 *
 *   1. paste the token (or the whole URL — we extract the token)
 *   2. tap Continue → AcceptInviteScreen pre-fills email + name from
 *      `GET /api/invites/:token` and asks them to set a password
 */
import { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '@/api/client';
import { LogoMark } from '@/components/LogoMark';
import { Wordmark } from '@/components/Wordmark';
import { GradientButton } from '@/components/GradientButton';
import { colors, radii, spacing } from '@/theme';
import type { AuthStackParamList } from '@/nav/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'EnterInviteCode'>;

export function EnterInviteCodeScreen() {
  const nav = useNavigation<Nav>();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setError(null);
    const token = extractToken(input.trim());
    if (!token) {
      setError('Paste your invite code or the full link.');
      return;
    }
    setBusy(true);
    try {
      // Verify before navigating so user gets an immediate error if it's bad.
      await api.get(`/api/invites/${encodeURIComponent(token)}`);
      nav.replace('AcceptInvite', { token });
    } catch (err) {
      const body = (err as { body?: { message?: unknown } }).body?.message;
      setError(typeof body === 'string' ? body : 'This invite is invalid, used, or expired.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.topRow}>
            <LogoMark size={36} />
            <Wordmark size={16} />
          </View>

          <View style={s.iconWrap}>
            <Ionicons name="mail-open-outline" size={28} color={colors.accent} />
          </View>

          <Text style={s.hero}>
            Have an invite code? <Text style={s.heroSerif}>— let&rsquo;s use it.</Text>
          </Text>
          <Text style={s.lede}>
            Paste the code or the full link your admin sent you. We&rsquo;ll prefill the rest from the invite.
          </Text>

          <Text style={s.label}>Invite code or link</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="e.g. droptrackdropper://accept?token=…"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={s.input}
          />

          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorBoxText}>{error}</Text>
            </View>
          )}

          <GradientButton onPress={check} loading={busy} disabled={!input.trim()} style={{ marginTop: spacing.lg }}>
            Continue
          </GradientButton>

          <Pressable onPress={() => nav.replace('Login')} style={s.linkBtn}>
            <Text style={s.linkBtnText}>← Back to sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Pull the token out of either a raw code, a deep link, or a web URL. */
function extractToken(raw: string): string | null {
  if (!raw) return null;
  // Already looks like a bare token (URL-safe base64, 24+ chars).
  if (/^[A-Za-z0-9_-]{16,}$/.test(raw)) return raw;
  // Try as a URL.
  const m = raw.match(/[?&]token=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.xl },
  iconWrap: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(163,230,53,0.10)',
    padding: 12,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  hero: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4, lineHeight: 28 },
  heroSerif: { color: colors.textFaint, fontWeight: '400', fontStyle: 'italic' },
  lede: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginTop: 6, marginBottom: spacing.lg },

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
    minHeight: 80,
    textAlignVertical: 'top',
  },

  errorBox: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.35)', borderWidth: 1 },
  errorBoxText: { color: colors.danger, fontSize: 12 },

  linkBtn: { alignSelf: 'center', marginTop: spacing.lg, padding: spacing.sm },
  linkBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
