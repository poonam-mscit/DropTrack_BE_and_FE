'use client';
import { useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Distinct-but-readable palette for per-dropper route colouring. Kept in
// sync with the client campaign-detail map so the same dropper reads as
// the same colour across admin/live and client/completed views.
const ROUTE_COLORS = ['#F59E0B', '#3B82F6', '#EC4899', '#10B981', '#8B5CF6', '#EF4444', '#14B8A6', '#F97316'];

export interface MapDrop {
  id: string;
  lat: number;
  lng: number;
  insideZone: boolean;
  dropperUserId?: string;
}

export interface MapRoute {
  assignmentId: string;
  dropperUserId: string;
  coords: Array<[number, number]>;
  points: number;
}

export interface LiveDropper {
  assignmentId: string;
  dropperName: string;
  lat: number;
  lng: number;
}

interface Props {
  /** GeoJSON Polygon — drawn as the zone outline. */
  polygon: GeoJSON.Polygon | null;
  /** Existing + new drops. New ones added by parent state will animate in. */
  drops: MapDrop[];
  /** Strava-style walking paths — one polyline per dropper. */
  routes?: MapRoute[];
  /** Highlight the most recent drop (set by parent when a socket event lands). */
  newestDropId?: string | null;
  /** Latest GPS position per active dropper — rendered as a pulsing indigo dot. */
  droppers?: LiveDropper[];
}

/**
 * Mapbox map for the live track page.
 * - Renders the zone polygon (lime stroke, indigo fill).
 * - Renders one circle per drop, colour-coded by insideZone.
 * - Auto-fits bounds on first polygon load.
 * - When NEXT_PUBLIC_MAPBOX_TOKEN is missing, falls back to a styled placeholder
 *   that still shows drop coordinates in a list so the page is useful in dev.
 */
export function LiveMap({ polygon, drops, routes, newestDropId, droppers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const fittedRef = useRef(false);
  const focusedOnDropperRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  // ───────────────────────── init ─────────────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      if (disposed) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [151.253, -33.895],
        zoom: 14,
      });
      mapRef.current = map;

      map.on('load', () => {
        setMapReady(true);
        // Zone source
        map.addSource('zone', {
          type: 'geojson',
          data: { type: 'Feature', geometry: emptyPolygon, properties: {} },
        });
        map.addLayer({
          id: 'zone-fill',
          type: 'fill',
          source: 'zone',
          paint: { 'fill-color': '#4F46E5', 'fill-opacity': 0.1 },
        });
        map.addLayer({
          id: 'zone-line',
          type: 'line',
          source: 'zone',
          paint: { 'line-color': '#A3E635', 'line-width': 2.5 },
        });

        // Walking-trail source — one LineString per dropper (below drops)
        map.addSource('routes', { type: 'geojson', data: emptyFC });
        map.addLayer({
          id: 'routes-line',
          type: 'line',
          source: 'routes',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#F59E0B'],
            'line-width': 4,
            'line-opacity': 0.85,
          },
        });

        // Drops source
        map.addSource('drops', { type: 'geojson', data: emptyFC });
        map.addLayer({
          id: 'drops-pulse',
          type: 'circle',
          source: 'drops',
          paint: {
            'circle-radius': ['case', ['get', 'fresh'], 14, 0],
            'circle-color': '#A3E635',
            'circle-opacity': ['case', ['get', 'fresh'], 0.3, 0],
            'circle-blur': 0.4,
          },
        });
        map.addLayer({
          id: 'drops-dot',
          type: 'circle',
          source: 'drops',
          paint: {
            'circle-radius': 5,
            'circle-color': ['case', ['get', 'inside'], '#10B981', '#EF4444'],
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 2,
          },
        });

        // Live dropper positions — pulsing indigo halo + white-stroked dot on top.
        map.addSource('droppers', { type: 'geojson', data: emptyFC });
        map.addLayer({
          id: 'droppers-pulse',
          type: 'circle',
          source: 'droppers',
          paint: {
            'circle-radius': 22,
            'circle-color': '#4F46E5',
            'circle-opacity': 0.25,
            'circle-blur': 0.5,
          },
        });
        map.addLayer({
          id: 'droppers-dot',
          type: 'circle',
          source: 'droppers',
          paint: {
            'circle-radius': 8,
            'circle-color': '#4F46E5',
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 3,
          },
        });
        map.addLayer({
          id: 'droppers-label',
          type: 'symbol',
          source: 'droppers',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-offset': [0, 1.4],
            'text-anchor': 'top',
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          },
          paint: {
            'text-color': '#1F2937',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 2,
          },
        });
      });

      cleanup = () => map.remove();
    })();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  // ─────────────────── update polygon ───────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapRef.current || !polygon || !mapReady) return;
    const map = mapRef.current as MapboxMap;
    const src = map.getSource('zone') as MapboxSource | undefined;
    if (!src) return;
    src.setData({ type: 'Feature', geometry: polygon, properties: {} });

    if (!fittedRef.current) {
      const bounds = polygonBounds(polygon);
      map.fitBounds(bounds, { padding: 60, duration: 0 });
      fittedRef.current = true;
    }
  }, [polygon, mapReady]);

  // ──────────────────── update routes (walking trail) ────
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapRef.current || !mapReady) return;
    const map = mapRef.current as MapboxMap;
    const src = map.getSource('routes') as MapboxSource | undefined;
    if (!src) return;
    const usable = (routes ?? []).filter((r) => r.coords && r.coords.length >= 2);
    src.setData({
      type: 'FeatureCollection',
      features: usable.map((r, i) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: r.coords },
        properties: {
          assignmentId: r.assignmentId,
          color: ROUTE_COLORS[i % ROUTE_COLORS.length],
        },
      })),
    });
  }, [routes, mapReady]);

  // ──────────────────── update live dropper positions ───
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapRef.current || !mapReady) return;
    const map = mapRef.current as MapboxMap;
    const src = map.getSource('droppers') as MapboxSource | undefined;
    if (!src) return;
    const list = droppers ?? [];
    src.setData({
      type: 'FeatureCollection',
      features: list.map((d) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: { name: d.dropperName, assignmentId: d.assignmentId },
      })),
    });

    // First time we see any dropper, zoom in on them so the admin isn't
    // staring at the whole zone polygon. Subsequent updates don't re-fly
    // (avoids fighting the admin's manual pan/zoom).
    if (!focusedOnDropperRef.current && list.length > 0) {
      const first = list[0];
      map.easeTo({ center: [first.lng, first.lat], zoom: 17, duration: 800 });
      focusedOnDropperRef.current = true;
    }
  }, [droppers, mapReady]);

  // ──────────────────── update drops ────────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapRef.current || !mapReady) return;
    const map = mapRef.current as MapboxMap;
    const src = map.getSource('drops') as MapboxSource | undefined;
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: drops.map((d) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: { inside: d.insideZone, fresh: d.id === newestDropId },
      })),
    });
  }, [drops, newestDropId, mapReady]);

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className="rounded-2xl border border-border bg-bg-muted p-6 text-sm text-text-secondary"
        style={{ height: 400 }}
      >
        <div className="text-text-primary font-semibold mb-2">Map preview disabled</div>
        <p className="mb-3 text-text-muted">
          Add <code className="bg-white px-1.5 py-0.5 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{' '}
          <code className="bg-white px-1.5 py-0.5 rounded">apps/web/.env.local</code> to enable the
          interactive map. Drops:
        </p>
        <div className="max-h-[280px] overflow-y-auto space-y-1.5 font-mono text-xs">
          {drops.map((d) => (
            <div
              key={d.id}
              className={`flex justify-between rounded px-2 py-1 ${
                d.id === newestDropId ? 'bg-accent/30 ring-1 ring-accent' : 'bg-white'
              }`}
            >
              <span>{d.id.slice(0, 8)}…</span>
              <span>
                ({d.lat.toFixed(5)}, {d.lng.toFixed(5)})
              </span>
              <span className={d.insideZone ? 'text-success' : 'text-danger'}>
                {d.insideZone ? '✓' : '✗ outside'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="rounded-2xl overflow-hidden" style={{ height: 400 }} />;
}

// ─────────────────────── helpers ───────────────────────

interface MapboxSource {
  setData(data: GeoJSON.Feature | GeoJSON.FeatureCollection): void;
}
interface MapboxMap {
  getSource(id: string): MapboxSource | undefined;
  fitBounds(bounds: [[number, number], [number, number]], opts?: object): void;
  easeTo(opts: { center: [number, number]; zoom?: number; duration?: number }): void;
  remove(): void;
}

const emptyPolygon: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [0, 0.01],
      [0.01, 0.01],
      [0.01, 0],
      [0, 0],
    ],
  ],
};

const emptyFC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

function polygonBounds(p: GeoJSON.Polygon): [[number, number], [number, number]] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const ring of p.coordinates) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
