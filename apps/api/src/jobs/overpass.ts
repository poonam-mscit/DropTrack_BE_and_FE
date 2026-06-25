/**
 * Measure a polygon against live OpenStreetMap data via the Overpass API.
 *
 * Returns the residential street length (km) and building count inside the
 * polygon — the two numbers we need to size walking distance and letterbox
 * count without any heuristic guess.
 *
 * - Free, public API. No key required.
 * - Latency: typically 1-3 s for residential-suburb-sized polygons.
 * - Cached in-process for `CACHE_TTL_MS` to avoid hammering Overpass on
 *   refinement turns where the polygon barely changed.
 *
 * Returns `null` on any failure (network, timeout, parse) so the caller can
 * fall back to the lat-based heuristic.
 */
import type { GeoJsonPolygon } from '@droptrack/db';
import { createHash } from 'node:crypto';

/** Try the main Overpass endpoint, then a Kumi mirror, before giving up. */
const ENDPOINTS = [
  process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const STREET_TYPES = 'residential|tertiary|unclassified|living_street|secondary|primary|road';

/** OSM building tag values we exclude — not residential / no letterbox. */
const EXCLUDE_BUILDING_TYPES = new Set([
  'garage', 'garages', 'shed', 'roof', 'hut', 'ruins', 'carport',
  'industrial', 'warehouse', 'silo', 'storage_tank', 'service',
]);

export interface OverpassMeasurement {
  /** Length of residential-grade streets inside the polygon, in km. */
  streetKm: number;
  /** Count of building footprints inside the polygon (filtered for residential). */
  buildingCount: number;
  source: 'osm';
}

interface CacheEntry {
  expiresAt: number;
  value: OverpassMeasurement | null;
}
const cache = new Map<string, CacheEntry>();

export async function measurePolygon(
  polygon: GeoJsonPolygon,
): Promise<OverpassMeasurement | null> {
  const key = hashPolygon(polygon);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const result = await runQuery(polygon).catch((err: Error) => {
    // eslint-disable-next-line no-console
    console.warn(`[overpass] query failed: ${err.name}: ${err.message}`);
    return null;
  });
  // Only cache successes — failures get one-minute negative TTL so we don't
  // hammer Overpass but also recover quickly when it comes back.
  const ttl = result ? CACHE_TTL_MS : 60_000;
  cache.set(key, { value: result, expiresAt: Date.now() + ttl });
  return result;
}

async function runQuery(polygon: GeoJsonPolygon): Promise<OverpassMeasurement | null> {
  const polyStr = buildPolyFilter(polygon);
  const query = `
    [out:json][timeout:20];
    (
      way["highway"~"${STREET_TYPES}"](poly:"${polyStr}");
      way["building"](poly:"${polyStr}");
    );
    out geom;
  `;

  for (const endpoint of ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'DropTrack/1.0 (https://droptrack.com.au)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn(`[overpass] ${endpoint} returned ${res.status} — trying next mirror`);
        continue;
      }
      const data = (await res.json()) as { elements?: OverpassElement[] };
      return tally(data.elements ?? []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[overpass] ${endpoint} failed: ${(err as Error).message} — trying next mirror`);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

interface OverpassElement {
  type: string;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

function tally(elements: OverpassElement[]): OverpassMeasurement {
  let streetMeters = 0;
  let buildingCount = 0;

  for (const el of elements) {
    const tags = el.tags ?? {};
    const geom = el.geometry;
    if (!geom?.length) continue;

    if (tags.highway) {
      for (let i = 1; i < geom.length; i++) {
        streetMeters += haversineM(geom[i - 1], geom[i]);
      }
    } else if (tags.building) {
      if (!EXCLUDE_BUILDING_TYPES.has(tags.building)) buildingCount++;
    }
  }

  return {
    streetKm: streetMeters / 1_000,
    buildingCount,
    source: 'osm',
  };
}

function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Overpass poly filter format: "lat lng lat lng ..." with the outer ring only. */
function buildPolyFilter(p: GeoJsonPolygon): string {
  const ring = p.coordinates[0] ?? [];
  return ring.map(([lng, lat]) => `${lat} ${lng}`).join(' ');
}

function hashPolygon(p: GeoJsonPolygon): string {
  return createHash('sha1').update(JSON.stringify(p.coordinates)).digest('hex');
}
