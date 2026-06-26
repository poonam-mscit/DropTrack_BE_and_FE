/**
 * Brand-gradient button matching the web's primary CTA — indigo→violet→lime.
 *
 *   <GradientButton onPress={…} loading={busy}>Sign in</GradientButton>
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '@/theme';

interface Props {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
  /** Optional Ionicons name shown to the left of the label. */
  iconLeft?: keyof typeof Ionicons.glyphMap;
  /** 'lg' for hero CTAs (Mark Drop), 'md' default, 'sm' compact. */
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export function GradientButton({
  onPress,
  disabled,
  loading,
  iconLeft,
  size = 'md',
  style,
  children,
}: Props) {
  const padding = size === 'lg' ? 22 : size === 'sm' ? 10 : 14;
  const fontSize = size === 'lg' ? 18 : size === 'sm' ? 13 : 15;
  const inert = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      style={({ pressed }) => [
        s.wrap,
        style,
        inert && { opacity: 0.45 },
        pressed && !inert && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <LinearGradient
        colors={['#6366f1', '#7c3aed', '#a3e635']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.gradient, { paddingVertical: padding }]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={s.row}>
            {iconLeft && <Ionicons name={iconLeft} size={fontSize + 2} color="#fff" style={{ marginRight: 8 }} />}
            <Text style={[s.label, { fontSize }]}>{children}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: radii.md, overflow: 'hidden' },
  gradient: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#fff', fontWeight: '800', letterSpacing: 0.2 },
});
