/**
 * AI Smart Zones — letterbox count + price estimate from a polygon.
 *
 * No GNAF in MVP. We use a PostGIS `ST_Area` for square metres + a
 * dwelling-density heuristic tuned for Sydney metro.
 */
import { sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import type { GeoJsonPolygon } from '@droptrack/db';
import {
  priceForLeaflets,
  type PricingConfig,
  type PriceBreakdown,
  DEFAULT_PRICING_CONFIG,
} from '../payments/pricing.js';
import { measurePolygon } from './overpass.js';

/** Letterboxes per km² by zone "type". Tuned for Sydney metro 2026. */
const DENSITY = {
  inner_city: 3_500, // CBD-style apartment density (Surry Hills, Pyrmont)
  inner_suburb: 1_800, // Bondi Junction, Newtown
  suburban: 700, // Greenacre, Hornsby
} as const;

/** Heuristic: ratio of dwellings that are apartments. */
const APARTMENT_RATIO_BY_TYPE = {
  inner_city: 0.85,
  inner_suburb: 0.35,
  suburban: 0.1,
} as const;

/**
 * Letterboxes per km of street walked (both sides). Drives the distance
 * estimate — droppers traverse streets, not point-to-point.
 * Source: AU residential street density audits, ~1000 letterboxes/km is typical
 * for established suburbs; inner-city is denser due to apartment buildings.
 */
const LETTERBOXES_PER_STREET_KM = {
  inner_city: 1_500,
  inner_suburb: 1_000,
  suburban: 800,
} as const;

/** Transit pace by transport mode (km/h while walking the street). */
const PACE_KMH: Record<'walking' | 'bicycle' | 'e_scooter', number> = {
  walking: 4,
  bicycle: 10,
  e_scooter: 12,
};
/** Seconds per drop (industry benchmark: 600–1200 drops per hour for walking). */
const SECONDS_PER_DROP: Record<'walking' | 'bicycle' | 'e_scooter', number> = {
  walking: 5,
  bicycle: 4,
  e_scooter: 3.5,
};

export interface ZoneEstimate {
  areaSqm: number;
  areaKm2: number;
  density: keyof typeof DENSITY;
  /** Where the numbers came from: 'osm' = measured OpenStreetMap data, 'heuristic' = lat-based density fallback. */
  source: 'osm' | 'heuristic';
  /** Total letterboxes the polygon contains (density × area) — AI estimate. */
  zoneLetterboxes: number;
  /** Drops the client is paying for — whatever they requested, NOT capped to the zone. */
  clientDropCount: number;
  /** What we think actually fits the polygon. `min(zoneLetterboxes, clientDropCount)`. */
  aiSuggestedDropCount: number;
  /** Price for the AI-suggested count, in cents — shown as a "suggested" hint. */
  aiSuggestedPriceCents: number;
  /** @deprecated kept for back-compat — equals clientDropCount. */
  estimatedLetterboxes: number;
  estimatedHouses: number;
  estimatedApartments: number;
  estimatedDistanceKm: number;
  estimatedMinutes: number;
  suggestedPriceCents: number;
  suggestedPriceFormatted: string;
  /** Full price breakdown — subtotal, platform fee, GST, total. All in cents. */
  priceBreakdown: PriceBreakdown;
}

/**
 * Estimate from a polygon (GeoJSON, WGS84).
 * `targetLeafletCount` overrides the density-derived count if the client
 * already knows how many leaflets they want dropped.
 * `transportMode` adjusts the time estimate (defaults to walking).
 */
export async function estimateZone(
  db: Database,
  polygon: GeoJsonPolygon,
  targetLeafletCount?: number,
  transportMode: keyof typeof PACE_KMH = 'walking',
  pricingConfig: PricingConfig = DEFAULT_PRICING_CONFIG,
): Promise<ZoneEstimate> {
  const [{ area_sqm, perimeter_m, centroid_lat }] = await db.execute<{
    area_sqm: number;
    perimeter_m: number;
    centroid_lat: number;
  }>(sql`
    WITH g AS (
      SELECT ST_GeomFromGeoJSON(${JSON.stringify(polygon)})::geography AS poly
    )
    SELECT
      ST_Area(poly)::float                            AS area_sqm,
      ST_Perimeter(poly)::float                       AS perimeter_m,
      ST_Y(ST_Centroid(poly::geometry)::geometry)::float AS centroid_lat
    FROM g;
  `);

  const areaKm2 = area_sqm / 1_000_000;

  // Classify density by proximity to any major AU CBD (Sydney, Melbourne, Brisbane,
  // Gold Coast, Adelaide, Perth). MVP heuristic — real impl would query suburb tiles.
  const density = classifyDensity(centroid_lat);

  const letterboxesPerKm2 = DENSITY[density];
  const aptRatio = APARTMENT_RATIO_BY_TYPE[density];

  // Prefer OpenStreetMap measurements (real building count, real street length).
  // Falls back to the lat-based heuristic if Overpass is slow or fails.
  const measured = await measurePolygon(polygon);

  // Total letterboxes the polygon physically contains.
  const zoneLetterboxes = measured
    ? Math.max(50, measured.buildingCount)
    : Math.max(50, Math.round(areaKm2 * letterboxesPerKm2));
  // What the client is paying for — exactly what they requested (NOT capped).
  // The polygon may have fewer letterboxes than the request; we surface that
  // gap via aiSuggestedDropCount so the UI can flag it.
  const clientDropCount = targetLeafletCount ?? zoneLetterboxes;
  const aiSuggestedDropCount = Math.min(zoneLetterboxes, clientDropCount);
  const estimatedApartments = Math.round(clientDropCount * aptRatio);
  const estimatedHouses = clientDropCount - estimatedApartments;

  // Distance — droppers walk STREETS, hitting both sides as they go.
  //
  //  OSM path:        actual street-km × 2 (both sides) × (drops / zoneLetterboxes)
  //                   — only the fraction of streets needed to hit clientDropCount
  //  Heuristic path:  drops ÷ letterboxes-per-km-of-street + small perimeter factor
  let estimatedDistanceKm: number;
  if (measured) {
    // Single-pass street walk — droppers zigzag and hit both sides as they go.
    // Fraction needed scales sub-linearly: picking a contiguous chunk of streets
    // still requires walking most of the connecting segments, so we use ^0.75
    // instead of pure proportional.
    const fraction = zoneLetterboxes > 0 ? clientDropCount / zoneLetterboxes : 1;
    estimatedDistanceKm = measured.streetKm * Math.pow(fraction, 0.75);
  } else {
    const streetWalkKm = clientDropCount / LETTERBOXES_PER_STREET_KM[density];
    const perimeterContribKm = (perimeter_m / 1_000) * 0.15;
    estimatedDistanceKm = streetWalkKm + perimeterContribKm;
  }
  const paceKmh = PACE_KMH[transportMode];
  const secondsPerDrop = SECONDS_PER_DROP[transportMode];
  const estimatedMinutes = Math.round(
    (estimatedDistanceKm / paceKmh) * 60 + (clientDropCount * secondsPerDrop) / 60,
  );

  const price = priceForLeaflets(clientDropCount, pricingConfig);
  const aiPrice = priceForLeaflets(aiSuggestedDropCount, pricingConfig);

  return {
    areaSqm: Math.round(area_sqm),
    areaKm2: Math.round(areaKm2 * 1000) / 1000,
    density,
    source: measured ? 'osm' : 'heuristic',
    zoneLetterboxes,
    clientDropCount,
    aiSuggestedDropCount,
    aiSuggestedPriceCents: aiPrice.totalCents,
    estimatedLetterboxes: clientDropCount,
    estimatedHouses,
    estimatedApartments,
    estimatedDistanceKm: Math.round(estimatedDistanceKm * 100) / 100,
    estimatedMinutes,
    suggestedPriceCents: price.totalCents,
    suggestedPriceFormatted: (price.totalCents / 100).toLocaleString('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }),
    priceBreakdown: price,
  };
}

/**
 * Classify density by proximity to a major Australian CBD.
 * Uses just latitude for MVP — good enough to distinguish CBD-cluster vs greater
 * metro vs regional. Real implementation should query ABS density tiles.
 *
 * Each CBD anchor is paired with a "scale" — how far inner-city extends from it.
 */
function classifyDensity(lat: number): keyof typeof DENSITY {
  // Latitude of each major AU CBD (longitude omitted — coastline runs N/S so a lat-only
  // check distinguishes Sydney from Brisbane/Gold Coast/Melbourne reliably enough).
  const CBDS = [
    { name: 'Sydney', lat: -33.87 },
    { name: 'Melbourne', lat: -37.81 },
    { name: 'Brisbane', lat: -27.47 },
    { name: 'Gold Coast', lat: -28.0 },
    { name: 'Adelaide', lat: -34.93 },
    { name: 'Perth', lat: -31.95 },
    { name: 'Canberra', lat: -35.28 },
    { name: 'Hobart', lat: -42.88 },
    { name: 'Darwin', lat: -12.46 },
  ];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const cbd of CBDS) {
    const d = Math.abs(lat - cbd.lat);
    if (d < nearestDistance) nearestDistance = d;
  }
  if (nearestDistance < 0.03) return 'inner_city';
  if (nearestDistance < 0.15) return 'inner_suburb';
  return 'suburban';
}
