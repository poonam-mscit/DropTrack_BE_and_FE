'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';

export interface FaqItem {
  q: string;
  a: string;
}

interface Props {
  items: FaqItem[];
  /** When provided, the parent renders the FAQPage JSON-LD via this id-key. */
  schemaName?: string;
}

/**
 * Accessible accordion FAQ — built for AEO (Answer Engine Optimization).
 * Pair with <FaqJsonLd> in the page to emit FAQPage schema.
 */
export function Faq({ items }: Props) {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();
  return (
    <div className="grid gap-3 max-w-3xl mx-auto">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <Reveal key={it.q} delay={i * 0.04}>
            <GlassCard className="p-0 overflow-hidden" glow={false}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full flex items-start justify-between gap-4 text-left p-5 md:p-6"
              >
                <span className="font-semibold text-white text-base md:text-[17px]">{it.q}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 mt-1 text-text-muted transition-transform ${
                    isOpen ? 'rotate-180 text-primary' : ''
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reduce ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 md:px-6 pb-6 text-text-secondary leading-relaxed text-sm md:text-base">
                      {it.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          </Reveal>
        );
      })}
    </div>
  );
}

export function FaqJsonLd({ items }: { items: FaqItem[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
