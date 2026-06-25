'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Download, FileText } from 'lucide-react';
import { MockFrame } from './MockFrame';

export function MockAIReport() {
  const reduce = useReducedMotion();
  const bars = [62, 78, 55, 90, 72, 84, 68, 95, 80];

  return (
    <MockFrame title="app.droptrack.com.au/track/J-2491/report">
      <div className="p-7 md:p-9 bg-white">
        <div className="flex items-start justify-between gap-4 mb-7">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#a3e635)' }}
              >
                <Sparkles size={14} className="text-white" />
              </div>
              <span className="text-xs font-bold uppercase tracking-[.18em] text-[#4f46e5]">
                AI Campaign Report
              </span>
            </div>
            <h3 className="font-display text-3xl text-[#0b0d12] tracking-tight">
              Bondi · Open House
            </h3>
            <p className="text-xs text-[#8b92a4] mt-1">J-2491 · Generated 14 May 2026, 4:38 PM AEST</p>
          </div>
          <button className="text-xs px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 bg-white border border-[#edeef1] text-[#0b0d12] hover:bg-[#f3f4f6]">
            <Download size={12} /> PDF
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            ['5,000', 'Leaflets'],
            ['98.4%', 'Coverage'],
            ['0', 'Fraud flags'],
            ['7h 12m', 'Total time'],
          ].map(([n, l], i) => (
            <motion.div
              key={l}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * i, duration: 0.5 }}
              className="rounded-xl bg-[#f8f9fb] border border-[#edeef1] p-3"
            >
              <p className="font-display text-2xl gradient-text">{n}</p>
              <p className="text-[10px] text-[#8b92a4] uppercase tracking-wider mt-0.5">{l}</p>
            </motion.div>
          ))}
        </div>

        <div className="rounded-xl bg-[#f8f9fb] border border-[#edeef1] p-4 mb-5">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-bold text-[#0b0d12]">Drops per hour</p>
            <p className="text-[10px] text-[#8b92a4]">9 AM – 6 PM</p>
          </div>
          <div className="flex items-end gap-2 h-24">
            {bars.map((h, i) => (
              <motion.div
                key={i}
                initial={reduce ? false : { height: 0 }}
                whileInView={{ height: `${h}%` }}
                viewport={{ once: true }}
                transition={{ delay: 0.06 * i, duration: 0.6, ease: 'easeOut' }}
                className="flex-1 rounded-t-md"
                style={{
                  background: 'linear-gradient(180deg, #a3e635 0%, #4f46e5 100%)',
                }}
              />
            ))}
          </div>
        </div>

        <div
          className="rounded-xl p-4 border border-[#4f46e5]/20"
          style={{
            background: 'linear-gradient(135deg, rgba(79,70,229,0.05), rgba(163,230,53,0.05))',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <FileText size={12} className="text-[#4f46e5]" />
            <span className="text-[10px] uppercase tracking-[.18em] text-[#4f46e5] font-bold">
              Executive insight · Claude via AWS Bedrock
            </span>
          </div>
          <p className="text-[#4b5161] text-sm leading-relaxed">
            Coverage hit 98.4% — a strong result for an inner-Sydney suburb in autumn. Drop pace
            peaked at 1 PM (matching the recommended midday window for open houses) and Fraud
            Shield raised zero flags. Suggested re-run date:{' '}
            <span className="text-emerald-700 font-semibold">3 June 2026</span> — 20 days out, the
            band where Bondi typically responds.
          </p>
        </div>
      </div>
    </MockFrame>
  );
}
