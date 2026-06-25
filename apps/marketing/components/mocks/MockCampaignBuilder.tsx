'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Wand2, MapPin } from 'lucide-react';
import { MockFrame } from './MockFrame';

export function MockCampaignBuilder() {
  const reduce = useReducedMotion();

  return (
    <MockFrame title="app.droptrack.com.au/create/zone">
      <div className="grid md:grid-cols-[1fr_280px] h-[380px]">
        {/* Map zone drawing — light themed map */}
        <div className="relative bg-[#eef1f6] overflow-hidden">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid2" width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M 6 0 L 0 0 0 6" fill="none" stroke="rgba(11,13,18,0.04)" strokeWidth="0.3" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid2)" />
            <line x1="0" y1="40" x2="100" y2="40" stroke="rgba(11,13,18,0.08)" strokeWidth="0.5" />
            <line x1="0" y1="65" x2="100" y2="65" stroke="rgba(11,13,18,0.08)" strokeWidth="0.5" />
            <line x1="35" y1="0" x2="35" y2="100" stroke="rgba(11,13,18,0.08)" strokeWidth="0.5" />
            <line x1="65" y1="0" x2="65" y2="100" stroke="rgba(11,13,18,0.08)" strokeWidth="0.5" />

            <motion.polygon
              points="25,22 75,18 82,45 70,72 30,75 18,48"
              fill="rgba(79,70,229,0.12)"
              stroke="rgba(79,70,229,0.9)"
              strokeWidth="0.6"
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, ease: 'easeInOut' }}
            />

            {[
              [25, 22], [75, 18], [82, 45], [70, 72], [30, 75], [18, 48],
            ].map(([x, y], i) => (
              <motion.circle
                key={i}
                cx={x}
                cy={y}
                r="1.2"
                fill="white"
                stroke="rgba(79,70,229,1)"
                strokeWidth="0.4"
                initial={reduce ? false : { opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1.5 + i * 0.1, duration: 0.4 }}
              />
            ))}
          </svg>

          {/* Tool palette */}
          <div className="absolute top-4 left-4 bg-white border border-[#edeef1] shadow-sm rounded-xl p-1.5 flex gap-1">
            {['Polygon', 'Pin', 'Erase'].map((t, i) => (
              <button
                key={t}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${
                  i === 0 ? 'bg-indigo-50 text-[#4f46e5]' : 'text-[#8b92a4]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Quote panel */}
        <div className="border-t md:border-t-0 md:border-l border-[#edeef1] bg-white p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Wand2 size={14} className="text-[#4f46e5]" />
            <span className="text-[10px] uppercase tracking-[.18em] text-[#4f46e5] font-bold">
              Smart Zones
            </span>
          </div>

          <div>
            <p className="text-xs text-[#8b92a4]">Detected suburb</p>
            <p className="text-[#0b0d12] font-bold text-base flex items-center gap-1.5">
              <MapPin size={12} className="text-[#8b92a4]" /> Bondi, NSW 2026
            </p>
          </div>

          <div className="rounded-xl bg-[#f8f9fb] border border-[#edeef1] p-3 space-y-2">
            <Row k="Density score" v="Inner-suburb · 8.4" />
            <Row k="Walk route" v="6.2 km · ~7 hours" />
            <Row k="Estimated drops" v="5,000" />
            <Row k="Pace estimate" v="Walking, 12 km/h" />
          </div>

          <div
            className="rounded-xl p-4 border border-[#4f46e5]/20"
            style={{
              background:
                'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(163,230,53,0.08))',
            }}
          >
            <p className="text-[10px] uppercase tracking-[.18em] text-emerald-700 font-bold mb-1">
              AI Quote · GST incl.
            </p>
            <p className="font-display text-3xl gradient-text">$1,030.00</p>
            <p className="text-[10px] text-[#8b92a4] mt-1">Locked for 24 hours</p>
          </div>

          <button
            className="text-white text-xs px-3 py-2.5 rounded-xl font-semibold flex items-center gap-1.5 justify-center w-full"
            style={{
              background: 'linear-gradient(180deg, #5a53f0 0%, #4338ca 100%)',
              boxShadow: '0 4px 14px -2px rgba(79,70,229,.4), inset 0 1px 0 rgba(255,255,255,.15)',
            }}
          >
            Continue to checkout →
          </button>
        </div>
      </div>
    </MockFrame>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-[#8b92a4]">{k}</span>
      <span className="text-[#4b5161] font-medium">{v}</span>
    </div>
  );
}
