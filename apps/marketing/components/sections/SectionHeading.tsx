import type { ReactNode } from 'react';
import { Reveal } from '@/components/ui/Reveal';

interface Props {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: 'left' | 'center';
}

export function SectionHeading({ eyebrow, title, intro, align = 'center' }: Props) {
  const al = align === 'center' ? 'text-center mx-auto' : 'text-left';
  return (
    <div className={`max-w-3xl ${al} mb-12 md:mb-16`}>
      {eyebrow && (
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[.22em] text-primary mb-3">
            {eyebrow}
          </p>
        </Reveal>
      )}
      <Reveal delay={0.05}>
        <h2 className="font-display text-4xl md:text-5xl text-white tracking-tight leading-[1.05]">
          {title}
        </h2>
      </Reveal>
      {intro && (
        <Reveal delay={0.1}>
          <p className="mt-4 text-text-secondary text-base md:text-lg leading-relaxed">
            {intro}
          </p>
        </Reveal>
      )}
    </div>
  );
}
