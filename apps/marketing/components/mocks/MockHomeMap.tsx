'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, CheckCircle2, Footprints, MapPin, Shield } from 'lucide-react';
import { MockFrame } from './MockFrame';

/**
 * Home-page hero — real Mapbox light-style tiles of Bondi with a Strava-like
 * blue dropper trail overlaid in SVG. House icons mark completed letterbox
 * drops; an animated walker icon shows the dropper's live position. Falls
 * back to a styled gradient if NEXT_PUBLIC_MAPBOX_TOKEN is not set.
 */

// Pixel coordinates inside the 720×460 map viewport — calibrated visually so
// the route weaves between blocks and "dips into" each house letterbox.
const ROUTE_D =
  'M 70 380 Q 95 350 110 340 T 150 300 Q 170 285 180 270 T 220 235 Q 240 220 255 200 T 305 175 Q 330 165 345 155 T 395 130 Q 420 115 435 100 T 490 85';

const DROPS: Array<{ x: number; y: number }> = [
  { x: 90, y: 360 },
  { x: 150, y: 300 },
  { x: 215, y: 240 },
  { x: 270, y: 195 },
  { x: 335, y: 160 },
  { x: 395, y: 130 },
];

const DROPPER = { x: 435, y: 102 };
const DESTINATION = { x: 490, y: 85 };

export function MockHomeMap() {
  const reduce = useReducedMotion();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapSrc = token ? buildMapboxUrl(token) : null;

  return (
    <MockFrame title="app.droptrack.com.au/track/J-2491">
      <div className="grid md:grid-cols-[1fr_280px] h-[460px]">
        {/* Map area */}
        <div className="relative overflow-hidden bg-[#eef1f6]">
          {mapSrc ? (
            <img
              src={mapSrc}
              alt="Live dropper tracking on a Sydney map — Bondi, NSW"
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <FallbackMap />
          )}

          {/* SVG overlay — route, drops, dropper, destination */}
          <svg
            viewBox="0 0 560 460"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {/* Soft glow underneath the route line */}
            <motion.path
              d={ROUTE_D}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.18"
              initial={reduce ? false : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2.4, ease: 'easeInOut' }}
            />
            {/* The thick blue Strava-style trail */}
            <motion.path
              d={ROUTE_D}
              fill="none"
              stroke="#2563eb"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2.4, ease: 'easeInOut' }}
            />

            {/* House icons at every completed drop */}
            {DROPS.map((d, i) => (
              <motion.g
                key={i}
                initial={reduce ? false : { opacity: 0, y: -8, scale: 0.7 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + i * 0.18, duration: 0.5 }}
              >
                <HouseIcon x={d.x} y={d.y} />
              </motion.g>
            ))}

            {/* Destination pin (Uber-style) */}
            <motion.g
              initial={reduce ? false : { opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 2.2, duration: 0.5 }}
            >
              <DestinationPin x={DESTINATION.x} y={DESTINATION.y} />
            </motion.g>
          </svg>

          {/* Animated walker (live dropper) — HTML overlay so we can use real animation */}
          <motion.div
            className="absolute"
            style={{
              left: `${(DROPPER.x / 560) * 100}%`,
              top: `${(DROPPER.y / 460) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            initial={reduce ? false : { scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.8, duration: 0.5 }}
          >
            <div className="relative">
              <motion.span
                className="absolute inset-0 -m-4 size-14 rounded-full bg-[#4f46e5]/30"
                animate={reduce ? undefined : { scale: [1, 1.5, 1], opacity: [0.55, 0, 0.55] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
              />
              <div className="relative w-9 h-9 rounded-full bg-[#4f46e5] border-[3px] border-white shadow-[0_6px_18px_rgba(79,70,229,0.55)] flex items-center justify-center">
                <Footprints size={16} className="text-white" />
              </div>
            </div>
          </motion.div>

          {/* Status pills */}
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur border border-[#edeef1] rounded-full px-3 py-1.5 flex items-center gap-2 text-xs shadow-sm">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[#0b0d12] font-semibold">Live · James Kowalski</span>
          </div>
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur border border-[#edeef1] rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs shadow-sm">
            <Shield size={12} className="text-emerald-500" />
            <span className="text-[#4b5161]">Fraud Shield · clear</span>
          </div>

          {mapSrc && (
            <p className="absolute bottom-1.5 right-2 text-[9px] text-[#0b0d12]/60 bg-white/70 backdrop-blur px-1.5 py-0.5 rounded">
              © Mapbox © OpenStreetMap
            </p>
          )}
        </div>

        {/* Side panel */}
        <div className="border-t md:border-t-0 md:border-l border-[#edeef1] bg-white p-5 flex flex-col gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[.2em] text-[#8b92a4] font-bold">
              Campaign
            </p>
            <h4 className="text-[#0b0d12] font-bold mt-1">Bondi · Open House</h4>
            <p className="text-xs text-[#8b92a4]">J-2491 · 5,000 leaflets</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat label="Drops" value="3,847" tone="emerald" />
            <Stat label="Coverage" value="77%" tone="indigo" />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-[#8b92a4] mb-1.5">
              <span>Progress</span>
              <span>77%</span>
            </div>
            <div className="h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #a3e635 100%)',
                }}
                initial={reduce ? false : { width: 0 }}
                whileInView={{ width: '77%' }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
            </div>
          </div>

          <div className="space-y-2 mt-1 border-t border-[#edeef1] pt-3">
            <Event icon={Activity} text="Letterbox · 14 Curlewis St" time="just now" />
            <Event icon={Activity} text="Letterbox · 8 Glenayr Ave" time="1m" />
            <Event icon={CheckCircle2} text="Zone A complete" time="6m" tone="emerald" />
            <Event icon={MapPin} text="Dropper started · Bondi" time="42m" />
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

// ─── Small SVG icon components rendered inside the overlay ───

function HouseIcon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x - 16},${y - 16})`}>
      {/* Drop shadow */}
      <ellipse cx="16" cy="30" rx="11" ry="2" fill="black" opacity="0.18" />
      {/* House body — white card with subtle border */}
      <rect x="4" y="14" width="24" height="14" rx="2.5" fill="white" stroke="#e5e7eb" strokeWidth="0.8" />
      {/* Roof */}
      <path d="M 2 15 L 16 4 L 30 15 Z" fill="#1f2937" />
      {/* Door */}
      <rect x="13" y="20" width="6" height="8" fill="#1f2937" rx="0.5" />
      {/* Green check badge — top right */}
      <circle cx="26" cy="13" r="5" fill="#10b981" stroke="white" strokeWidth="1.4" />
      <path d="M 23.5 13 L 25.5 15 L 28.5 11.5" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function DestinationPin({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x - 12},${y - 30})`}>
      <ellipse cx="12" cy="30" rx="8" ry="1.5" fill="black" opacity="0.2" />
      <path
        d="M12 0C5.4 0 0 5.4 0 12c0 8 12 18 12 18s12-10 12-18C24 5.4 18.6 0 12 0z"
        fill="#0b0d12"
      />
      <circle cx="12" cy="11" r="4" fill="white" />
    </g>
  );
}

// ─── Side-panel widgets ───

function Stat({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'indigo' }) {
  const color = tone === 'emerald' ? 'text-emerald-600' : 'text-[#4f46e5]';
  return (
    <div className="rounded-xl bg-[#f8f9fb] border border-[#edeef1] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#8b92a4]">{label}</p>
      <p className={`font-display text-2xl ${color} mt-0.5`}>{value}</p>
    </div>
  );
}

function Event({
  icon: Icon,
  text,
  time,
  tone,
}: {
  icon: typeof Activity;
  text: string;
  time: string;
  tone?: 'emerald';
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon
        size={12}
        className={`mt-0.5 ${tone === 'emerald' ? 'text-emerald-500' : 'text-[#8b92a4]'}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[#4b5161] truncate">{text}</p>
        <p className="text-[10px] text-[#8b92a4]">{time}</p>
      </div>
    </div>
  );
}

// ─── Mapbox URL ───

/**
 * Light Mapbox style — minimal labels, like Strava / Uber Eats — so our blue
 * trail and house icons read clearly on top. No path or pin overlays from the
 * API: we paint everything in SVG ourselves.
 */
function buildMapboxUrl(token: string): string {
  const style = 'mapbox/light-v11';
  const size = '900x500@2x';
  // Bondi residential streets — zoomed in tight so blocks are visible.
  const center = '151.2762,-33.8908,16.4,0';
  return `https://api.mapbox.com/styles/v1/${style}/static/${center}/${size}?access_token=${token}`;
}

// ─── Fallback (no token) ───

function FallbackMap() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(900px circle at 30% 40%, rgba(79,70,229,0.10), transparent 60%), radial-gradient(700px circle at 80% 70%, rgba(163,230,53,0.10), transparent 60%), #eef1f6',
        }}
      />
      <div className="relative z-10 text-center px-6 max-w-sm">
        <p className="text-[11px] uppercase tracking-[.18em] text-[#8b92a4] font-bold">
          Mapbox preview
        </p>
        <p className="text-sm text-[#4b5161] mt-2">
          Set <code className="px-1.5 py-0.5 rounded bg-white border border-[#edeef1] text-[#0b0d12] text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code className="px-1.5 py-0.5 rounded bg-white border border-[#edeef1] text-[#0b0d12] text-xs">.env.local</code> to render the real Bondi map.
        </p>
      </div>
    </div>
  );
}
