'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Building2, HeartPulse, Megaphone } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { cn } from '@/lib/cn';

interface Industry {
  key: 'real-estate' | 'clinics' | 'political';
  label: string;
  icon: typeof Building2;
  tagline: string;
  pain: string[];
  fit: string[];
  proof: string;
}

const INDUSTRIES: Industry[] = [
  {
    key: 'real-estate',
    label: 'Real estate',
    icon: Building2,
    tagline: 'Forward the GPS report. Win the listing.',
    pain: [
      'Vendors asking "did the flyers really go out?"',
      'Letterbox contractors with no proof of delivery',
      'Open-house drops competing with three other agencies the same weekend',
      'Reports that look the same every time — no real data',
    ],
    fit: [
      'GPS-pin report goes straight to your vendor',
      'AI picks the re-run date based on your suburb history',
      'Smart Zones quotes inner-Sydney density correctly',
      'Coverage map ready to embed in vendor reports',
    ],
    proof:
      'Built for agencies like Belle Property, Ray White and McGrath who need an auditable trail their vendors can trust.',
  },
  {
    key: 'clinics',
    label: 'Clinics & dental',
    icon: HeartPulse,
    tagline: 'Fill the appointment book without spraying and praying.',
    pain: [
      'Direct mail spend that you cannot measure',
      'Practice managers chasing the marketing agency for proof',
      'Drops landing on the wrong demographic streets',
      'No clear answer to "when do we drop again?"',
    ],
    fit: [
      'AI Smart Zones excludes apartment blocks and student housing',
      '~35-day re-run cadence baked into the recommender',
      'Reports show density-adjusted reach, not raw flyer count',
      'Subject-line and hook generators for the next drop',
    ],
    proof:
      'Designed with GP, dental and allied-health practices in mind — the same model that scales to multi-site clinic groups.',
  },
  {
    key: 'political',
    label: 'Political campaigns',
    icon: Megaphone,
    tagline: 'AEC-grade audit trail. Every door, every drop, every hour.',
    pain: [
      'Volunteer letterbox runs with no proof of coverage',
      'Allegations of streets being "missed" or "dumped"',
      'Compliance officers requesting evidence post-campaign',
      'Tight pre-election timing that needs daily reporting',
    ],
    fit: [
      'Immutable GPS trail signed at campaign close',
      'Fraud Shield catches cluster-and-bin patterns instantly',
      '~10-day campaign cadence presets',
      'Per-booth coverage breakdown matched to AEC polling locations',
    ],
    proof:
      'Built for federal, state and council campaigns that need to defend their letterbox spend to scrutineers and the press.',
  },
];

export function IndustryTabs() {
  const [active, setActive] = useState<Industry['key']>('real-estate');
  const reduce = useReducedMotion();
  const current = INDUSTRIES.find((i) => i.key === active)!;

  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {INDUSTRIES.map((it) => {
          const Icon = it.icon;
          const isActive = it.key === active;
          return (
            <button
              key={it.key}
              onClick={() => setActive(it.key)}
              className={cn(
                'flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold transition-all border',
                isActive
                  ? 'text-white border-primary/60 bg-gradient-to-br from-indigo-500/25 via-purple-500/25 to-lime-400/15 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.6)]'
                  : 'text-text-secondary border-border bg-white/[0.03] hover:bg-white/[0.06] hover:border-border-strong',
              )}
              aria-pressed={isActive}
            >
              <Icon size={16} />
              {it.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.key}
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -16 }}
          transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <GlassCard className="md:p-10">
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-xs uppercase tracking-[.22em] text-primary font-bold">
                {current.label}
              </p>
              <h3 className="font-display text-3xl md:text-5xl text-white mt-3 tracking-tight">
                {current.tagline}
              </h3>
              <p className="mt-5 text-text-secondary text-sm md:text-base">{current.proof}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-5 mt-10">
              <div className="rounded-2xl border border-border-subtle p-6 bg-white/[0.02]">
                <p className="text-xs uppercase tracking-[.18em] text-text-muted font-bold mb-3">
                  The pain we hear
                </p>
                <ul className="space-y-3">
                  {current.pain.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-text-secondary text-sm">
                      <span className="mt-1.5 size-1.5 rounded-full bg-red-400 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className="rounded-2xl p-6 border"
                style={{
                  borderColor: 'rgba(129,140,248,0.30)',
                  background:
                    'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.06), rgba(163,230,53,0.04))',
                }}
              >
                <p className="text-xs uppercase tracking-[.18em] text-primary font-bold mb-3">
                  Why DropTrack fits
                </p>
                <ul className="space-y-3">
                  {current.fit.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-text-secondary text-sm">
                      <span className="mt-1.5 size-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_2px_rgba(163,230,53,0.5)] shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
