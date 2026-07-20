'use client';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, Footprints, Loader2, Route, Target } from 'lucide-react';
import { api } from '@/lib/api';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface AssignmentDetail {
  assignment: {
    id: string;
    jobId: string;
    status: 'pending' | 'started' | 'paused' | 'completed' | 'abandoned';
    dropsCompleted: number;
    targetLeaflets: number | null;
    distanceWalkedM: number;
    pausedTotalSeconds: number;
    startedAt: string | null;
    completedAt: string | null;
  };
  job: { id: string; code: string; title: string; leafletCount?: number };
  subZone: { targetLeaflets: number } | null;
}

interface JobMap {
  zone: { polygon: GeoJSON.Polygon } | null;
  drops: Array<{ id: string; lat: number; lng: number; markedAt: string; insideZone: boolean; assignmentId: string }>;
  routes?: Array<{ assignmentId: string; coords: Array<[number, number]>; points: number }>;
}

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
function fmtDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

export default function DropperRecap() {
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [jobMap, setJobMap] = useState<JobMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const d = await api.get<AssignmentDetail>(`/api/me/assignments/${id}`);
        setDetail(d);
        const m = await api.get<JobMap>(`/api/jobs/${d.job.id}/map`).catch(() => null);
        if (m) setJobMap(m);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapDivRef.current || !jobMap || !detail) return;
    let cancelled = false;

    const myRoute = jobMap.routes?.find((r) => r.assignmentId === detail.assignment.id);
    const myDrops = jobMap.drops.filter((d) => d.assignmentId === detail.assignment.id);

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      if (cancelled) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapDivRef.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [149.145, -35.323],
        zoom: 15,
        interactive: true,
      });
      mapRef.current = map;

      map.on('load', () => {
        // Zone
        if (jobMap.zone?.polygon) {
          map.addSource('zone', { type: 'geojson', data: { type: 'Feature', geometry: jobMap.zone.polygon, properties: {} } });
          map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': '#4F46E5', 'fill-opacity': 0.08 } });
          map.addLayer({ id: 'zone-line', type: 'line', source: 'zone', paint: { 'line-color': '#4F46E5', 'line-width': 1.5, 'line-dasharray': [2, 2] } });
        }

        // Walking trail
        if (myRoute && myRoute.coords.length >= 2) {
          map.addSource('trail', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: myRoute.coords }, properties: {} } });
          map.addLayer({
            id: 'trail-line',
            type: 'line',
            source: 'trail',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#F59E0B', 'line-width': 5, 'line-opacity': 0.9 },
          });
        }

        // Drops
        if (myDrops.length) {
          map.addSource('drops', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: myDrops.map((d) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.lng, d.lat] }, properties: {} })),
            },
          });
          map.addLayer({
            id: 'drops-dot',
            type: 'circle',
            source: 'drops',
            paint: {
              'circle-radius': 5,
              'circle-color': '#10B981',
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 2,
            },
          });
        }

        // Start + finish markers on the trail
        if (myRoute && myRoute.coords.length >= 2) {
          const [startLng, startLat] = myRoute.coords[0];
          const [endLng, endLat] = myRoute.coords[myRoute.coords.length - 1];
          const startEl = document.createElement('div');
          startEl.style.cssText = 'width:26px;height:26px;border-radius:50%;background:#10B981;color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25);';
          startEl.textContent = 'S';
          new mapboxgl.Marker({ element: startEl }).setLngLat([startLng, startLat]).addTo(map);
          const endEl = document.createElement('div');
          endEl.style.cssText = 'width:26px;height:26px;border-radius:50%;background:#0F1029;color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25);';
          endEl.textContent = 'F';
          new mapboxgl.Marker({ element: endEl }).setLngLat([endLng, endLat]).addTo(map);
        }

        // Fit to trail (fallback: zone; fallback: drops)
        const coordsForFit: Array<[number, number]> =
          myRoute && myRoute.coords.length ? myRoute.coords : myDrops.map((d) => [d.lng, d.lat] as [number, number]);
        if (coordsForFit.length) {
          let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
          for (const [lng, lat] of coordsForFit) {
            if (lng < minLng) minLng = lng;
            if (lat < minLat) minLat = lat;
            if (lng > maxLng) maxLng = lng;
            if (lat > maxLat) maxLat = lat;
          }
          map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, duration: 0 });
        }
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [jobMap, detail]);

  if (error) return <div className="p-4 text-sm text-red-300">{error}</div>;
  if (!detail) return <div className="py-10 text-center text-white/40 text-sm"><Loader2 size={18} className="inline animate-spin mr-2" /> Loading recap…</div>;

  const a = detail.assignment;
  const target = a.targetLeaflets ?? detail.subZone?.targetLeaflets ?? detail.job.leafletCount ?? 0;
  const completedAt = a.completedAt ? new Date(a.completedAt) : null;
  const startedAt = a.startedAt ? new Date(a.startedAt) : null;
  const totalElapsedSec = completedAt && startedAt
    ? Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000) - a.pausedTotalSeconds)
    : 0;
  const paceMinPerKm = totalElapsedSec > 0 && a.distanceWalkedM > 0
    ? (totalElapsedSec / 60) / (a.distanceWalkedM / 1000)
    : 0;
  const paceStr = paceMinPerKm > 0 ? `${Math.floor(paceMinPerKm)}:${String(Math.round((paceMinPerKm % 1) * 60)).padStart(2, '0')} /km` : '—';

  return (
    <div className="pb-8">
      <Link href="/dropper" className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white mb-3">
        <ArrowLeft size={14} /> All jobs
      </Link>

      {/* Header */}
      <div className="rounded-2xl p-5 mb-4 relative overflow-hidden"
        style={{ background: 'radial-gradient(400px circle at 100% 0%, rgba(163,230,53,.15), transparent 60%), linear-gradient(160deg, #1A1B36 0%, #0F1029 100%)', border: '1px solid rgba(163,230,53,.25)' }}>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-emerald-300 mb-2">
          <CheckCircle2 size={14} /> Drop complete
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{detail.job.title}</h1>
        <p className="text-white/60 text-xs mt-1">
          {detail.job.code}
          {completedAt && <> · finished {completedAt.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>}
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Stat icon={<Target size={14} />} label="Drops" value={`${a.dropsCompleted} / ${target}`} />
        <Stat icon={<Route size={14} />} label="Distance" value={fmtDistance(a.distanceWalkedM)} />
        <Stat icon={<Clock size={14} />} label="Moving time" value={fmtDuration(totalElapsedSec)} />
        <Stat icon={<Footprints size={14} />} label="Pace" value={paceStr} />
      </div>

      {/* Map */}
      <div className="w-full h-[45vh] min-h-[300px] rounded-2xl overflow-hidden bg-white/5 border border-white/10 mb-4">
        {!MAPBOX_TOKEN && (
          <div className="flex items-center justify-center h-full text-white/40 text-xs px-4 text-center">
            Map preview needs NEXT_PUBLIC_MAPBOX_TOKEN.
          </div>
        )}
        <div ref={mapDivRef} className="w-full h-full" />
      </div>

      {/* Streaks / hint */}
      <div className="text-[11px] text-white/50 text-center leading-relaxed">
        Green pins mark every letterbox you dropped · orange line is your walking path ·{' '}
        <span className="text-emerald-300">S</span> = start, <span className="text-white">F</span> = finish.
      </div>

      <Link
        href="/dropper"
        className="mt-6 w-full flex items-center justify-center rounded-2xl bg-emerald-400 text-emerald-950 font-bold py-4 active:bg-emerald-500"
      >
        Done — back to jobs
      </Link>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-white/50 mb-1">
        {icon} {label}
      </div>
      <div className="text-lg font-extrabold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}
