'use client';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Five compact "blueprint" wireframes — one per how-it-works step.
 * Intentionally simpler than the full app mocks: monochrome glass surface,
 * indigo accent, structural rather than pixel-perfect. Designed to read
 * fast at a glance next to the step description.
 */

const stroke = 'rgba(129,140,248,0.85)';
const dim = 'rgba(255,255,255,0.10)';
const dim2 = 'rgba(255,255,255,0.05)';
const accent = '#a3e635';

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="glass rounded-2xl p-4 md:p-5 relative overflow-hidden">
      <p className="text-[9px] uppercase tracking-[.22em] text-text-muted font-bold mb-3">
        {label}
      </p>
      <div className="aspect-[3/2] w-full">{children}</div>
    </div>
  );
}

// ─── 1. Draw zone ───
export function WireframeDrawZone() {
  const reduce = useReducedMotion();
  return (
    <Frame label="Wireframe · campaign builder">
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Map grid */}
        <defs>
          <pattern id="w1grid" width="14" height="14" patternUnits="userSpaceOnUse">
            <path d="M 14 0 L 0 0 0 14" fill="none" stroke={dim2} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="300" height="200" fill="url(#w1grid)" />
        <line x1="0" y1="80" x2="300" y2="80" stroke={dim} strokeWidth="0.8" />
        <line x1="0" y1="140" x2="300" y2="140" stroke={dim} strokeWidth="0.8" />
        <line x1="90" y1="0" x2="90" y2="200" stroke={dim} strokeWidth="0.8" />
        <line x1="180" y1="0" x2="180" y2="200" stroke={dim} strokeWidth="0.8" />

        {/* Animated polygon being drawn */}
        <motion.polygon
          points="60,40 230,30 250,100 200,160 90,170 50,110"
          fill="rgba(129,140,248,0.14)"
          stroke={stroke}
          strokeWidth="1.6"
          initial={reduce ? false : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.8, ease: 'easeInOut' }}
        />

        {/* Vertex handles */}
        {[[60, 40], [230, 30], [250, 100], [200, 160], [90, 170], [50, 110]].map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r="3.5"
            fill="white"
            stroke={stroke}
            strokeWidth="1.4"
            initial={reduce ? false : { scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.5 + i * 0.08, duration: 0.3 }}
          />
        ))}

        {/* Quote chip */}
        <g>
          <rect x="174" y="174" width="118" height="20" rx="6" fill="rgba(163,230,53,0.18)" stroke={accent} strokeWidth="0.6" />
          <text x="233" y="188" textAnchor="middle" fill={accent} fontSize="10" fontWeight="700" fontFamily="ui-sans-serif">
            AI quote · $1,030
          </text>
        </g>
      </svg>
    </Frame>
  );
}

// ─── 2. Confirm + pay ───
export function WireframePay() {
  return (
    <Frame label="Wireframe · Stripe checkout">
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Receipt card */}
        <rect x="20" y="20" width="260" height="160" rx="12" fill="rgba(255,255,255,0.04)" stroke={dim} />

        {/* Summary lines */}
        <rect x="40" y="38" width="120" height="9" rx="2" fill={dim} />
        <rect x="40" y="56" width="80" height="6" rx="2" fill={dim2} />

        <line x1="40" y1="78" x2="260" y2="78" stroke={dim2} />

        {/* Line items */}
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x="40" y={88 + i * 14} width={130 - i * 14} height="6" rx="2" fill={dim} />
            <rect x={240 - i * 6} y={88 + i * 14} width={20 + i * 6} height="6" rx="2" fill={dim} />
          </g>
        ))}

        <line x1="40" y1="134" x2="260" y2="134" stroke={dim2} />

        {/* Total */}
        <rect x="40" y="142" width="50" height="8" rx="2" fill="white" opacity="0.5" />
        <rect x="200" y="140" width="60" height="12" rx="3" fill={accent} opacity="0.95" />

        {/* Pay button */}
        <motion.rect
          x="40"
          y="158"
          width="220"
          height="18"
          rx="6"
          fill={stroke}
          initial={{ scaleX: 0.4, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{ transformOrigin: '40px 0' }}
        />
        <text x="150" y="171" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="ui-sans-serif">
          Pay securely with Stripe
        </text>
      </svg>
    </Frame>
  );
}

// ─── 3. Assignment ───
export function WireframeAssignment() {
  const reduce = useReducedMotion();
  return (
    <Frame label="Wireframe · dispatcher">
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Job card on the left */}
        <rect x="20" y="40" width="100" height="120" rx="10" fill="rgba(255,255,255,0.04)" stroke={dim} />
        <rect x="32" y="54" width="60" height="6" rx="2" fill={dim} />
        <rect x="32" y="68" width="40" height="5" rx="2" fill={dim2} />
        <rect x="32" y="84" width="76" height="34" rx="6" fill="rgba(129,140,248,0.18)" stroke={stroke} strokeWidth="0.8" />
        <text x="70" y="105" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">J-2491</text>
        <rect x="32" y="130" width="76" height="6" rx="2" fill={dim2} />
        <rect x="32" y="142" width="50" height="6" rx="2" fill={dim2} />

        {/* Arrow */}
        <motion.path
          d="M 130 100 L 175 100"
          stroke={stroke}
          strokeWidth="1.6"
          fill="none"
          strokeDasharray="3,3"
          initial={reduce ? false : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.4 }}
        />
        <polygon points="170,95 180,100 170,105" fill={stroke} />

        {/* Dropper card on the right */}
        <rect x="190" y="30" width="92" height="140" rx="10" fill="rgba(255,255,255,0.04)" stroke={dim} />
        <circle cx="236" cy="64" r="18" fill="rgba(129,140,248,0.25)" stroke={stroke} />
        <text x="236" y="69" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">JK</text>
        <rect x="206" y="94" width="60" height="6" rx="2" fill={dim} />
        <rect x="206" y="106" width="40" height="5" rx="2" fill={dim2} />

        {/* Stat row */}
        <rect x="206" y="122" width="28" height="36" rx="5" fill={dim2} />
        <text x="220" y="138" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">4.9</text>
        <text x="220" y="150" textAnchor="middle" fill="rgba(255,255,255,.5)" fontSize="6">score</text>

        <rect x="240" y="122" width="28" height="36" rx="5" fill={dim2} />
        <text x="254" y="138" textAnchor="middle" fill={accent} fontSize="9" fontWeight="700">bike</text>
        <text x="254" y="150" textAnchor="middle" fill="rgba(255,255,255,.5)" fontSize="6">transport</text>
      </svg>
    </Frame>
  );
}

// ─── 4. GPS pins ───
export function WireframeGPS() {
  const reduce = useReducedMotion();
  const pins = [
    [60, 60], [90, 80], [120, 70], [150, 95], [180, 80],
    [200, 110], [170, 140], [130, 130], [95, 150], [70, 120],
  ];
  return (
    <Frame label="Wireframe · live tracking">
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Map grid */}
        <defs>
          <pattern id="w4grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke={dim2} strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="300" height="200" fill="url(#w4grid)" />
        <line x1="0" y1="100" x2="300" y2="100" stroke={dim} strokeWidth="0.6" />
        <line x1="150" y1="0" x2="150" y2="200" stroke={dim} strokeWidth="0.6" />

        {/* Polygon */}
        <polygon
          points="40,40 230,30 250,120 200,170 60,160"
          fill="rgba(129,140,248,0.08)"
          stroke={stroke}
          strokeWidth="0.8"
          strokeDasharray="2,2"
        />

        {/* Route path */}
        <motion.polyline
          points="60,60 90,80 120,70 150,95 180,80 200,110 170,140 130,130 95,150 70,120"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.8, ease: 'easeInOut' }}
        />

        {/* GPS pins */}
        {pins.map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r="3.2"
            fill={accent}
            stroke="white"
            strokeWidth="1"
            initial={reduce ? false : { scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.1, duration: 0.4 }}
          />
        ))}

        {/* Live dropper */}
        <motion.circle
          cx="200"
          cy="110"
          r="6"
          fill={stroke}
          stroke="white"
          strokeWidth="1.6"
          animate={reduce ? undefined : { r: [6, 9, 6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </svg>
    </Frame>
  );
}

// ─── 5. Report ───
export function WireframeReport() {
  return (
    <Frame label="Wireframe · AI report">
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Doc */}
        <rect x="36" y="14" width="228" height="172" rx="8" fill="rgba(255,255,255,0.04)" stroke={dim} />

        {/* Header band */}
        <rect x="36" y="14" width="228" height="34" rx="8" fill="rgba(129,140,248,0.10)" />
        <rect x="50" y="26" width="80" height="6" rx="2" fill="white" opacity="0.65" />
        <rect x="50" y="36" width="50" height="4" rx="2" fill={dim} />
        <rect x="232" y="22" width="20" height="20" rx="4" fill={stroke} opacity="0.7" />

        {/* Stat tiles */}
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={48 + i * 52} y="58" width="44" height="34" rx="5" fill={dim2} stroke={dim} strokeWidth="0.4" />
            <rect x={54 + i * 52} y="66" width="22" height="6" rx="2" fill="white" opacity="0.8" />
            <rect x={54 + i * 52} y="78" width="14" height="4" rx="2" fill={dim} />
          </g>
        ))}

        {/* Bar chart */}
        <g>
          {[18, 26, 14, 28, 20, 22, 16, 26, 19].map((h, i) => (
            <motion.rect
              key={i}
              x={50 + i * 23}
              y={150 - h}
              width="16"
              height={h}
              rx="2"
              fill={accent}
              initial={{ height: 0, y: 150 }}
              whileInView={{ height: h, y: 150 - h }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }}
            />
          ))}
        </g>
        <rect x="50" y="155" width="200" height="1" fill={dim} />

        {/* Footer pill */}
        <rect x="50" y="163" width="200" height="14" rx="6" fill="rgba(163,230,53,0.18)" stroke={accent} strokeWidth="0.5" />
        <text x="150" y="173" textAnchor="middle" fill={accent} fontSize="8" fontWeight="700" fontFamily="ui-sans-serif">
          AI insight · re-run 3 June 2026
        </text>
      </svg>
    </Frame>
  );
}
