import { Injectable, Logger } from '@nestjs/common';
import type { GeoJsonPolygon } from '@droptrack/db';
import type { OsmSuburbsProvider, SuburbSearchResult } from './osm-suburbs.provider.js';

export type NominatimSuburbResult = SuburbSearchResult;

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

const OVERPASS_ENDPOINTS = [
  process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const USER_AGENT = 'DropTrack-Production/1.0 (admin@droptrack.com.au)';
const FETCH_TIMEOUT_MS = 25_000;

const STATE_NAME_MAP: Record<string, string> = {
  'new south wales': 'NSW',
  victoria: 'VIC',
  queensland: 'QLD',
  'western australia': 'WA',
  'south australia': 'SA',
  tasmania: 'TAS',
  'australian capital territory': 'ACT',
  'northern territory': 'NT',
  nsw: 'NSW',
  vic: 'VIC',
  qld: 'QLD',
  wa: 'WA',
  sa: 'SA',
  tas: 'TAS',
  act: 'ACT',
  nt: 'NT',
};

@Injectable()
export class OsmSuburbsService implements OsmSuburbsProvider {
  private readonly logger = new Logger(OsmSuburbsService.name);

  /**
   * Search Australian suburbs via Nominatim API.
   *
   * Parameters enforced:
   * - countrycodes=au
   * - format=jsonv2
   * - addressdetails=1
   * - limit=10
   *
   * Filters:
   * - category = boundary
   * - type = administrative
   * - addresstype = suburb OR locality (or present in address details)
   */
  async searchAustralianSuburbs(query: string): Promise<NominatimSuburbResult[]> {
    const q = query?.trim();
    if (!q || q.length < 2) return [];

    const params = new URLSearchParams({
      q,
      countrycodes: 'au',
      format: 'jsonv2',
      addressdetails: '1',
      limit: '10',
    });

    const url = `${NOMINATIM_BASE_URL}/search?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.warn(`Nominatim search HTTP error ${res.status}`);
        return [];
      }

      const rawItems = (await res.json()) as any[];
      if (!Array.isArray(rawItems)) return [];

      const filtered: NominatimSuburbResult[] = [];

      for (const item of rawItems) {
        const category = item.category?.toLowerCase();
        const type = item.type?.toLowerCase();
        const addressType = item.addresstype?.toLowerCase();
        const address = item.address || {};

        // Only return official suburb or locality administrative boundaries
        const isBoundary = category === 'boundary' && type === 'administrative';
        const isSuburbOrLocality =
          addressType === 'suburb' ||
          addressType === 'locality' ||
          Boolean(address.suburb) ||
          Boolean(address.locality);

        if (!isBoundary || !isSuburbOrLocality) {
          continue;
        }

        const name =
          address.suburb ||
          address.locality ||
          item.name ||
          item.display_name?.split(',')[0]?.trim() ||
          q;

        const rawState = (address.state || '').trim();
        const state = STATE_NAME_MAP[rawState.toLowerCase()] || rawState.toUpperCase() || 'NSW';
        const postcode = (address.postcode || '').trim();

        filtered.push({
          name,
          display_name: item.display_name,
          postcode,
          state,
          osm_id: String(item.osm_id),
          osm_type: String(item.osm_type || 'relation'),
        });
      }

      return filtered;
    } catch (err: any) {
      this.logger.error(`Nominatim search failed for query "${q}": ${err.message}`);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Retrieve official suburb MultiPolygon boundary via Overpass API.
   * Converts boundary geometry into GeoJSON MultiPolygon.
   * Includes fallback to Nominatim polygon details if Overpass is delayed.
   */
  async fetchSuburbBoundary(osmId: string, osmType: string): Promise<GeoJsonPolygon> {
    const cleanId = osmId.trim();
    const cleanType = (osmType || 'relation').trim().toLowerCase();

    // 1. Primary: Query Overpass API mirrors
    const overpassPolygon = await this.fetchFromOverpass(cleanId, cleanType);
    if (overpassPolygon) {
      return overpassPolygon;
    }

    // 2. Fallback: Query Nominatim Details API with polygon_geojson=1
    this.logger.warn(
      `Overpass retrieval for ${cleanType}/${cleanId} failed or timed out. Trying Nominatim details fallback...`,
    );
    const nominatimPolygon = await this.fetchFromNominatimDetails(cleanId, cleanType);
    if (nominatimPolygon) {
      return nominatimPolygon;
    }

    throw new Error(
      `Unable to retrieve official boundary for ${cleanType}/${cleanId} from OpenStreetMap APIs. Please try again.`,
    );
  }

  private async fetchFromOverpass(osmId: string, osmType: string): Promise<GeoJsonPolygon | null> {
    const qlType = osmType === 'way' ? 'way' : 'relation';
    const query = `
      [out:json][timeout:25];
      ${qlType}(${osmId});
      out geom;
    `;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          this.logger.warn(`Overpass endpoint ${endpoint} returned status ${res.status}`);
          continue;
        }

        const data = (await res.json()) as { elements?: any[] };
        const elements = data.elements || [];
        if (elements.length === 0) continue;

        const polygon = this.convertOverpassElementsToMultiPolygon(elements);
        if (polygon) return polygon;
      } catch (err: any) {
        this.logger.warn(`Overpass endpoint ${endpoint} error: ${err.message}`);
      } finally {
        clearTimeout(timer);
      }
    }

    return null;
  }

  private async fetchFromNominatimDetails(
    osmId: string,
    osmType: string,
  ): Promise<GeoJsonPolygon | null> {
    const typeLetter = osmType.startsWith('w') ? 'W' : osmType.startsWith('n') ? 'N' : 'R';
    const url = `${NOMINATIM_BASE_URL}/details?osmtype=${typeLetter}&osmid=${osmId}&format=json&polygon_geojson=1`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!res.ok) return null;
      const data = (await res.json()) as any;
      const geometry = data.geometry;
      if (!geometry || !geometry.type || !geometry.coordinates) return null;

      return this.normalizeToMultiPolygonGeoJson(geometry);
    } catch (err: any) {
      this.logger.error(`Nominatim details fallback failed for ${osmType}/${osmId}: ${err.message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private convertOverpassElementsToMultiPolygon(elements: any[]): GeoJsonPolygon | null {
    const waySegments: Array<Array<[number, number]>> = [];

    for (const el of elements) {
      if (el.type === 'way' && Array.isArray(el.geometry)) {
        const seg = el.geometry.map((g: any) => [g.lon, g.lat] as [number, number]);
        if (seg.length > 1) waySegments.push(seg);
      } else if (el.type === 'relation' && Array.isArray(el.members)) {
        for (const member of el.members) {
          if (Array.isArray(member.geometry)) {
            const seg = member.geometry.map((g: any) => [g.lon, g.lat] as [number, number]);
            if (seg.length > 1) waySegments.push(seg);
          }
        }
      }
    }

    if (waySegments.length === 0) return null;

    const rings = this.joinWaySegmentsIntoRings(waySegments);
    if (rings.length === 0) return null;

    // Wrap linear rings into MultiPolygon GeoJSON coordinates:
    // [ [ outerRing1 ], [ outerRing2 ], ... ]
    const polygonCoordinates = rings.map((ring) => [ring]);

    return {
      type: 'Polygon',
      coordinates: polygonCoordinates[0],
    };
  }

  private joinWaySegmentsIntoRings(
    segments: Array<Array<[number, number]>>,
  ): Array<Array<[number, number]>> {
    const unused = [...segments];
    const rings: Array<Array<[number, number]>> = [];

    while (unused.length > 0) {
      let currentRing = [...unused.shift()!];
      let progress = true;

      while (progress && !this.isRingClosed(currentRing)) {
        progress = false;
        const lastPt = currentRing[currentRing.length - 1];

        for (let i = 0; i < unused.length; i++) {
          const seg = unused[i];
          const startPt = seg[0];
          const endPt = seg[seg.length - 1];

          if (this.pointsMatch(lastPt, startPt)) {
            currentRing = currentRing.concat(seg.slice(1));
            unused.splice(i, 1);
            progress = true;
            break;
          } else if (this.pointsMatch(lastPt, endPt)) {
            currentRing = currentRing.concat([...seg].reverse().slice(1));
            unused.splice(i, 1);
            progress = true;
            break;
          }
        }
      }

      if (!this.isRingClosed(currentRing) && currentRing.length >= 3) {
        currentRing.push([currentRing[0][0], currentRing[0][1]]);
      }

      if (currentRing.length >= 4) {
        rings.push(currentRing);
      }
    }

    return rings;
  }

  private pointsMatch(a: [number, number], b: [number, number]): boolean {
    const eps = 1e-6;
    return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
  }

  private isRingClosed(ring: Array<[number, number]>): boolean {
    if (ring.length < 4) return false;
    return this.pointsMatch(ring[0], ring[ring.length - 1]);
  }

  private normalizeToMultiPolygonGeoJson(geometry: any): GeoJsonPolygon {
    if (geometry.type === 'Polygon') {
      return {
        type: 'Polygon',
        coordinates: geometry.coordinates,
      };
    } else if (geometry.type === 'MultiPolygon') {
      return {
        type: 'Polygon',
        coordinates: geometry.coordinates[0],
      };
    }
    throw new Error(`Unsupported GeoJSON geometry type: ${geometry.type}`);
  }
}
