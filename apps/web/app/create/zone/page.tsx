'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { ArrowRight, MapPin, Sparkles, Wand2 } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { StepBar } from '@/components/StepBar';
import { getSession } from '@/lib/auth';
import { loadDraft, saveDraft, type DraftPolygon, type SmartZoneEstimate } from '@/lib/draft';
import { api } from '@/lib/api';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function CreateZone() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<unknown>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const suburbCenterRef = useRef<[number, number] | null>(null);
  const [polygon, setPolygon] = useState<DraftPolygon | null>(null);
  const [estimate, setEstimate] = useState<SmartZoneEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [draftCount, setDraftCount] = useState<number>(0);

  useEffect(() => {
    if (!getSession()) router.replace('/login');
    const d = loadDraft();
    if (d.zone) setPolygon(d.zone);
    if (d.leafletCount) setDraftCount(d.leafletCount);
    // Paint the last estimate immediately so the right rail isn't blank during
    // the Overpass refresh (which can take 5-30s).
    if (d.zoneEstimate) setEstimate(d.zoneEstimate);
  }, [router]);

  // ─── Mapbox setup ───
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapRef.current) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      const MapboxDraw = (await import('@mapbox/mapbox-gl-draw')).default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      // Centre on the AI-detected suburb if available, else Bondi Junction.
      const initialCenter: [number, number] = [151.253, -33.895];
      const initialZoom = 14;
      const map = new mapboxgl.Map({
        container: mapRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: initialCenter,
        zoom: initialZoom,
      });
      mapInstanceRef.current = map;

      // If an existing polygon is already saved (editing a draft), centre the
      // map on its centroid + bbox — geocoding the suburb would land us in the
      // wrong place (the suburb isn't persisted on the job row).
      const existingZone = loadDraft().zone;
      if (existingZone) {
        const bbox = polygonBbox(existingZone);
        map.once('load', () => {
          map.fitBounds(
            [
              [bbox.minLng, bbox.minLat],
              [bbox.maxLng, bbox.maxLat],
            ],
            { padding: 60, animate: false },
          );
        });
      }

      // Geocode suburb → recentre map. Bias to AU. Mapbox v6 geocoding API.
      // Skipped when we already centred via the existing polygon above.
      const suburb = !existingZone ? loadDraft().suburb?.trim() : undefined;
      if (suburb) {
        const q = encodeURIComponent(suburb + ', Australia');
        void fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?country=AU&limit=1&access_token=${MAPBOX_TOKEN}`,
        )
          .then((r) => r.json() as Promise<{ features?: Array<{ center?: [number, number]; bbox?: [number, number, number, number] }> }>)
          .then((j) => {
            const feat = j.features?.[0];
            if (!feat) return;
            if (feat.bbox) {
              map.fitBounds(
                [
                  [feat.bbox[0], feat.bbox[1]],
                  [feat.bbox[2], feat.bbox[3]],
                ],
                { padding: 40, animate: false },
              );
            } else if (feat.center) {
              map.flyTo({ center: feat.center, zoom: 13.5, animate: false });
            }
            if (feat.center) suburbCenterRef.current = feat.center;
            // Auto-draw a polygon sized for the requested drops, once we know the centre.
            if (!loadDraft().zone && feat.center && (loadDraft().leafletCount ?? 0) > 0) {
              const poly = buildSquarePolygonAroundCentre(feat.center, loadDraft().leafletCount!);
              map.once('load', () => {
                draw.deleteAll();
                draw.add({ type: 'Feature', geometry: poly, properties: {} });
                setPolygon(poly);
              });
            }
          })
          .catch(() => {
            // Silently keep the default centre.
          });
      }
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: 'simple_select',
      });
      map.addControl(draw, 'top-right');
      drawRef.current = draw;

      const onUpdate = () => {
        const fc = draw.getAll();
        const feat = fc.features[fc.features.length - 1];
        if (feat?.geometry?.type === 'Polygon') {
          setPolygon(feat.geometry as DraftPolygon);
        }
      };
      map.on('draw.create', onUpdate);
      map.on('draw.update', onUpdate);
      map.on('draw.delete', () => {
        setPolygon(null);
        setEstimate(null);
        saveDraft({ zone: undefined, zoneEstimate: undefined });
      });

      // Restore existing polygon
      const existing = loadDraft().zone;
      if (existing) {
        map.on('load', () => {
          draw.add({ type: 'Feature', geometry: existing, properties: {} });
        });
      }
      cleanup = () => map.remove();
    })();
    return () => cleanup?.();
  }, []);

  // ─── Smart Zones estimate on polygon change ───
  useEffect(() => {
    if (!polygon) {
      setEstimate(null);
      return;
    }
    setEstimating(true);
    api
      .post<SmartZoneEstimate>('/api/jobs/estimate', { polygon, leafletCount: draftCount || undefined })
      .then((e) => {
        setEstimate(e);
        // Persist alongside the polygon so a back-nav repaints instantly.
        saveDraft({ zoneEstimate: e });
      })
      .catch((err) => console.error('estimate failed', err))
      .finally(() => setEstimating(false));
  }, [polygon, draftCount]);

  function next() {
    if (!polygon) return;
    // Preserve the user's original leafletCount — don't clamp to clientDropCount.
    // If the zone is too small to fit the target, the user can re-draw or shrink target.
    saveDraft({ zone: polygon, leafletCount: draftCount || estimate?.zoneLetterboxes });
    router.push('/create/pay');
  }

  function autoDraw() {
    const drops = draftCount || estimate?.clientDropCount || 600;
    let poly: DraftPolygon | null = null;

    // If we already have a polygon + a measured zone size, scale around the
    // current centroid so we honour real OSM density — not the lat-based guess.
    // This is what makes "Re-draw for 3,000" actually grow Griffith's polygon.
    if (polygon && estimate?.zoneLetterboxes && estimate.zoneLetterboxes > 0) {
      const ratio = drops / estimate.zoneLetterboxes;
      poly = scalePolygon(polygon, Math.sqrt(ratio));
    } else if (suburbCenterRef.current) {
      poly = buildSquarePolygonAroundCentre(suburbCenterRef.current, drops);
    } else {
      window.alert('Map still loading — try again in a moment.');
      return;
    }

    const draw = drawRef.current as { deleteAll: () => void; add: (f: unknown) => void } | null;
    if (draw) {
      draw.deleteAll();
      draw.add({ type: 'Feature', geometry: poly, properties: {} });
    }
    setPolygon(poly);
  }

  function pasteGeoJSON() {
    const input = window.prompt(
      'Paste a GeoJSON Polygon (e.g. {"type":"Polygon","coordinates":[[[lng,lat],...]]}):',
    );
    if (!input) return;
    try {
      const parsed = JSON.parse(input);
      if (parsed?.type !== 'Polygon' || !Array.isArray(parsed.coordinates)) {
        throw new Error('Not a Polygon');
      }
      setPolygon(parsed as DraftPolygon);
    } catch (err) {
      window.alert(`Invalid polygon: ${(err as Error).message}`);
    }
  }

  return (
    <div>
      <AppSidebar active={loadDraft().id ? 'campaigns' : 'create'} />
      <main className="ml-[252px] p-10">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Select Drop Zone{' '}
            <span className="font-serif italic font-normal text-text-secondary">— where to drop.</span>
          </h1>
          <a href="/dashboard" className="btn-ghost">Cancel</a>
        </div>

        <StepBar step={2} />
        <p className="text-text-muted text-xs mt-1 mb-6">Step 2 of 3 · Draw or paste the area</p>

        <div className="grid gap-5" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="card overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-border flex justify-between items-center">
              <strong className="text-sm">
                {MAPBOX_TOKEN
                  ? polygon
                    ? 'Polygon selected'
                    : 'Draw the campaign zone'
                  : 'Mapbox token not configured'}
              </strong>
              {!MAPBOX_TOKEN && (
                <button onClick={pasteGeoJSON} className="btn-ghost text-xs py-1.5 px-3">
                  Paste GeoJSON
                </button>
              )}
            </div>
            {MAPBOX_TOKEN ? (
              <div ref={mapRef} style={{ height: 520 }} />
            ) : (
              <NoMapboxFallback polygon={polygon} onPaste={pasteGeoJSON} />
            )}
          </div>

          <aside>
            <div className="card p-5 mb-3.5">
              <div className="flex items-center gap-2 mb-3.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED 50%,#A3E635)' }}
                >
                  <MapPin size={14} />
                </div>
                <strong className="text-[15px]">AI Smart Zones</strong>
                <span
                  className="ml-auto text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED 50%,#A3E635)' }}
                >
                  AI
                </span>
              </div>

              {!polygon && (
                <>
                  <p className="text-sm text-text-muted mb-3">
                    Let AI draw a zone sized for your {draftCount ? draftCount.toLocaleString() : '600'} drops, or draw it yourself.
                  </p>
                  <button onClick={autoDraw} className="btn-primary w-full justify-center mb-2 text-sm">
                    <Wand2 size={14} /> Auto-draw zone
                  </button>
                  <p className="text-[11px] text-text-muted text-center">
                    Or use the polygon tool on the map.
                  </p>
                </>
              )}

              {polygon && (
                <div className="mb-3 flex items-center gap-2">
                  <label className="text-xs text-text-muted shrink-0">Target drops</label>
                  <input
                    type="number"
                    min={50}
                    step={100}
                    value={draftCount || ''}
                    onChange={(e) => setDraftCount(Number(e.target.value) || 0)}
                    className="input flex-1 h-8 text-xs"
                  />
                  <button
                    onClick={autoDraw}
                    disabled={!draftCount || draftCount < 50}
                    className="btn-primary text-xs h-8 px-3 disabled:opacity-50"
                  >
                    <Wand2 size={12} /> Re-draw
                  </button>
                </div>
              )}

              {polygon && estimating && (
                <p className="text-sm text-text-muted">Calculating…</p>
              )}

              {polygon && estimate?.source === 'heuristic' && (
                <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] leading-relaxed text-amber-900">
                  <strong>Heads-up:</strong> OpenStreetMap didn&rsquo;t respond — these numbers are
                  a lat-based estimate, not measured. Re-draw or refresh to retry the live count.
                </div>
              )}

              {polygon && estimate && (
                <>
                  <div className="text-sm space-y-2.5">
                    <Row label="Area" value={`${estimate.areaKm2.toLocaleString()} km²`} />
                    <Row
                      label="Letterboxes in zone"
                      value={`~ ${estimate.zoneLetterboxes.toLocaleString()}`}
                    />
                    <Row
                      label="Your drops"
                      value={estimate.clientDropCount.toLocaleString()}
                      bold
                    />
                    <Row label="Walking distance" value={`~ ${estimate.estimatedDistanceKm} km`} />
                    <Row label="Estimated time" value={`~ ${formatMinutes(estimate.estimatedMinutes)}`} />
                    <Row label="Density" value={estimate.density.replace('_', ' ')} muted />
                    <Row
                      label="Data source"
                      value={estimate.source === 'osm' ? 'OpenStreetMap (live)' : 'AU census heuristic'}
                      muted
                    />
                  </div>
                  <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
                    <strong>Letterboxes in zone</strong> is the AI&rsquo;s estimate of how many are
                    physically inside your polygon (based on AU density). <strong>Your drops</strong>{' '}
                    is what we deliver and bill — set it on step 1. Distance &amp; time scale with
                    drops, not the full zone.
                  </p>
                </>
              )}
            </div>

            {estimate && (
              <div className="card p-5">
                <Sparkles size={14} className="text-primary inline mr-1.5 align-text-bottom" />
                <strong className="text-sm">Your price</strong>
                <div className="text-[36px] font-extrabold tracking-tight my-2 gradient-text">
                  {estimate.suggestedPriceFormatted}
                </div>
                <div className="text-xs text-text-muted">
                  Includes GST · {estimate.clientDropCount.toLocaleString()} drops
                </div>
                {estimate.aiSuggestedDropCount < estimate.clientDropCount && (
                  <div className="mt-3 pt-3 border-t border-border text-[11px] text-text-muted leading-relaxed">
                    <span className="font-semibold text-text-secondary">AI suggests</span>{' '}
                    {estimate.aiSuggestedDropCount.toLocaleString()} drops ({fmtCents(estimate.aiSuggestedPriceCents)})
                    — the polygon only contains {estimate.zoneLetterboxes.toLocaleString()} letterboxes. Re-draw
                    above to grow the zone, or proceed and we&rsquo;ll deliver what fits.
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>

        <div className="flex justify-between mt-6">
          <a href="/create/details" className="btn-ghost">← Back</a>
          <button onClick={next} disabled={!polygon || !estimate} className="btn-primary disabled:opacity-50">
            Next: Review &amp; Pay <ArrowRight size={16} />
          </button>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-border last:border-0">
      <span className={muted ? 'text-text-muted' : 'text-text-secondary'}>{label}</span>
      <strong className={bold ? 'text-base text-text-primary' : ''}>{value}</strong>
    </div>
  );
}

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min} min`;
  if (min === 0) return `${h} hr`;
  return `${h}h ${min}m`;
}

/**
 * Build a square polygon centred on `[lng, lat]` sized to contain roughly
 * `targetDrops` letterboxes, using the same AU density classification as the
 * backend estimator. Side length = sqrt(targetDrops / letterboxes-per-km²).
 */
function buildSquarePolygonAroundCentre(
  centre: [number, number],
  targetDrops: number,
): DraftPolygon {
  const [lng, lat] = centre;
  const density = classifyDensityByLat(lat);
  const km2Needed = targetDrops / density;
  // Square side length in kilometres; cap small to keep at least ~150m × 150m.
  const sideKm = Math.max(0.15, Math.sqrt(km2Needed));
  // 1° latitude ≈ 110.574 km. 1° longitude ≈ 111.320 × cos(lat) km.
  const halfDegLat = (sideKm / 2) / 110.574;
  const halfDegLng = (sideKm / 2) / (111.32 * Math.cos((lat * Math.PI) / 180));
  const minLng = lng - halfDegLng;
  const maxLng = lng + halfDegLng;
  const minLat = lat - halfDegLat;
  const maxLat = lat + halfDegLat;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  };
}

/**
 * Scale a polygon around its centroid by `factor`. Used by "Re-draw for N drops"
 * to grow/shrink the existing zone based on measured OSM density.
 */
function scalePolygon(p: DraftPolygon, factor: number): DraftPolygon {
  const bbox = polygonBbox(p);
  const cx = (bbox.minLng + bbox.maxLng) / 2;
  const cy = (bbox.minLat + bbox.maxLat) / 2;
  return {
    type: 'Polygon',
    coordinates: p.coordinates.map((ring) =>
      ring.map(([lng, lat]) => [
        cx + (lng - cx) * factor,
        cy + (lat - cy) * factor,
      ]),
    ),
  };
}

function polygonBbox(p: DraftPolygon): { minLng: number; minLat: number; maxLng: number; maxLat: number } {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const ring of p.coordinates) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLng, minLat, maxLng, maxLat };
}

/** Mirror of the backend density classifier — keep in sync with zone-estimator.ts. */
function classifyDensityByLat(lat: number): number {
  const CBDS = [-33.87, -37.81, -27.47, -28.0, -34.93, -31.95, -35.28, -42.88, -12.46];
  let nearest = Infinity;
  for (const c of CBDS) nearest = Math.min(nearest, Math.abs(lat - c));
  if (nearest < 0.03) return 3500;   // inner_city
  if (nearest < 0.15) return 1800;   // inner_suburb
  return 700;                         // suburban
}

function NoMapboxFallback({
  polygon,
  onPaste,
}: {
  polygon: DraftPolygon | null;
  onPaste: () => void;
}) {
  return (
    <div className="p-8 text-center" style={{ minHeight: 520 }}>
      <div className="text-text-muted text-sm max-w-md mx-auto mb-4">
        <strong>Mapbox map not loaded.</strong> Set{' '}
        <code className="bg-bg-muted px-1.5 py-0.5 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{' '}
        <code className="bg-bg-muted px-1.5 py-0.5 rounded">apps/web/.env.local</code> to enable the
        interactive map. For now, paste a GeoJSON polygon to continue.
      </div>
      <button onClick={onPaste} className="btn-primary">
        Paste GeoJSON polygon
      </button>
      {polygon && (
        <pre className="text-left text-[11px] bg-bg-muted p-3 rounded mt-6 max-w-2xl mx-auto overflow-auto">
          {JSON.stringify(polygon, null, 2)}
        </pre>
      )}
    </div>
  );
}
