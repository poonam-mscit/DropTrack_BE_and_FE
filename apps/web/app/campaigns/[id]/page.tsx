'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileDown,
  FileText,
  Loader2,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { api, type ApiJob } from '@/lib/api';
import { getSession } from '@/lib/auth';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface MapData {
  zone: { polygon: { type: 'Polygon'; coordinates: number[][][] }; areaSqm: number; estimatedLetterboxes: number | null } | null;
  subZones: Array<{ id: string; label: string; targetLeaflets: number; dropperUserId: string | null; polygon: { type: 'Polygon'; coordinates: number[][][] } | null }>;
  drops: Array<{ id: string; assignmentId: string; dropperUserId: string; lat: number; lng: number; insideZone: boolean; markedAt: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  paid_unassigned: 'Paid — awaiting droppers',
  assigned: 'Droppers assigned',
  upcoming: 'Upcoming',
  active: 'Live now',
  completed: 'Campaign complete',
  cancelled: 'Cancelled',
};

export default function CampaignDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const mapRef = useRef<HTMLDivElement>(null);
  const [job, setJob] = useState<ApiJob | null>(null);
  const [map, setMap] = useState<MapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [j, m] = await Promise.all([
        api.get<{ data?: ApiJob } | ApiJob>(`/api/jobs/${id}`),
        api.get<MapData>(`/api/jobs/${id}/map`).catch(() => null),
      ]);
      const next = (j as { data?: ApiJob }).data ?? (j as ApiJob);
      setJob(next);
      setMap(m);
      if (next.status === 'draft') {
        // Drafts edit, not view.
        router.replace(`/campaigns/${next.id}/edit`);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id, router]);

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }
    void load();
  }, [router, load]);

  // ── Mapbox render ────────────────────────────────────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapRef.current || !map?.zone?.polygon) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const mapboxMap = new mapboxgl.Map({
        container: mapRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: centroid(map.zone!.polygon.coordinates[0]),
        zoom: 14,
      });
      mapboxMap.on('load', () => {
        // Zone polygon
        mapboxMap.addSource('zone', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: map.zone!.polygon },
        });
        mapboxMap.addLayer({
          id: 'zone-fill',
          type: 'fill',
          source: 'zone',
          paint: { 'fill-color': '#7C3AED', 'fill-opacity': 0.12 },
        });
        mapboxMap.addLayer({
          id: 'zone-line',
          type: 'line',
          source: 'zone',
          paint: { 'line-color': '#7C3AED', 'line-width': 2 },
        });

        // Drops
        if (map.drops.length) {
          mapboxMap.addSource('drops', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: map.drops.map((d) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
                properties: { id: d.id, inside: d.insideZone },
              })),
            },
          });
          mapboxMap.addLayer({
            id: 'drops-circle',
            type: 'circle',
            source: 'drops',
            paint: {
              'circle-radius': 4,
              'circle-color': ['case', ['get', 'inside'], '#10B981', '#EF4444'],
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 1,
            },
          });
        }

        // Fit to polygon bbox
        const bbox = polygonBbox(map.zone!.polygon.coordinates[0]);
        mapboxMap.fitBounds(
          [
            [bbox.minLng, bbox.minLat],
            [bbox.maxLng, bbox.maxLat],
          ],
          { padding: 60, animate: false },
        );
      });
      cleanup = () => mapboxMap.remove();
    })();
    return () => cleanup?.();
  }, [map]);

  const stats = useMemo(() => deriveStats(job, map), [job, map]);
  const dropperSplits = useMemo(() => deriveDropperSplits(map?.drops ?? []), [map]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
        <AppSidebar active="campaigns" />
        <main className="p-10">
          <div className="max-w-md p-5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
            <p className="font-semibold mb-1">Could not load campaign</p>
            <p>{error}</p>
            <a href="/campaigns" className="btn-ghost mt-3">← Back to Campaigns</a>
          </div>
        </main>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
        <AppSidebar active="campaigns" />
        <main className="p-10 text-text-muted text-sm">
          <Loader2 size={14} className="inline animate-spin mr-2" /> Loading campaign…
        </main>
      </div>
    );
  }

  const statusLabel = STATUS_LABEL[job.status] ?? job.status;

  return (
    <div className="min-h-screen bg-[#f3f4f6] pl-[264px]">
      <AppSidebar active="campaigns" />
      <main className="p-8 lg:p-10 max-w-[1200px]">
        <a href="/campaigns" className="text-sm text-text-muted inline-flex items-center gap-1.5 hover:text-text-primary">
          <ArrowLeft size={14} /> Back to campaigns
        </a>

        {/* ── Hero ── */}
        <section
          className="mt-3 rounded-[28px] p-9 text-white relative overflow-hidden shadow-[0_30px_60px_-20px_rgba(15,16,41,.45)]"
          style={{
            background:
              'radial-gradient(800px circle at 100% 0%, rgba(124,58,237,.45), transparent 50%), radial-gradient(700px circle at 0% 100%, rgba(163,230,53,.2), transparent 55%), linear-gradient(160deg, #1A1B36 0%, #0F1029 100%)',
          }}
        >
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-lime-400">
            <span className="w-2 h-2 rounded-full bg-lime-400 shadow-[0_0_12px_rgba(163,230,53,.8)]" />
            {statusLabel}
          </p>
          <h1 className="text-[40px] lg:text-[48px] leading-[1.05] font-bold tracking-tight my-3">
            {job.title}{' '}
            <span className="font-serif italic font-normal text-white/60">— campaign summary.</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
            <span>{(job.campaignType ?? '').replace('_', ' ')}</span>
            <span className="text-white/20">·</span>
            <span>{job.startDate} → {job.deadline}</span>
            <span className="text-white/20">·</span>
            <span>{job.jobCode}</span>
          </div>

          <div className="flex flex-wrap gap-2.5 mt-5">
            {(job.status === 'active' || job.status === 'assigned' || job.status === 'upcoming') && (
              <a href={`/campaigns/${job.id}/track`} className="pill-btn-solid">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" /> Live tracking
              </a>
            )}
            <button className="pill-btn-solid"><FileText size={14} /> Download AI Report</button>
            <button className="pill-btn-ghost"><RotateCcw size={14} /> Re-run campaign</button>
            <button className="pill-btn-ghost"><Share2 size={14} /> Share</button>
            <button className="pill-btn-ghost"><Download size={14} /> Export GPX</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-5 mt-8 pt-7 border-t border-white/10">
            <Stat label="Leaflets dropped" value={stats.dropped.toLocaleString()} sub={`of ${stats.ordered.toLocaleString()} ordered`} />
            <Stat label="Coverage" value={`${stats.coverage}%`} green sub={`target was ${stats.target}%`} />
            <Stat label="Distance walked" value={`${stats.distanceKm} km`} sub="combined across droppers" />
            <Stat label="Time on the ground" value={stats.timeLabel} sub={stats.dateRange} />
            <Stat label="Houses reached" value={stats.housesReached.toLocaleString()} sub={`${stats.skipped} skipped`} />
          </div>
        </section>

        {/* ── Map card ── */}
        <section className="bg-white border border-border rounded-[24px] shadow-[0_2px_6px_rgba(11,13,18,.04)] my-4 overflow-hidden">
          <div className="flex justify-between items-center px-5 py-4 border-b border-border">
            <h3 className="font-bold text-base">Walked route &amp; drops</h3>
            <div className="flex gap-0.5 bg-bg-muted rounded-xl p-1">
              <SegBtn label="Routes" active />
              <SegBtn label="Heatmap" />
              <SegBtn label="Drops only" />
            </div>
          </div>
          {map?.zone?.polygon ? (
            <div ref={mapRef} className="h-[460px] relative">
              <div className="absolute top-4 right-4 bg-white px-4 py-3 rounded-2xl shadow-md flex gap-5 text-xs z-10">
                <PipStat label="Drops" value={stats.dropped.toLocaleString()} />
                <PipStat label="Coverage" value={`${stats.coverage}%`} valueClass="text-emerald-600" />
                <PipStat label="Distance" value={`${stats.distanceKm} km`} />
              </div>
            </div>
          ) : (
            <div className="h-[460px] flex items-center justify-center text-text-muted text-sm">
              No zone polygon for this campaign.
            </div>
          )}
        </section>

        {/* ── AI Report ── */}
        <section
          className="rounded-[24px] p-7 mb-3.5 border relative overflow-hidden grid lg:grid-cols-[1fr_240px] gap-7 items-center"
          style={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FAFBFF 100%)',
            borderColor: 'rgba(124,58,237,.18)',
          }}
        >
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-primary mb-2">
              <span className="w-6 h-6 rounded-md flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED 50%,#A3E635)' }}>
                <Sparkles size={13} />
              </span>
              AI Campaign Report
            </p>
            <h2 className="text-[22px] font-bold tracking-tight mb-3">
              {job.status === 'completed' ? '"A strong run — here\'s the breakdown."' : '"Your campaign is in progress — full report on completion."'}
            </h2>
            <p className="text-sm leading-relaxed text-text-secondary mb-4 max-w-[640px]">
              {job.status === 'completed' ? (
                <>
                  Delivered <strong>{stats.dropped.toLocaleString()} leaflets across {stats.housesReached.toLocaleString()} homes</strong>.
                  Droppers walked <strong>{stats.distanceKm} km</strong> at a steady{' '}
                  <strong>{stats.pacePerHour}</strong> drops/hour. {stats.skipped} houses were skipped (No Junk Mail / locked) — exactly what you&rsquo;d want.
                </>
              ) : (
                <>
                  This campaign is currently <strong>{statusLabel.toLowerCase()}</strong>. The AI Campaign Report
                  unlocks once droppers complete their assignments — you&rsquo;ll get a PDF breakdown of coverage,
                  pace, fraud-shield audit and recommendations for next time.
                </>
              )}
            </p>
            <div className="flex gap-2.5">
              <button className="btn-primary text-sm" disabled={job.status !== 'completed'}>
                <FileDown size={14} /> Download full PDF
              </button>
              <button className="btn-ghost text-sm">
                <Share2 size={14} /> Share with my team
              </button>
            </div>
          </div>
          <div className="bg-white border border-border rounded-2xl p-4 text-center">
            <div className="w-14 h-[70px] mx-auto mb-3 rounded-lg border border-border flex items-center justify-center bg-gradient-to-b from-white to-slate-50 text-red-500 font-bold text-[9px]">PDF</div>
            <p className="text-xs font-semibold">{job.jobCode}-report.pdf</p>
            <p className="text-[11px] text-text-muted mt-0.5">
              {job.status === 'completed' ? 'Ready to download' : 'Available on completion'}
            </p>
          </div>
        </section>

        {/* ── Grid: Top streets · Dropper splits ── */}
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-3.5 mb-3.5">
          <Panel title="Top streets by coverage" link="All streets →">
            {map?.drops?.length ? (
              <p className="text-sm text-text-muted py-4">Street-level breakdown unlocks once GPS drops are reverse-geocoded — coming soon.</p>
            ) : (
              <p className="text-sm text-text-muted py-4">No drops yet — street breakdown will appear once droppers start.</p>
            )}
          </Panel>

          <Panel title="Dropper splits" link="View profiles →">
            {dropperSplits.length === 0 ? (
              <p className="text-sm text-text-muted py-4">No dropper activity yet.</p>
            ) : (
              <div>
                {dropperSplits.map((s, i) => (
                  <div key={s.dropperUserId} className={`py-3 grid grid-cols-[40px_1fr_auto] gap-3.5 items-center ${i > 0 ? 'border-t border-border' : ''}`}>
                    <div className="w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-xs" style={{ background: i === 0 ? '#4F46E5' : '#10B981' }}>
                      {s.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{s.label}</p>
                      <p className="text-xs text-text-muted mt-0.5">{s.dropCount.toLocaleString()} drops</p>
                    </div>
                    <span className="text-xs font-semibold text-text-secondary">{s.pctLabel}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* ── Coverage breakdown · Fraud Shield ── */}
        <div className="grid lg:grid-cols-2 gap-3.5 mb-3.5">
          <Panel title="Coverage breakdown">
            <div className="grid grid-cols-2 gap-3.5">
              <BreakdownCell label="Houses" value={stats.housesReached.toLocaleString()} pct={stats.coverage} sub={`${stats.coverage}% covered`} />
              <BreakdownCell label="Apartments" value={'—'} pct={0} sub="Available once GNAF lands" />
              <BreakdownCell label="Walking distance" value={`${stats.distanceKm} km`} pct={100} sub="Combined across droppers" />
              <BreakdownCell label="Elapsed" value={stats.timeLabel} pct={stats.coverage > 0 ? Math.min(100, stats.coverage + 4) : 0} sub={stats.dateRange} />
            </div>
          </Panel>

          <Panel title="Fraud Shield audit">
            <div className="flex items-center gap-3.5 mb-3.5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-900" style={{ background: 'linear-gradient(135deg,#A3E635,#10B981)' }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="font-bold text-base">
                  {stats.dropped > 0 ? `All ${stats.dropped.toLocaleString()} drops verified` : 'Awaiting drops'}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {stats.dropped > 0 ? '100% GPS integrity · 0 anomalies' : 'Fraud Shield runs in real time once droppers begin.'}
                </p>
              </div>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              {stats.dropped > 0
                ? 'No spoofing detected. AI reviewed every drop in real time. Audit trail will be attached to the final PDF report.'
                : 'AI monitors every drop for mock-location, impossible-speed and cluster-density anomalies. Cleared drops are auto-passed; flagged ones go to your inbox.'}
            </p>
          </Panel>
        </div>
      </main>
    </div>
  );
}

// ─── small bits ───

function Stat({ label, value, sub, green }: { label: string; value: string; sub?: string; green?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-white/55 uppercase tracking-[.08em] font-semibold">{label}</p>
      <p className={`text-[36px] font-bold tracking-tight mt-1 leading-none ${green ? 'text-lime-400' : ''}`}>{value}</p>
      {sub && <p className="text-xs text-white/45 mt-1.5">{sub}</p>}
    </div>
  );
}

function SegBtn({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={`px-3 py-1.5 rounded-md text-xs font-semibold ${active ? 'bg-white shadow text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
    >
      {label}
    </button>
  );
}

function PipStat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-[10px] text-text-muted uppercase tracking-[.06em] font-semibold">{label}</p>
      <p className={`text-base font-bold tracking-tight mt-0.5 tabular-nums ${valueClass ?? ''}`}>{value}</p>
    </div>
  );
}

function Panel({ title, link, children }: { title: string; link?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-border rounded-2xl shadow-[0_2px_6px_rgba(11,13,18,.04)] p-5 lg:p-6">
      <div className="flex justify-between items-baseline mb-3.5">
        <h3 className="font-bold text-base">{title}</h3>
        {link && <a href="#" className="text-xs text-text-muted hover:text-text-primary">{link}</a>}
      </div>
      {children}
    </section>
  );
}

function BreakdownCell({ label, value, pct, sub }: { label: string; value: string; pct: number; sub: string }) {
  return (
    <div className="p-4 border border-border rounded-xl bg-[#FAFBFF]">
      <div className="flex justify-between text-xs text-text-muted mb-1">
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight leading-none">{value}</p>
      <div className="h-1.5 bg-bg-muted rounded-full overflow-hidden mt-2">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#4F46E5,#A3E635)' }} />
      </div>
      <p className="text-xs text-text-muted mt-1.5">{sub}</p>
    </div>
  );
}

// ─── derivations ───

interface Stats {
  ordered: number;
  dropped: number;
  coverage: number;
  target: number;
  distanceKm: number;
  timeLabel: string;
  dateRange: string;
  housesReached: number;
  skipped: number;
  pacePerHour: number;
}
function deriveStats(job: ApiJob | null, map: MapData | null): Stats {
  const ordered = job?.leafletCount ?? 0;
  const dropped = map?.drops?.length ?? 0;
  const coverage = ordered > 0 ? Math.min(100, Math.round((dropped / ordered) * 100)) : 0;
  const housesReached = dropped;
  const skipped = Math.max(0, dropped - housesReached);
  return {
    ordered,
    dropped,
    coverage,
    target: 92,
    distanceKm: 0,
    timeLabel: dropped > 0 ? '—' : '0h',
    dateRange: job ? `${job.startDate} → ${job.deadline}` : '—',
    housesReached,
    skipped,
    pacePerHour: 0,
  };
}

interface DropperSplit {
  dropperUserId: string;
  label: string;
  initials: string;
  dropCount: number;
  pctLabel: string;
}
function deriveDropperSplits(drops: MapData['drops']): DropperSplit[] {
  const buckets = new Map<string, number>();
  for (const d of drops) {
    buckets.set(d.dropperUserId, (buckets.get(d.dropperUserId) ?? 0) + 1);
  }
  const total = drops.length;
  return Array.from(buckets.entries()).map(([dropperUserId, dropCount]) => ({
    dropperUserId,
    label: `Dropper ${dropperUserId.slice(0, 6)}`,
    initials: dropperUserId.slice(0, 2).toUpperCase(),
    dropCount,
    pctLabel: total > 0 ? `${Math.round((dropCount / total) * 100)}% of drops` : '0%',
  }));
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
