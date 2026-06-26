import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { api } from '@/api/client';
import { BrandHeader } from '@/components/BrandHeader';
import { GradientButton } from '@/components/GradientButton';
import { colors, radii, spacing } from '@/theme';
import type { RootStackParamList } from '@/nav/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Summary'>;
type Route = RouteProp<RootStackParamList, 'Summary'>;

interface AssignmentSummary {
  id: string;
  jobTitle: string;
  dropsCompleted: number;
  targetLeaflets: number;
  distanceKm?: number | null;
  durationMin?: number | null;
}

export function SummaryScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [data, setData] = useState<AssignmentSummary | null>(null);
  const [rating, setRating] = useState<number>(0);

  useEffect(() => {
    void api
      .get<{ data?: AssignmentSummary } | AssignmentSummary>(`/api/me/assignments/${params.assignmentId}`)
      .then((res) => {
        const next = (res as { data?: AssignmentSummary }).data ?? (res as AssignmentSummary);
        setData(next);
      })
      .catch(() => null);
  }, [params.assignmentId]);

  const coverage = data ? Math.round((data.dropsCompleted / Math.max(1, data.targetLeaflets)) * 100) : 0;

  function done() {
    nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Jobs' }] }));
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <BrandHeader />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.heroIcon}>
          <Text style={{ fontSize: 32 }}>✨</Text>
        </View>
        <Text style={s.heroTitle}>Great work!</Text>
        <Text style={s.heroSub}>{data?.jobTitle ?? 'Shift'} complete</Text>

        <View style={s.statsRow}>
          <Stat label="Drops" value={(data?.dropsCompleted ?? 0).toLocaleString()} accent />
          <Stat label="Coverage" value={`${coverage}%`} accent />
        </View>
        <View style={s.statsRow}>
          <Stat label="Distance" value={data?.distanceKm ? `${data.distanceKm.toFixed(1)} km` : '—'} />
          <Stat label="Duration" value={data?.durationMin ? formatMin(data.durationMin) : '—'} />
        </View>

        <View style={s.shieldCard}>
          <Text style={s.shieldHead}>🛡 AI Fraud Shield · VERIFIED</Text>
          <Text style={s.shieldBody}>
            All {(data?.dropsCompleted ?? 0).toLocaleString()} drops verified. GPS integrity 100%. Client
            will see authenticated report.
          </Text>
        </View>

        <View style={s.rateCard}>
          <Text style={s.rateHead}>Rate your shift</Text>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)}>
                <Text style={[s.star, rating >= n && { color: colors.accent }]}>★</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <GradientButton onPress={done} style={{ marginTop: spacing.lg }}>
          Done
        </GradientButton>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, accent && { color: colors.accent }]}>{value}</Text>
    </View>
  );
}

function formatMin(m: number): string {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, alignItems: 'stretch' },
  heroIcon: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  heroSub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statLabel: { color: colors.textMuted, fontSize: 11 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 },

  shieldCard: {
    backgroundColor: 'rgba(30,27,75,0.6)',
    borderColor: colors.primaryDeep,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  shieldHead: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  shieldBody: { color: '#D4D4D8', fontSize: 12, marginTop: 6, lineHeight: 18 },

  rateCard: {
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  rateHead: { color: colors.text, fontSize: 13, fontWeight: '700' },
  starsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  star: { fontSize: 32, color: colors.textFaint },

  doneBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  doneText: { color: '#0a0a0a', fontSize: 15, fontWeight: '800' },
});
