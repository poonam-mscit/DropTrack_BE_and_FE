import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { BrandHeader } from '@/components/BrandHeader';
import { colors, radii, spacing } from '@/theme';
import type { RootStackParamList } from '@/nav/types';

interface AssignmentRow {
  assignment: {
    id: string;
    jobId: string;
    status: 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
    targetLeaflets: number;
    dropsCompleted: number;
    startedAt: string | null;
    pausedTotalSec?: number | null;
    label?: string | null;
  };
  job: {
    id: string;
    code: string;
    title: string;
    startDate: string | null;
    status: string;
  };
  subZone: { id: string; label: string; targetLeaflets: number } | null;
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'Jobs'>;

interface MeProfile {
  user: { email: string };
  dropper: { employeeId: string; firstName: string; lastName: string } | null;
}

export function JobsScreen() {
  const nav = useNavigation<Nav>();
  const { session } = useAuth();
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<AssignmentRow[] | { data?: AssignmentRow[] }>('/api/me/assignments');
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setRows(list);
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    }
  }, []);

  // Profile only needs to load once per session — name doesn't change on refresh.
  useEffect(() => {
    void api.get<MeProfile>('/api/me/profile').then(setProfile).catch(() => null);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // ── Bucket by day ────────────────────────────────────────────────
  const today = todayIso();
  const tomorrow = isoOffset(1);

  const active = useMemo(
    () => rows?.find((r) => r.assignment.status === 'started' || r.assignment.status === 'paused'),
    [rows],
  );
  const todays = useMemo(
    () =>
      rows?.filter(
        (r) =>
          r.assignment.status === 'pending' &&
          r.job.startDate &&
          r.job.startDate <= today &&
          r.assignment.id !== active?.assignment.id,
      ) ?? [],
    [rows, active, today],
  );
  const tomorrows = useMemo(
    () => rows?.filter((r) => r.assignment.status === 'pending' && r.job.startDate === tomorrow) ?? [],
    [rows, tomorrow],
  );
  const later = useMemo(
    () =>
      rows?.filter(
        (r) =>
          r.assignment.status === 'pending' &&
          r.job.startDate &&
          r.job.startDate > tomorrow,
      ) ?? [],
    [rows, tomorrow],
  );

  // ── Aggregates ──────────────────────────────────────────────────
  // Prefer the real dropper name; fall back to email-derived first name only
  // while the profile fetch is in-flight on first launch.
  const firstName = capitalise(profile?.dropper?.firstName ?? (session?.email ?? '').split('.')[0] ?? 'mate');
  const lastName = capitalise(profile?.dropper?.lastName ?? '');
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;
  const initials = ((firstName[0] ?? 'D') + (lastName[0] ?? '')).toUpperCase();
  const greeting = greetingForNow();

  const weekDrops = (rows ?? []).reduce((acc, r) => acc + (r.assignment.dropsCompleted ?? 0), 0);
  const weekHours = useMemo(() => totalHours(rows ?? []), [rows]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <BrandHeader initials={initials} />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl tintColor={colors.accent} refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Greeting */}
        <View style={s.greetingRow}>
          <Text style={s.hello}>{greeting},</Text>
          <Text style={s.name}>{fullName}</Text>
        </View>

        {/* Weekly stats */}
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statLabel}>This week</Text>
            <Text style={s.statValue}>{weekDrops.toLocaleString()}</Text>
            <Text style={s.statSub}>drops</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Hours</Text>
            <Text style={s.statValue}>{weekHours}</Text>
            <Text style={s.statSub}>hrs</Text>
          </View>
        </View>

        {/* TODAY */}
        <Text style={s.sectionLabel}>Today · {humanDate(new Date())}</Text>

        {rows === null ? (
          <LoadingCard />
        ) : (
          <>
            {active && (
              <Pressable onPress={() => nav.navigate('Active', { assignmentId: active.assignment.id })}>
                <View style={[s.card, s.activeCard]}>
                  <View style={s.cardHeadRow}>
                    <View style={{ flex: 1, paddingRight: spacing.md }}>
                      <View style={s.pillLime}>
                        <Text style={s.pillLimeText}>IN PROGRESS</Text>
                      </View>
                      <Text style={s.cardTitle} numberOfLines={2}>
                        {active.job.title}
                      </Text>
                      <Text style={s.cardSub}>{active.subZone?.label ?? 'Whole zone'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.statLabel}>Progress</Text>
                      <Text style={[s.cardValue, { color: colors.accent }]}>
                        {active.assignment.dropsCompleted} / {active.assignment.targetLeaflets}
                      </Text>
                    </View>
                  </View>
                  <Progress value={active.assignment.dropsCompleted / Math.max(1, active.assignment.targetLeaflets)} />
                  <View style={s.metaRow}>
                    <Meta icon="pin" text={active.subZone?.label ?? extractSuburb(active.job.title)} />
                    <Meta icon="timer" text={`${formatWorked(active)} worked`} />
                  </View>
                </View>
              </Pressable>
            )}

            {todays.map((r) => (
              <Pressable
                key={r.assignment.id}
                onPress={() => nav.navigate('JobDetail', { assignmentId: r.assignment.id })}
              >
                <View style={s.card}>
                  <View style={s.cardHeadRow}>
                    <View style={{ flex: 1 }}>
                      <View style={s.pillGray}>
                        <Text style={s.pillGrayText}>UP NEXT</Text>
                      </View>
                      <Text style={s.cardTitle}>{r.job.title}</Text>
                      <Text style={s.cardSub}>{r.subZone?.label ?? 'Whole zone'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.statLabel}>Leaflets</Text>
                      <Text style={s.cardValue}>{r.assignment.targetLeaflets.toLocaleString()}</Text>
                    </View>
                  </View>
                  <View style={s.metaRow}>
                    <Meta icon="pin" text={r.subZone?.label ?? extractSuburb(r.job.title)} />
                    <Meta icon="alarm" text="Ready to start" />
                  </View>
                </View>
              </Pressable>
            ))}

            {!active && todays.length === 0 && (
              <View style={s.emptyCard}>
                <Text style={s.cardSub}>
                  Nothing scheduled for today. Pull down to refresh.
                </Text>
              </View>
            )}

            {/* TOMORROW */}
            {tomorrows.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Tomorrow</Text>
                {tomorrows.map((r) => (
                  <Pressable
                    key={r.assignment.id}
                    onPress={() => nav.navigate('JobDetail', { assignmentId: r.assignment.id })}
                  >
                    <View style={[s.card, { opacity: 0.75 }]}>
                      <Text style={s.cardTitle}>{r.job.title}</Text>
                      <View style={[s.metaRow, { marginTop: 4 }]}>
                        <Meta icon="alarm" text={r.job.startDate ?? ''} />
                        <Meta icon="pin" text={`${r.assignment.targetLeaflets.toLocaleString()} leaflets`} />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {/* LATER */}
            {later.length > 0 && (
              <>
                <Text style={s.sectionLabel}>This week</Text>
                {later.slice(0, 3).map((r) => (
                  <Pressable
                    key={r.assignment.id}
                    onPress={() => nav.navigate('JobDetail', { assignmentId: r.assignment.id })}
                  >
                    <View style={[s.card, { opacity: 0.55 }]}>
                      <Text style={s.cardTitle}>{r.job.title}</Text>
                      <View style={[s.metaRow, { marginTop: 4 }]}>
                        <Meta icon="alarm" text={r.job.startDate ?? ''} />
                        <Meta icon="pin" text={`${r.assignment.targetLeaflets.toLocaleString()} leaflets`} />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </>
        )}

        {error && (
          <View style={[s.card, { borderColor: 'rgba(239,68,68,0.4)' }]}>
            <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Bits ──────────────────────────────────────────────────────────

function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={s.progressTrack}>
      <View style={[s.progressFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

function LoadingCard() {
  return (
    <View style={s.loadingCard}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function Meta({ icon, text }: { icon: 'pin' | 'timer' | 'alarm'; text: string }) {
  const name = icon === 'pin' ? 'location-outline' : icon === 'timer' ? 'time-outline' : 'alarm-outline';
  return (
    <View style={s.metaItem}>
      <Ionicons name={name} size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
      <Text style={s.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
function capitalise(str: string): string {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function humanDate(d: Date): string {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
function extractSuburb(title: string): string {
  const after = title.split('—').pop() ?? title;
  return after.trim().slice(0, 30);
}
function formatWorked(r: AssignmentRow): string {
  if (!r.assignment.startedAt) return '0m';
  const startedMs = new Date(r.assignment.startedAt).getTime();
  const pausedMs = (r.assignment.pausedTotalSec ?? 0) * 1000;
  const ms = Math.max(0, Date.now() - startedMs - pausedMs);
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function totalHours(rows: AssignmentRow[]): string {
  const totalSec = rows.reduce((acc, r) => {
    if (!r.assignment.startedAt) return acc;
    const end = r.assignment.status === 'completed' ? Date.now() : Date.now();
    const startedMs = new Date(r.assignment.startedAt).getTime();
    return acc + Math.max(0, (end - startedMs) / 1000 - (r.assignment.pausedTotalSec ?? 0));
  }, 0);
  return totalSec > 0 ? (totalSec / 3600).toFixed(1) : '0';
}

// ── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  greetingRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: spacing.lg },
  hello: { color: colors.textMuted, fontSize: 14 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },

  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  stat: {
    flex: 1,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 2, letterSpacing: -0.3 },
  statSub: { color: colors.accent, fontSize: 11, fontWeight: '600', marginTop: 1 },

  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  activeCard: { borderColor: colors.accent },
  emptyCard: {
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 6, letterSpacing: -0.2 },
  cardSub: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  cardValue: { color: colors.text, fontSize: 15, fontWeight: '700' },

  pillLime: { alignSelf: 'flex-start', backgroundColor: colors.accent, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  pillLimeText: { color: '#0a0a0a', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  pillGray: { alignSelf: 'flex-start', backgroundColor: colors.card, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  pillGrayText: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  progressTrack: {
    marginTop: spacing.md,
    height: 6,
    backgroundColor: colors.card,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  metaText: { color: colors.textMuted, fontSize: 11, flex: 1 },

});
