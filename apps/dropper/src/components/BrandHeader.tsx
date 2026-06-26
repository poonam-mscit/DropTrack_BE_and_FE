/**
 * Brand header for the dropper app — DropTrack logo + wordmark on the left,
 * avatar on the right. Used as the consistent top bar across primary screens.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LogoMark } from './LogoMark';
import { Wordmark } from './Wordmark';
import { useAuth } from '@/auth/AuthContext';
import { colors, spacing } from '@/theme';
import type { RootStackParamList } from '@/nav/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  /** Override avatar initials; defaults to first two letters of the email. */
  initials?: string;
  /** Optional logo url for the avatar image (e.g. business profile logo). */
  avatarUrl?: string | null;
}

export function BrandHeader({ initials, avatarUrl }: Props) {
  const nav = useNavigation<Nav>();
  const { session } = useAuth();

  const fallbackInitials = (session?.email ?? 'DT').slice(0, 2).toUpperCase();
  const label = initials ?? fallbackInitials;

  return (
    <View style={s.row}>
      <View style={s.left}>
        <LogoMark size={32} />
        <Wordmark size={17} />
      </View>

      <Pressable onPress={() => nav.navigate('Profile')} hitSlop={6}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{label}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
