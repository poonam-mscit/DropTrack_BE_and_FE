/**
 * Client-side draft for the multi-step Create Job flow.
 * Persists in localStorage so a refresh between steps keeps state.
 */
export interface DraftPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface JobDraft {
  /** Server-side job id. Present when the user is *editing* an existing draft. */
  id?: string;
  title: string;
  campaignType:
    | 'real_estate'
    | 'medical'
    | 'political'
    | 'food'
    | 'retail'
    | 'education'
    | 'government'
    | 'other';
  leafletCount: number;
  leafletSize: 'dl' | 'a5' | 'a4';
  startDate: string;
  deadline: string;
  skipNoJunkMail: boolean;
  skipApartments: boolean;
  specialInstructions?: string;
  /** Free-text Australian suburb captured by AI Job Creator (used to centre the zone map). */
  suburb?: string;
  zone?: DraftPolygon;
  /** Last AI Smart Zones estimate — cached so step 2 paints instantly on back-nav. */
  zoneEstimate?: SmartZoneEstimate;
}

const KEY = 'droptrack.create-job-draft';

export function loadDraft(): Partial<JobDraft> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<JobDraft>) : {};
  } catch {
    return {};
  }
}

export function saveDraft(patch: Partial<JobDraft>) {
  const current = loadDraft();
  window.localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
}

export function clearDraft() {
  window.localStorage.removeItem(KEY);
}

/**
 * Fetch an existing draft job + its zone from the API and write them into
 * localStorage so the multi-step Create flow can resume editing.
 *
 * Throws if the job is no longer in 'draft' status (paid/active jobs can't be edited).
 */
export async function loadDraftFromServer(jobId: string): Promise<Partial<JobDraft>> {
  const { api } = await import('./api');
  const [jobRes, mapRes] = await Promise.all([
    api.get<{ data: ApiJobForEdit } | ApiJobForEdit>(`/api/jobs/${jobId}`),
    api
      .get<{ zone: { polygon: DraftPolygon | null } | null }>(`/api/jobs/${jobId}/map`)
      .catch(() => null),
  ]);
  const job = (jobRes as { data?: ApiJobForEdit }).data ?? (jobRes as ApiJobForEdit);
  if (job.status !== 'draft') {
    throw new Error(`Cannot edit a campaign in status "${job.status}".`);
  }
  const draft: Partial<JobDraft> = {
    id: job.id,
    title: job.title,
    campaignType: job.campaignType as JobDraft['campaignType'],
    leafletCount: job.leafletCount,
    leafletSize: (job.leafletSize ?? 'dl') as JobDraft['leafletSize'],
    startDate: job.startDate ?? '',
    deadline: job.deadline ?? '',
    skipNoJunkMail: job.skipNoJunkMail ?? true,
    skipApartments: job.skipApartments ?? false,
    specialInstructions: job.specialInstructions ?? undefined,
    zone: mapRes?.zone?.polygon ?? undefined,
  };
  clearDraft();
  saveDraft(draft);
  return draft;
}

/** Minimum subset of the API job row needed to seed the editor. */
interface ApiJobForEdit {
  id: string;
  title: string;
  campaignType: string;
  leafletCount: number;
  leafletSize: string | null;
  status: string;
  startDate: string | null;
  deadline: string | null;
  skipNoJunkMail: boolean;
  skipApartments: boolean;
  specialInstructions: string | null;
}

export interface PriceBreakdown {
  leafletCount: number;
  ratePerLeafletCents: number;
  subtotalCents: number;
  platformFeeCents: number;
  netCents: number;
  gstCents: number;
  totalCents: number;
}

export interface SmartZoneEstimate {
  areaSqm: number;
  areaKm2: number;
  density: 'inner_city' | 'inner_suburb' | 'suburban';
  /** 'osm' = measured against OpenStreetMap, 'heuristic' = lat-based fallback. */
  source: 'osm' | 'heuristic';
  /** Total letterboxes the polygon contains (AI estimate). */
  zoneLetterboxes: number;
  /** Drops the client is paying for — what they requested, NOT capped to the zone. */
  clientDropCount: number;
  /** AI's recommended count: min(zoneLetterboxes, clientDropCount). */
  aiSuggestedDropCount: number;
  /** Price in cents for the AI-suggested count — shown as a hint when it differs. */
  aiSuggestedPriceCents: number;
  /** @deprecated equals clientDropCount. */
  estimatedLetterboxes: number;
  estimatedHouses: number;
  estimatedApartments: number;
  estimatedDistanceKm: number;
  estimatedMinutes: number;
  suggestedPriceCents: number;
  suggestedPriceFormatted: string;
  priceBreakdown: PriceBreakdown;
}
