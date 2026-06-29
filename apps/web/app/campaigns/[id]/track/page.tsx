'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ArrowLeft, Loader2, Radio } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { api, type ApiJob } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { getSocket, type RealtimeDrop, type RealtimeLocation } from '@/lib/socket';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface LiveDropper {
  assignmentId: string;
  dropperUserId: string;
  dropperName: string;
  status: 'started' | 'paused';
  targetLeaflets: number;
  dropsCompleted: number;
  startedAt: string | null;
  lastLocation: {
    lat: number;
    lng: number;
    at: string | null;
    heading: number | null;
    speedMps: number | null;
  } | null;
}

interface MapData {
  zone: {
    polygon: { type: 'Polygon'; coordinates: number[][][] };
    areaSqm: number;
    estimatedLetterboxes: number | null;
  } | null;
  drops: Array<{ id: string; dropperUserId: string; lat: number; lng: number; insideZone: boolean; markedAt: string }>;
  routes: Array<{ assignmentId: string; dropperUserId: string; coords: Array<[number, number]>; points: number }>;
}

const DROPPER_COLOURS = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#A3E635'];

export default function CampaignTrack() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<unknown>(null);
  const dropperMarkers = useRef<Map<string, unknown>>(new Map());

  const [job, setJob] = useState<ApiJob | null>(null);
  const [map, setMap] = useState<MapData | null>(null);
  const [droppers, setDroppers] = useState<LiveDropper[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Initial load ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [j, m, live] = await Promise.all([
        api.get<{ data?: ApiJob } | ApiJob>(`/api/jobs/${id}`),
        api.get<MapData>(`/api/jobs/${id}/map`).catch(() => null),
        api.get<LiveDropper[]>(`/api/jobs/${id}/assignments/live`).catch(() => [] as LiveDropper[]),
      ]);
      const next = (j as { data?: ApiJob }).data ?? (j as ApiJob);
      setJob(next);
      setMap(m);
      setDroppers(live);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    void load();
  }, [router, load]);

  // ── Socket subscription ──────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const s = getSocket();
    s.emit('join:job', id);

    const onLocation = (e: RealtimeLocation) => {
      setDroppers((prev) =>
        prev.map((d) =>
          d.assignmentId === e.assignmentId
            ? {
                ...d,
                lastLocation: {
                  lat: e.location.lat,
                  lng: e.location.lng,
                  at: e.at,
                  heading: e.heading,
                  speedMps: e.speedMps,
                },
              }
            : d,
        ),
      );
      // Append the new point to that dropper's route so the line grows live.
      setMap((prev) => {
        if (!prev) return prev;
        const coord: [number, number] = [e.location.lng, e.location.lat];
        const idx = prev.routes.findIndex((r) => r.assignmentId === e.assignmentId);
        if (idx >= 0) {
          const next = [...prev.routes];
          const r = next[idx];
          next[idx] = { ...r, coords: [...r.coords, coord], points: r.points + 1 };
          return { ...prev, routes: next };
        }
        return {
          ...prev,
          routes: [
            ...prev.routes,
            { assignmentId: e.assignmentId, dropperUserId: e.dropperUserId, coords: [coord], points: 1 },
          ],
        };
      });
    };
    const onDrop = (e: RealtimeDrop) => {
      setDroppers((prev) =>
        prev.map((d) =>
          d.assignmentId === e.assignmentId ? { ...d, dropsCompleted: e.dropsCompleted } : d,
        ),
      );
      setMap((prev) =>
        prev
          ? {
              ...prev,
              drops: [
                ...prev.drops,
                {
                  id: e.dropId,
                  dropperUserId: e.dropperUserId,
                  lat: e.location.lat,
                  lng: e.location.lng,
                  insideZone: e.insideZone,
                  markedAt: e.markedAt,
                },
              ],
            }
          : prev,
      );
    };

    s.on('dropper.location', onLocation);
    s.on('drop.created', onDrop);
    return () => {
      s.emit('leave:job', id);
      s.off('dropper.location', onLocation);
      s.off('drop.created', onDrop);
    };
  }, [id]);

  // ── Mapbox init ──────────────────────────────────────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapRef.current || !map?.zone?.polygon) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const m = new mapboxgl.Map({
        container: mapRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: centroid(map.zone!.polygon.coordinates[0]),
        zoom: 14,
      });
      mapInstance.current = m;
      m.on('load', () => {
        setMapReady(true);
        m.addSource('zone', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: map.zone!.polygon },
        });
        m.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': '#7C3AED', 'fill-opacity': 0.10 } });
        m.addLayer({ id: 'zone-line', type: 'line', source: 'zone', paint: { 'line-color': '#7C3AED', 'line-width': 2 } });

        const bbox = polygonBbox(map.zone!.polygon.coordinates[0]);
        m.fitBounds(
          [
            [bbox.minLng, bbox.minLat],
            [bbox.maxLng, bbox.maxLat],
          ],
          { padding: 80, animate: false },
        );
      });
      cleanup = () => m.remove();
    })();
    return () => cleanup?.();
  }, [map?.zone?.polygon]);

  // ── Push drops + dropper pins to map (any time data changes) ─────
  useEffect(() => {
    const m = mapInstance.current as
      | { getSource: (id: string) => unknown; addSource: (...args: unknown[]) => void; addLayer: (...args: unknown[]) => void; isStyleLoaded: () => boolean }
      | null;
    if (!m || !mapReady) return;

    // Drops layer
    const dropsData = {
      type: 'FeatureCollection',
      features: (map?.drops ?? []).map((d) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: { id: d.id, inside: d.insideZone },
      })),
    };
    const existing = m.getSource('drops') as { setData: (d: unknown) => void } | undefined;
    if (existing) {
      existing.setData(dropsData);
    } else if (m.getSource('zone')) {
      m.addSource('drops', { type: 'geojson', data: dropsData });
      m.addLayer({
        id: 'drops-circle',
        type: 'circle',
        source: 'drops',
        paint: {
          'circle-radius': 3.5,
          'circle-color': ['case', ['get', 'inside'], '#10B981', '#EF4444'],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
        },
      });
    }

    // Strava-style walking-path layer — one MultiLineString feature per dropper
    // with its colour baked in as a feature property. Mapbox draws a thick
    // semi-transparent stroke so overlapping passes (back-and-forth on the
    // same street) accumulate to the Strava "heatmap" look.
    const routesData = {
      type: 'FeatureCollection',
      features: (map?.routes ?? [])
        .filter((r) => r.coords && r.coords.length >= 2)
        .map((r, i) => {
          // Stable colour per assignment so the path matches the side-panel pin.
          const idx = (map?.routes ?? []).findIndex((x) => x.assignmentId === r.assignmentId);
          const colour = DROPPER_COLOURS[(idx >= 0 ? idx : i) % DROPPER_COLOURS.length];
          return {
            type: 'Feature' as const,
            geometry: { type: 'LineString' as const, coordinates: r.coords },
            properties: { colour, dropperUserId: r.dropperUserId },
          };
        }),
    };
    const existingRoutes = m.getSource('routes') as { setData: (d: unknown) => void } | undefined;
    if (existingRoutes) {
      existingRoutes.setData(routesData);
    } else if (m.getSource('zone')) {
      m.addSource('routes', { type: 'geojson', data: routesData });
      // Drawn BEFORE the drops layer so drop dots sit on top of the line.
      m.addLayer(
        {
          id: 'routes-line',
          type: 'line',
          source: 'routes',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'colour'],
            'line-width': 3.5,
            'line-opacity': 0.85,
          },
        },
        'drops-circle',
      );
    }
  }, [map?.drops, map?.routes, mapReady]);

  // ── Dropper live pins (markers, animated by setLngLat) ───────────
  useEffect(() => {
    if (!mapInstance.current || !mapReady) return;
    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      droppers.forEach((d, i) => {
        if (!d.lastLocation) return;
        const colour = DROPPER_COLOURS[i % DROPPER_COLOURS.length];
        const existing = dropperMarkers.current.get(d.assignmentId) as
          | { setLngLat: (l: [number, number]) => void }
          | undefined;
        if (existing) {
          existing.setLngLat([d.lastLocation.lng, d.lastLocation.lat]);
          return;
        }
        const el = document.createElement('div');
        el.className = 'dropper-marker';
        el.innerHTML = `
          <div style="position:relative;">
            <span style="position:absolute;inset:-6px;border-radius:50%;background:${colour}33;animation:pulse 1.6s ease-out infinite;"></span>
            <span style="position:relative;display:block;width:14px;height:14px;border-radius:50%;background:${colour};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);"></span>
          </div>`;
        const marker = new mapboxgl.Marker(el)
          .setLngLat([d.lastLocation.lng, d.lastLocation.lat])
          .addTo(mapInstance.current as never);
        dropperMarkers.current.set(d.assignmentId, marker);
      });

      // Remove markers for departed droppers
      const ids = new Set(droppers.map((d) => d.assignmentId));
      for (const [aid, marker] of dropperMarkers.current.entries()) {
        if (!ids.has(aid)) {
          (marker as { remove: () => void }).remove();
          dropperMarkers.current.delete(aid);
        }
      }
    })();
  }, [droppers, mapReady]);

  // ── Derived stats ────────────────────────────────────────────────
  const totals = useMemo(() => {
    const dropsCompleted = droppers.reduce((s, d) => s + d.dropsCompleted, 0);
    const target = droppers.reduce((s, d) => s + d.targetLeaflets, 0) || (job?.leafletCount ?? 0);
    const coverage = target > 0 ? Math.min(100, Math.round((dropsCompleted / target) * 100)) : 0;
    return { dropsCompleted, target, coverage };
  }, [droppers, job]);

  if (error) {
    return (
      <Shell>
        <div className="max-w-md p-5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          <p className="font-semibold mb-1">Could not load tracking</p>
          <p>{error}</p>
          <a href={`/campaigns/${id}`} className="btn-ghost mt-3">← Back to campaign</a>
        </div>
      </Shell>
    );
  }
  if (!job) {
    return (
      <Shell>
        <p className="text-text-muted text-sm">
          <Loader2 size={14} className="inline animate-spin mr-2" /> Loading live tracking…
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <a href={`/campaigns/${id}`} className="text-sm text-text-muted inline-flex items-center gap-1.5 hover:text-text-primary">
        <ArrowLeft size={14} /> Back to campaign
      </a>

      <header className="mt-3 mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[40px] leading-[1.05] font-bold tracking-tight">
            Live tracking{' '}
            <span className="font-serif italic font-normal text-text-secondary">— right now.</span>
          </h1>
          <p className="mt-2 text-sm text-text-muted inline-flex items-center gap-2">
            <Radio size={14} className="text-emerald-500" />
            <span>{job.title} · {job.jobCode}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Stat label="Active droppers" value={droppers.length.toString()} />
          <Stat label="Drops live" value={totals.dropsCompleted.toLocaleString()} />
          <Stat label="Coverage" value={`${totals.coverage}%`} accent />
        </div>
      </header>

      <div className="grid grid-cols-[1.6fr_1fr] gap-4">
        {/* Map */}
        <section className="bg-white border border-border rounded-2xl overflow-hidden shadow-[0_2px_6px_rgba(11,13,18,.04)] min-h-[560px]">
          {map?.zone?.polygon ? (
            <div ref={mapRef} className="h-[560px]" />
          ) : (
            <div className="h-[560px] flex items-center justify-center text-text-muted text-sm">
              No zone polygon for this campaign.
            </div>
          )}
        </section>

        {/* Side panel */}
        <aside className="bg-white border border-border rounded-2xl p-5 shadow-[0_2px_6px_rgba(11,13,18,.04)]">
          <h3 className="font-bold text-base mb-1">Droppers in the field</h3>
          <p className="text-xs text-text-muted mb-4">
            Updates push live · {droppers.length === 0 ? 'no active droppers yet' : `${droppers.length} active`}
          </p>
          {droppers.length === 0 ? (
            <div className="p-4 bg-bg-muted/40 rounded-xl text-sm text-text-secondary">
              When droppers start an assignment for this campaign, their position will appear here in real time.
            </div>
          ) : (
            <div className="flex flex-col">
              {droppers.map((d, i) => {
                const colour = DROPPER_COLOURS[i % DROPPER_COLOURS.length];
                const pct = d.targetLeaflets > 0 ? Math.round((d.dropsCompleted / d.targetLeaflets) * 100) : 0;
                return (
                  <div key={d.assignmentId} className={`py-3.5 ${i > 0 ? 'border-t border-border' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: colour, boxShadow: `0 0 8px ${colour}` }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{d.dropperName}</p>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {d.status === 'started' ? 'Walking' : 'Paused'}
                          {' · '}
                          {d.lastLocation?.at ? `seen ${timeAgo(d.lastLocation.at)}` : 'no signal yet'}
                        </p>
                      </div>
                      <p className="text-sm font-bold tabular-nums">{d.dropsCompleted}</p>
                    </div>
                    <div className="mt-2 h-1.5 bg-bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: colour }}
                      />
                    </div>
                    <p className="text-[11px] text-text-muted mt-1.5">{d.dropsCompleted.toLocaleString()} of {d.targetLeaflets.toLocaleString()} drops · {pct}%</p>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {/* Pulse keyframes for live markers */}
      <style jsx global>{`
        @keyframes pulse {
          0%   { transform: scale(1);   opacity: 0.6; }
          70%  { transform: scale(2.4); opacity: 0;   }
          100% { transform: scale(1);   opacity: 0;   }
        }
      `}</style>
    </Shell>
  );
}

// ─── helpers ───

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
      <AppSidebar active="tracking" />
      <main className="p-8 lg:p-10 max-w-[1280px]">{children}</main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-[.12em] text-text-muted font-bold">{label}</p>
      <p className={`text-2xl font-bold tabular-nums tracking-tight ${accent ? 'text-emerald-600' : ''}`}>{value}</p>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function centroid(ring: number[][]): [number, number] {
  let lng = 0, lat = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  return [lng / ring.length, lat / ring.length];
}
function polygonBbox(ring: number[][]) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}
