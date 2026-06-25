'use client';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: ReactNode;
  intro: ReactNode;
  cta?: ReactNode;
}

export function PageHero({ eyebrow, title, intro, cta }: Props) {
  const reduce = useReducedMotion();
  return (
    <section className="mx-auto max-w-[1100px] px-5 pt-12 pb-20 md:pt-20 md:pb-28 text-center">
      {eyebrow && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide text-text-secondary glass mb-7"
        >
          <span className="size-1.5 rounded-full bg-lime-400 shadow-[0_0_10px_2px_rgba(163,230,53,0.6)]" />
          {eyebrow}
        </motion.div>
      )}
      <motion.h1
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.05 }}
        className="font-display text-5xl md:text-7xl leading-[1.02] text-white tracking-tight"
      >
        {title}
      </motion.h1>
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="mt-6 text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
      >
        {intro}
      </motion.p>
      {cta && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-9 flex flex-wrap gap-3 justify-center"
        >
          {cta}
        </motion.div>
      )}
    </section>
  );
}
