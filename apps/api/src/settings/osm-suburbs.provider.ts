import type { GeoJsonPolygon } from '@droptrack/db';

export interface SuburbSearchResult {
  name: string;
  display_name: string;
  postcode: string;
  state: string;
  osm_id: string;
  osm_type: string;
}

export interface OsmSuburbsProvider {
  /** Search Australian suburb boundaries by name or postcode. */
  searchAustralianSuburbs(query: string): Promise<SuburbSearchResult[]>;

  /** Fetch official suburb MultiPolygon boundary by spatial boundary identifiers. */
  fetchSuburbBoundary(osmId: string, osmType: string): Promise<GeoJsonPolygon>;
}

export const OSM_SUBURBS_PROVIDER = Symbol('OSM_SUBURBS_PROVIDER');
