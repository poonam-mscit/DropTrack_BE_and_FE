/**
 * Full assignment list for the signed-in dropper — every status (pending,
 * started, paused, completed, abandoned), filterable by chip row at top.
 *
 * Sits between the Home tab (today's actionable card) and the Profile tab.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { BrandHeader } from '@/components/BrandHeader';
import { colors, radii, spacing } from '@/theme';
import type { RootStackParamList } from '@/nav/types';

type AssignmentStatus = 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
interface AssignmentRow {
  assignment: {
    id: string;
    jobId: string;
    status: AssignmentStatus;
    dropsCompleted: number;
    startedAt: string | null;
    pausedTotalSeconds?: number | null;
  };
  job: {
    id: string;
    code: string;
    title: string;
    startDate: string | null;
    status: string;
    leafletCount?: number;
  };
  subZone: { id: string; label: string; targetLeaflets: number } | null;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AllJobsScreen() {
  const nav = useNavigation<Nav>();
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
    try {
      const res = await api.get<AssignmentRow[] | { data?: AssignmentRow[] }>('/api/me/assignments');
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setRows(list);
    } catch {
      setRows([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const today = todayIso();

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (filter === 'all') return true;
      if (filter === 'active') return r.assignment.status === 'started' || r.assignment.status === 'paused';
      if (filter === 'completed') return r.assignment.status === 'completed' || r.assignment.status === 'abandoned';
      if (filter === 'upcoming')
        return r.assignment.status === 'pending' && (!r.job.startDate || r.job.startDate >= today);
      return true;
    });
  }, [rows, filter, today]);

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, upcoming: 0, completed: 0 };
    for (const r of rows ?? []) {
      c.all++;
      const st = r.assignment.status;
      if (st === 'started' || st === 'paused') c.active++;
      else if (st === 'completed' || st === 'abandoned') c.completed++;
      else if (st === 'pending') c.upcoming++;
    }
    return c;
  }, [rows]);

  function openCard(r: AssignmentRow) {
    // The destination screens live inside the Home tab's nested stack
    // (JobsStackNav), so we have to switch to that tab and then specify
    // which screen within the stack to open. React Navigation doesn't
    // auto-traverse nested navigators for plain `navigate(name, params)`.
    const target =
      r.assignment.status === 'started' || r.assignment.status === 'paused'
        ? 'Active'
        : r.assignment.status === 'pending'
          ? 'JobDetail'
          : 'Summary';

    nav.navigate('Jobs', {
      screen: target,
      params: { assignmentId: r.assignment.id },
    } as never);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <BrandHeader />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl tintColor={colors.accent} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={s.heading}>Your jobs</Text>
        <Text style={s.sub}>{counts.all} total · {counts.active} active</Text>

        {/* Filter chips */}
        <View style={s.chipsRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = counts[f.key];
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[s.chip, active && s.chipActive]}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
                <View style={[s.chipBadge, active && s.chipBadgeActive]}>
                  <Text style={[s.chipBadgeText, active && s.chipBadgeTextActive]}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {rows === null ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="briefcase-outline" size={28} color={colors.textMuted} />
            <Text style={s.emptyTitle}>No {filter === 'all' ? 'jobs' : filter} yet</Text>
            <Text style={s.emptyBody}>
              {filter === 'all'
                ? 'When an admin assigns you a campaign, it will appear here.'
                : 'Pull to refresh.'}
            </Text>
          </View>
        ) : (
          filtered.map((r) => <Card key={r.assignment.id} row={r} onPress={() => openCard(r)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Card ──────────────────────────────────────────────────────────

function Card({ row, onPress }: { row: AssignmentRow; onPress: () => void }) {
  const { assignment: a, job: j, subZone: sz } = row;
  const target = sz?.targetLeaflets ?? j.leafletCount ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((a.dropsCompleted / target) * 100)) : 0;
  const meta = statusMeta(a.status);

  return (
    <Pressable onPress={onPress} style={s.card}>
      <View style={s.cardHead}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <View style={[s.pill, { backgroundColor: meta.bg }]}>
            {meta.icon && <Ionicons name={meta.icon} size={11} color={meta.fg} style={{ marginRight: 3 }} />}
            <Text style={[s.pillText, { color: meta.fg }]}>{meta.label}</Text>
          </View>
          <Text style={s.title} numberOfLines={2}>
            {j.title}
          </Text>
          <Text style={s.code}>
            {j.code} · {sz?.label ?? 'Whole zone'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.statLabel}>Drops</Text>
          <Text style={s.statValue}>
            {a.dropsCompleted}/{target.toLocaleString()}
          </Text>
        </View>
      </View>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: meta.bar }]} />
      </View>
      <View style={s.metaRow}>
        <View style={s.metaItem}>
          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
          <Text style={s.metaText}>{j.startDate ?? 'No date'}</Text>
        </View>
        <View style={s.metaItem}>
          <Ionicons name="pricetag-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
          <Text style={s.metaText}>{pct}% complete</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Status meta ───────────────────────────────────────────────────

function statusMeta(status: AssignmentStatus): {
  label: string;
  fg: string;
  bg: string;
  bar: string;
  icon?: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
} {
  switch (status) {
    case 'started':
      return { label: 'IN PROGRESS', fg: '#0a0a0a', bg: colors.accent, bar: colors.accent, icon: 'radio' };
    case 'paused':
      return { label: 'PAUSED', fg: '#92400E', bg: 'rgba(245,158,11,0.18)', bar: '#F59E0B', icon: 'pause' };
    case 'pending':
      return { label: 'UPCOMING', fg: colors.textMuted, bg: colors.card, bar: colors.borderSoft, icon: 'time-outline' };
    case 'completed':
      return { label: 'COMPLETED', fg: '#065F46', bg: 'rgba(16,185,129,0.18)', bar: '#10B981', icon: 'checkmark-done' };
    case 'abandoned':
      return { label: 'ABANDONED', fg: '#7F1D1D', bg: 'rgba(239,68,68,0.18)', bar: '#EF4444', icon: 'close-circle' };
    default:
      return { label: status, fg: colors.text, bg: colors.cardSoft, bar: colors.accent };
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  center: { alignItems: 'center', paddingVertical: spacing.xl },

  chipsRow: { flexDirection: 'row', gap: 8, marginTop: spacing.lg, marginBottom: spacing.md, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: 6,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#0a0a0a' },
  chipBadge: { backgroundColor: 'rgba(255,255,255,0.08)', minWidth: 18, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, alignItems: 'center' },
  chipBadgeActive: { backgroundColor: 'rgba(10,10,10,0.18)' },
  chipBadgeText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  chipBadgeTextActive: { color: '#0a0a0a' },

  card: {
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pill: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 6, letterSpacing: -0.2 },
  code: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  statLabel: { color: colors.textMuted, fontSize: 11 },
  statValue: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 },

  progressTrack: { marginTop: spacing.md, height: 6, backgroundColor: colors.card, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%' },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  metaText: { color: colors.textMuted, fontSize: 11 },

  emptyCard: {
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: spacing.sm },
  emptyBody: { color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' },
});
