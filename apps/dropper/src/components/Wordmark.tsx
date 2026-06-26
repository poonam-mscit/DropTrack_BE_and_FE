/**
 * "DropTrack" wordmark — single Text node so it baseline-aligns cleanly with
 * the LogoMark and any surrounding text/badge in a flex row.
 *
 * (Previous version embedded a custom SVG "T" with an extended crossbar, but
 * RN's flexbox doesn't baseline-align Views with Text, so the T floated out
 * of position. Plain weighted text is the reliable cross-platform path.)
 */
import { StyleSheet, Text } from 'react-native';
import { colors } from '@/theme';

interface Props {
  size?: number;
  color?: string;
}

export function Wordmark({ size = 16, color = colors.text }: Props) {
  return <Text style={[s.text, { fontSize: size, color }]}>DropTrack</Text>;
}

const s = StyleSheet.create({
  text: { fontWeight: '800', letterSpacing: -0.3, includeFontPadding: false },
});
