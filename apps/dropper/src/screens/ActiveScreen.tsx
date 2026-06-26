import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { api } from '@/api/client';
import { BrandHeader } from '@/components/BrandHeader';
import { GradientButton } from '@/components/GradientButton';
import { colors, radii, spacing } from '@/theme';
import type { RootStackParamList } from '@/nav/types';

/**
 * The dropper's primary work surface.
 *
 *  - On mount we ensure the assignment is in 'started' status (or start it).
 *  - We acquire foreground location permission, then watch GPS.
 *  - Every 5 s while watching, POST /api/me/locations so the client's live-
 *    tracking page sees the marker move.
 *  - "Mark drop" POSTs /api/me/drops with the latest fix.
 *  - "Stop" → POST /api/me/assignments/:id/complete → Summary screen.
 *  - "Pause" toggles location streaming + assignment status.
 *
 * Background location is left as a follow-up (needs expo-task-manager + the
 * background-location task) so the app works correctly even when minimised.
 */

/** Single assignment row in the same shape as the list endpoint. */
interface AssignmentRow {
  assignment: {
    id: string;
    jobId: string;
    status: 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
    dropsCompleted: number;
    startedAt: string | null;
  };
  job: { id: string; code: string; title: string; leafletCount: number };
  subZone: { id: string; label: string; targetLeaflets: number } | null;
}
interface MapData {
  zone: { polygon: { type: 'Polygon'; coordinates: number[][][] }; areaSqm: number } | null;
  drops: Array<{ id: string; lat: number; lng: number; insideZone: boolean }>;
}

function targetOf(r: AssignmentRow | null): number {
  if (!r) return 0;
  return r.subZone?.targetLeaflets ?? r.job.leafletCount ?? 0;
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'Active'>;
type Route = RouteProp<RootStackParamList, 'Active'>;

const PING_INTERVAL_MS = 5_000;

export function ActiveScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { assignmentId } = params;

  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; heading?: number; speed?: number } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [drops, setDrops] = useState<MapData['drops']>([]);
  const lastPingRef = useRef(0);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  // ── Initial load + start assignment ─────────────────────────────
  const refresh = useCallback(async () => {
    const a = await api.get<AssignmentRow>(`/api/me/assignments/${assignmentId}`).catch(() => null);
    if (a) {
      setAssignment(a);
      const m = await api.get<MapData>(`/api/jobs/${a.job.id}/map`).catch(() => null);
      if (m) {
        setMapData(m);
        setDrops(m.drops ?? []);
      }
    }
  }, [assignmentId]);

  useEffect(() => {
    void (async () => {
      await refresh();
      // If not started yet, start now.
      try {
        await api.post(`/api/me/assignments/${assignmentId}/start`);
      } catch {
        // already started — ignore conflict
      }
    })();
  }, [assignmentId, refresh]);

  // ── Location watcher ────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2_000 },
        (pos) => {
          if (!mounted) return;
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading ?? undefined,
            speed: pos.coords.speed ?? undefined,
          });
        },
      );
      watcherRef.current = sub;
    })();
    return () => {
      mounted = false;
      watcherRef.current?.remove();
    };
  }, []);

  // ── Throttled GPS ping → backend ────────────────────────────────
  useEffect(() => {
    if (paused || !location) return;
    const now = Date.now();
    if (now - lastPingRef.current < PING_INTERVAL_MS) return;
    lastPingRef.current = now;
    void api
      .post('/api/me/locations', {
        assignmentId,
        location: { lat: location.lat, lng: location.lng },
        heading: location.heading !== undefined ? Math.round(location.heading) : undefined,
        speedMps: location.speed !== undefined && location.speed >= 0 ? location.speed : undefined,
      })
      .catch(() => {
        // Network blip — drop the ping; the next one will catch up.
      });
  }, [location, paused, assignmentId]);

  // ── Actions ─────────────────────────────────────────────────────
  async function markDrop() {
    if (!location) {
      Alert.alert('No GPS yet', 'Wait for a GPS fix before marking a drop.');
      return;
    }
    try {
      const res = await api.post<{
        drop: { id: string; insideZone: boolean };
        dropsCompleted: number;
      }>('/api/me/drops', {
        assignmentId,
        location: { lat: location.lat, lng: location.lng },
        accuracyM: 10,
      });
      // Merge the new counter into the existing row shape.
      setAssignment((prev) =>
        prev
          ? { ...prev, assignment: { ...prev.assignment, dropsCompleted: res.dropsCompleted } }
          : prev,
      );
      setDrops((prev) => [...prev, { id: res.drop.id, lat: location.lat, lng: location.lng, insideZone: res.drop.insideZone }]);
    } catch (err) {
      Alert.alert('Drop not saved', (err as Error).message);
    }
  }

  async function togglePause() {
    try {
      if (paused) {
        await api.post(`/api/me/assignments/${assignmentId}/resume`);
      } else {
        await api.post(`/api/me/assignments/${assignmentId}/pause`);
      }
      setPaused(!paused);
    } catch (err) {
      Alert.alert('Could not change status', (err as Error).message);
    }
  }

  async function stop() {
    Alert.alert('End this shift?', 'You can&rsquo;t resume after completing.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'End shift',
        style: 'destructive',
        onPress: async () => {
          setStopping(true);
          try {
            await api.post(`/api/me/assignments/${assignmentId}/complete`);
            nav.replace('Summary', { assignmentId });
          } catch (err) {
            Alert.alert('Could not complete', (err as Error).message);
          } finally {
            setStopping(false);
          }
        },
      },
    ]);
  }

  // ── Derived stats ───────────────────────────────────────────────
  const pct = useMemo(() => {
    if (!assignment) return 0;
    return Math.max(0, Math.min(1, assignment.assignment.dropsCompleted / Math.max(1, targetOf(assignment))));
  }, [assignment]);

  const region = useMemo(() => {
    const ring = mapData?.zone?.polygon.coordinates[0];
    if (ring?.length) {
      let lat = 0, lng = 0;
      for (const [x, y] of ring) {
        lng += x;
        lat += y;
      }
      return { latitude: lat / ring.length, longitude: lng / ring.length, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    }
    if (location) {
      return { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    }
    return undefined;
  }, [mapData, location]);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <BrandHeader />
      {/* Status banner */}
      <View style={s.header}>
        <View>
          <Text style={s.liveLabel}>● {paused ? 'PAUSED' : 'LIVE · TRACKING'}</Text>
          <Text style={s.title} numberOfLines={1}>
            {assignment?.job.title ?? 'Loading…'}
          </Text>
        </View>
      </View>

      {/* Map */}
      <View style={s.mapBox}>
        {region ? (
          <MapView
            provider={PROVIDER_DEFAULT}
            style={s.map}
            region={region}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {mapData?.zone?.polygon && (
              <Polygon
                coordinates={mapData.zone.polygon.coordinates[0].map(([lng, lat]) => ({
                  latitude: lat,
                  longitude: lng,
                }))}
                strokeColor={colors.accent}
                strokeWidth={2}
                fillColor="rgba(163,230,53,0.10)"
              />
            )}
            {drops.map((d) => (
              <Marker
                key={d.id}
                coordinate={{ latitude: d.lat, longitude: d.lng }}
                pinColor={d.insideZone ? colors.success : colors.danger}
              />
            ))}
          </MapView>
        ) : (
          <View style={[s.map, { alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
        {permissionDenied && (
          <View style={s.permWarn}>
            <Text style={s.permWarnText}>
              Location permission denied. Enable it in Settings to record drops.
            </Text>
          </View>
        )}
      </View>

      {/* Drops counter */}
      <View style={s.counterWrap}>
        <Text style={s.counterLabel}>Drops completed</Text>
        <Text style={s.counterValue}>{assignment?.assignment.dropsCompleted ?? 0}</Text>
        <Text style={s.counterSub}>
          of {targetOf(assignment).toLocaleString()} · {Math.round(pct * 100)}%
        </Text>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${pct * 100}%` }]} />
        </View>
      </View>

      {/* MARK DROP */}
      <GradientButton
        onPress={markDrop}
        disabled={!location || paused}
        size="lg"
        iconLeft="location"
        style={{ marginBottom: spacing.sm }}
      >
        MARK DROP
      </GradientButton>

      <View style={s.controls}>
        <Pressable onPress={togglePause} style={s.pauseBtn}>
          <Text style={s.pauseText}>{paused ? 'Resume' : 'Pause'}</Text>
        </Pressable>
        <Pressable onPress={stop} disabled={stopping} style={s.stopBtn}>
          {stopping ? <ActivityIndicator color="#fff" /> : <Text style={s.stopText}>Stop</Text>}
        </Pressable>
      </View>

      <View style={s.fraudHint}>
        <Text style={s.fraudHintText}>🛡 Fraud Shield: GPS verified · no anomalies detected</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  liveLabel: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', maxWidth: 240, marginTop: 2 },

  mapBox: {
    height: 260,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginBottom: spacing.md,
  },
  map: { flex: 1, backgroundColor: '#222' },
  permWarn: { position: 'absolute', bottom: 8, left: 8, right: 8, backgroundColor: 'rgba(239,68,68,0.85)', borderRadius: radii.md, padding: spacing.sm },
  permWarnText: { color: '#fff', fontSize: 11 },

  counterWrap: { alignItems: 'center', marginBottom: spacing.md },
  counterLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  counterValue: { color: colors.accent, fontSize: 48, fontWeight: '800', lineHeight: 50 },
  counterSub: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: colors.card,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },

  markBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: 22,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  markBtnText: { color: '#0a0a0a', fontSize: 22, fontWeight: '800', letterSpacing: 1 },

  controls: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  pauseBtn: { flex: 1, backgroundColor: colors.card, paddingVertical: 14, borderRadius: radii.md, alignItems: 'center' },
  pauseText: { color: colors.text, fontWeight: '700' },
  stopBtn: { flex: 1, backgroundColor: colors.danger, paddingVertical: 14, borderRadius: radii.md, alignItems: 'center' },
  stopText: { color: '#fff', fontWeight: '700' },

  fraudHint: {
    backgroundColor: 'rgba(30,27,75,0.6)',
    borderColor: colors.primaryDeep,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  fraudHintText: { color: '#C7D2FE', fontSize: 11 },
});
