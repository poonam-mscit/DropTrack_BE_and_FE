import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { api } from '@/api/client';
import { BrandHeader } from '@/components/BrandHeader';
import { GradientButton } from '@/components/GradientButton';
import { colors, radii, spacing } from '@/theme';
import type { RootStackParamList } from '@/nav/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'JobDetail'>;
type Route = RouteProp<RootStackParamList, 'JobDetail'>;

interface Detail {
  assignment: { id: string; status: string };
  job: { id: string; code: string; title: string; leafletCount: number; startDate: string | null };
  subZone: { id: string; label: string; targetLeaflets: number } | null;
}
const titleOf = (d: Detail | null) => d?.job.title ?? '…';
const codeOf = (d: Detail | null) => d?.job.code ?? '';
const targetOf = (d: Detail | null) =>
  d?.subZone?.targetLeaflets ?? d?.job.leafletCount ?? 0;

export function JobDetailScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [d, setD] = useState<Detail | null>(null);

  useEffect(() => {
    void api
      .get<Detail>(`/api/me/assignments/${params.assignmentId}`)
      .then(setD)
      .catch(() => null);
  }, [params.assignmentId]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <BrandHeader />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>{titleOf(d)}</Text>
        <Text style={s.sub}>
          {codeOf(d)} · {targetOf(d).toLocaleString()} leaflets
        </Text>

        <View style={s.statsRow}>
          <Stat label="Leaflets" value={targetOf(d).toLocaleString()} />
          <Stat label="Start" value={d?.job.startDate ?? '—'} />
        </View>

        <GradientButton
          onPress={() => nav.replace('Active', { assignmentId: params.assignmentId })}
          iconLeft="play"
          style={{ marginTop: spacing.xl }}
        >
          Start Job
        </GradientButton>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: spacing.md },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  stat: {
    flex: 1,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statLabel: { color: colors.textMuted, fontSize: 11 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
  card: {
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  cardHead: { color: colors.text, fontSize: 13, fontWeight: '700' },
  cardBody: { color: '#D4D4D8', fontSize: 12, marginTop: spacing.sm, lineHeight: 18 },
  startBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  startText: { color: '#0a0a0a', fontSize: 15, fontWeight: '800' },
});
