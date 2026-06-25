'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { MockFrame } from './MockFrame';

const BRIEF = `Need 6,000 flyers around Surry Hills before our auction on Sat 8 June. Two-bed terrace at 47 Bourke St. Print is at the agency. Tenants are mostly young pros — keep it premium.`;

const FIELDS = [
  ['Suburb', 'Surry Hills, NSW 2010'],
  ['Campaign type', 'Real estate · Auction'],
  ['Leaflet count', '6,000'],
  ['Deadline', '7 Jun 2026 (1 day before)'],
  ['Audience', 'Young professionals'],
  ['Tone', 'Premium, low-key, no urgency'],
];

export function MockJobCreator() {
  const reduce = useReducedMotion();

  return (
    <MockFrame title="app.droptrack.com.au/create/ai">
      <div className="grid md:grid-cols-2 h-[420px]">
        {/* Brief input */}
        <div className="p-5 bg-white border-r border-[#edeef1] flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-[#4f46e5]" />
            <span className="text-[10px] uppercase tracking-[.18em] text-[#4f46e5] font-bold">
              AI Job Creator
            </span>
          </div>
          <h3 className="font-display text-2xl text-[#0b0d12] tracking-tight mb-1">
            Paste your brief
          </h3>
          <p className="text-xs text-[#8b92a4] mb-4">
            Email, voice memo transcript, scribbled notes — anything goes.
          </p>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex-1 rounded-xl bg-[#f8f9fb] border border-[#edeef1] p-4 text-xs text-[#4b5161] leading-relaxed font-mono"
          >
            <TypewriterText text={BRIEF} />
          </motion.div>

          <button
            className="mt-3 text-white text-xs px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 justify-center"
            style={{
              background: 'linear-gradient(180deg, #5a53f0 0%, #4338ca 100%)',
              boxShadow: '0 4px 14px -2px rgba(79,70,229,.4), inset 0 1px 0 rgba(255,255,255,.15)',
            }}
          >
            <Sparkles size={12} /> Extract with AI
          </button>
        </div>

        {/* Extracted fields */}
        <div className="p-5 bg-[#f8f9fb] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[.18em] text-emerald-600 font-bold">
                Extracted · 1.4s
              </p>
              <h4 className="text-[#0b0d12] font-bold mt-0.5 text-sm">Campaign draft</h4>
            </div>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>

          <div className="flex-1 space-y-2.5 overflow-hidden">
            {FIELDS.map(([k, v], i) => (
              <motion.div
                key={k}
                initial={reduce ? false : { opacity: 0, x: 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 + i * 0.12, duration: 0.4 }}
                className="rounded-xl bg-white border border-[#edeef1] p-2.5 shadow-[0_2px_6px_rgba(11,13,18,.04)]"
              >
                <p className="text-[9px] uppercase tracking-wider text-[#8b92a4]">{k}</p>
                <p className="text-xs text-[#0b0d12] font-medium mt-0.5">{v}</p>
              </motion.div>
            ))}
          </div>

          <motion.button
            initial={reduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 2, duration: 0.5 }}
            className="mt-3 text-white text-xs px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 justify-center"
            style={{
              background: 'linear-gradient(180deg, #5a53f0 0%, #4338ca 100%)',
              boxShadow: '0 4px 14px -2px rgba(79,70,229,.4), inset 0 1px 0 rgba(255,255,255,.15)',
            }}
          >
            Continue to zone <ArrowRight size={12} />
          </motion.button>
        </div>
      </div>
    </MockFrame>
  );
}

function TypewriterText({ text }: { text: string }) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      {text}
      <motion.span
        className="inline-block w-1.5 h-3 bg-[#4f46e5] ml-0.5 align-middle"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </motion.span>
  );
}
