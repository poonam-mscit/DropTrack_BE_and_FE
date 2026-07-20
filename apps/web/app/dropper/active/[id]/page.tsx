'use client';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Crosshair, Loader2, MapPin, Pause, Play, Target } from 'lucide-react';
import { api } from '@/lib/api';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const PING_INTERVAL_MS = 5000;

interface AssignmentDetail {
  assignment: {
    id: string;
    jobId: string;
    status: 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
    dropsCompleted: number;
    targetLeaflets: number | null;
  };
  job: {
    id: string;
    code: string;
    title: string;
    leafletCount?: number;
  };
  subZone: { id: string; label: string; targetLeaflets: number } | null;
}

interface JobMap {
  zone: { polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon } | null;
  drops: Array<{ id: string; lat: number; lng: number; markedAt: string; insideZone: boolean }>;
}

type GeoFix = { lat: number; lng: number; accuracy: number; speed: number | null; heading: number | null; at: number };

export default function DropperActive() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [jobMap, setJobMap] = useState<JobMap | null>(null);
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'mark' | 'pause' | 'resume' | 'complete' | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [wakeLockOn, setWakeLockOn] = useState(false);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const meMarkerRef = useRef<any>(null);
  const dropsSrcAdded = useRef(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const lastPingAtRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const centeredOnMeRef = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const d = await api.get<AssignmentDetail>(`/api/me/assignments/${id}`);
      setDetail(d);
      const m = await api.get<JobMap>(`/api/jobs/${d.job.id}/map`).catch(() => null);
      if (m) setJobMap(m);
    } catch (e) {
      setPageError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh assignment counters every 20 s so the target ring stays live if
  // the mobile app also drops on this assignment.
  useEffect(() => {
    if (!id) return;
    const t = setInterval(() => {
      api.get<AssignmentDetail>(`/api/me/assignments/${id}`).then(setDetail).catch(() => {});
    }, 20_000);
    return () => clearInterval(t);
  }, [id]);

  // ── Mapbox init ──────────────────────────────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapDivRef.current || !jobMap?.zone) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      if (cancelled) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const bbox = polygonBbox(jobMap.zone!.polygon);
      const center: [number, number] = [(bbox.minLng + bbox.maxLng) / 2, (bbox.minLat + bbox.maxLat) / 2];
      const map = new mapboxgl.Map({
        container: mapDivRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom: 16,
      });
      mapInstanceRef.current = map;
      map.on('load', () => {
        // Zone fill + outline
        map.addSource('zone', { type: 'geojson', data: { type: 'Feature', geometry: jobMap.zone!.polygon, properties: {} } });
        map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': '#4F46E5', 'fill-opacity': 0.15 } });
        map.addLayer({ id: 'zone-line', type: 'line', source: 'zone', paint: { 'line-color': '#4F46E5', 'line-width': 2 } });
        // Drops
        map.addSource('drops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'drops-dot', type: 'circle', source: 'drops',
          paint: { 'circle-radius': 6, 'circle-color': '#22C55E', 'circle-stroke-width': 2, 'circle-stroke-color': '#F0FDF4' },
        });
        dropsSrcAdded.current = true;
        map.fitBounds([[bbox.minLng, bbox.minLat], [bbox.maxLng, bbox.maxLat]], { padding: 40, animate: false });
      });
    })();
    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      dropsSrcAdded.current = false;
    };
  }, [jobMap?.zone]);

  // Push drops into map source when jobMap updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !dropsSrcAdded.current || !jobMap) return;
    const src = map.getSource('drops');
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: jobMap.drops.map((d) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.lng, d.lat] }, properties: { id: d.id } })),
    });
  }, [jobMap]);

  // ── Geolocation watcher (only while status === 'started') ───────
  useEffect(() => {
    if (!detail || detail.assignment.status !== 'started') {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported in this browser.');
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null);
        const f: GeoFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          at: Date.now(),
        };
        setFix(f);
        // Move / add "me" marker + recenter map on the first fix so the
        // dropper always sees themselves, even if the seeded zone is far away.
        const map = mapInstanceRef.current;
        if (map) {
          import('mapbox-gl').then(({ default: mapboxgl }) => {
            if (!meMarkerRef.current) {
              const el = document.createElement('div');
              el.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#F59E0B;border:3px solid #fff;box-shadow:0 0 0 3px rgba(245,158,11,.35);';
              meMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([f.lng, f.lat]).addTo(map);
            } else {
              meMarkerRef.current.setLngLat([f.lng, f.lat]);
            }
            if (!centeredOnMeRef.current) {
              map.jumpTo({ center: [f.lng, f.lat], zoom: 17 });
              centeredOnMeRef.current = true;
            }
          });
        }
        // Throttled ping to server
        if (f.at - lastPingAtRef.current >= PING_INTERVAL_MS) {
          lastPingAtRef.current = f.at;
          void api
            .post('/api/me/locations', {
              assignmentId: detail.assignment.id,
              location: { lat: f.lat, lng: f.lng },
              accuracyM: Math.min(500, Math.max(0, Math.round(f.accuracy || 0))),
              speedMps: f.speed != null && f.speed >= 0 ? f.speed : undefined,
              heading: f.heading != null && !Number.isNaN(f.heading) && f.heading >= 0 ? Math.round(f.heading) : undefined,
              recordedAt: new Date(f.at).toISOString(),
            })
            .catch(() => {});
        }
      },
      (err) => setGeoError(err.message ?? 'Location unavailable.'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [detail]);

  // ── Wake Lock — keep screen on while dropping ────────────
  useEffect(() => {
    async function acquire() {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void>; addEventListener?(ev: string, cb: () => void): void }> } }).wakeLock;
        if (wl?.request) {
          const sentinel = await wl.request('screen');
          wakeLockRef.current = sentinel;
          setWakeLockOn(true);
          sentinel.addEventListener?.('release', () => setWakeLockOn(false));
        }
      } catch {
        // ignore — user gesture or page hidden. UI still works.
      }
    }
    if (detail?.assignment.status === 'started') void acquire();
    else if (wakeLockRef.current) {
      void wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
      setWakeLockOn(false);
    }
    return () => {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [detail?.assignment.status]);

  async function markDrop() {
    if (!detail || !fix) return;
    setBusy('mark');
    try {
      await api.post('/api/me/drops', {
        assignmentId: detail.assignment.id,
        location: { lat: fix.lat, lng: fix.lng },
        accuracyM: Math.min(500, Math.max(0, Math.round(fix.accuracy || 0))),
      });
      // Optimistic: bump counter + reload map dots so the new dot appears
      setDetail((d) => (d ? { ...d, assignment: { ...d.assignment, dropsCompleted: d.assignment.dropsCompleted + 1 } } : d));
      const m = await api.get<JobMap>(`/api/jobs/${detail.job.id}/map`);
      setJobMap(m);
    } catch (e) {
      setPageError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function pauseResume() {
    if (!detail) return;
    const next = detail.assignment.status === 'started' ? 'pause' : 'resume';
    setBusy(next);
    try {
      await api.post(`/api/me/assignments/${detail.assignment.id}/${next}`, {});
      await load();
    } catch (e) {
      setPageError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function complete() {
    if (!detail) return;
    if (!window.confirm('Mark this drop complete? You will not be able to add more drops.')) return;
    setBusy('complete');
    try {
      await api.post(`/api/me/assignments/${detail.assignment.id}/complete`, {});
      router.push(`/dropper/recap/${detail.assignment.id}`);
    } catch (e) {
      setPageError((e as Error).message);
      setBusy(null);
    }
  }

  const target =
    detail?.assignment.targetLeaflets ??
    detail?.subZone?.targetLeaflets ??
    detail?.job.leafletCount ??
    0;
  const done = detail?.assignment.dropsCompleted ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const status = detail?.assignment.status;

  const canMark = fix != null && status === 'started' && busy !== 'mark';

  return (
    <div className="pb-4">
      <Link href={`/dropper/jobs/${id}`} className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white mb-2">
        <ArrowLeft size={14} /> Back
      </Link>

      {pageError && (
        <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-200">
          {pageError}
        </div>
      )}
      {geoError && (
        <div className="mb-3 p-3 rounded-xl bg-amber-400/10 border border-amber-400/30 text-xs text-amber-200 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> Location: {geoError}
        </div>
      )}
      {!MAPBOX_TOKEN && (
        <div className="mb-3 p-3 rounded-xl bg-amber-400/10 border border-amber-400/30 text-xs text-amber-200">
          Map disabled — NEXT_PUBLIC_MAPBOX_TOKEN missing.
        </div>
      )}

      {/* Progress ring row */}
      <div className="flex items-center gap-4 mb-3">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
            <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="16" fill="none" stroke="#34D399" strokeWidth="3"
              strokeDasharray={`${(pct * 100.5) / 100} 100.5`} strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-extrabold">{pct}%</div>
        </div>
        <div className="min-w-0">
          <p className="text-lg font-extrabold tracking-tight truncate">{detail?.job.title ?? '…'}</p>
          <p className="text-xs text-white/60 mt-0.5">
            {done} / {target} drops · {status ?? '…'}{wakeLockOn && <span className="ml-2 text-emerald-300">screen-on</span>}
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="relative w-full h-[45vh] min-h-[280px] rounded-2xl overflow-hidden bg-white/5 border border-white/10 mb-3">
        <div ref={mapDivRef} className="absolute inset-0">
          {!jobMap && (
            <div className="flex items-center justify-center h-full text-white/40 text-sm">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading map…
            </div>
          )}
        </div>
        {fix && (
          <button
            onClick={() => {
              if (!mapInstanceRef.current) return;
              mapInstanceRef.current.easeTo({ center: [fix.lng, fix.lat], zoom: 17, duration: 400 });
            }}
            aria-label="Recenter on my location"
            className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white/95 text-slate-900 shadow-lg flex items-center justify-center active:bg-white"
          >
            <Crosshair size={18} />
          </button>
        )}
      </div>

      {/* Fix summary */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-3 mb-4 text-xs text-white/70 flex items-center gap-3">
        <MapPin size={14} className="text-emerald-300" />
        {fix ? (
          <span className="tabular-nums">
            {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)} · ±{Math.round(fix.accuracy)} m
          </span>
        ) : (
          <span>Waiting for a GPS fix…</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <button
          onClick={pauseResume}
          disabled={!detail || busy != null || status === 'completed'}
          className="rounded-2xl bg-white/10 border border-white/15 py-3 text-sm font-semibold text-white active:bg-white/15 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {status === 'started' ? <Pause size={14} /> : <Play size={14} />}
          {status === 'started' ? 'Pause' : 'Resume'}
        </button>
        <button
          onClick={complete}
          disabled={!detail || busy != null || status === 'completed'}
          className="col-span-2 rounded-2xl bg-white/10 border border-white/15 py-3 text-sm font-semibold text-white active:bg-white/15 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 size={14} /> Complete drop
        </button>
      </div>

      <button
        onClick={markDrop}
        disabled={!canMark}
        className="w-full rounded-2xl bg-emerald-400 text-emerald-950 font-extrabold py-5 text-lg active:bg-emerald-500 disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {busy === 'mark' ? <Loader2 size={18} className="animate-spin" /> : <Target size={18} />}
        Mark drop
      </button>

      {status === 'started' && !fix && (
        <p className="text-[11px] text-white/50 text-center mt-2">
          Waiting for your first GPS fix — allow location access if prompted.
        </p>
      )}
      {status === 'paused' && (
        <p className="text-[11px] text-amber-200 text-center mt-2">
          Paused — resume to keep tracking.
        </p>
      )}
    </div>
  );
}

function polygonBbox(g: GeoJSON.Polygon | GeoJSON.MultiPolygon) {
  const coords: number[][] = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}
