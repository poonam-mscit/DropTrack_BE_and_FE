import type { ReactNode } from 'react';
import { Reveal } from '@/components/ui/Reveal';

interface Props {
  title: string;
  lastUpdated: string;
  intro: ReactNode;
  children: ReactNode;
}

/** Long-form legal page shell — tight typography, anchor-friendly headings. */
export function LegalLayout({ title, lastUpdated, intro, children }: Props) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-8 md:py-12 prose-invert">
      <Reveal>
        <p className="text-xs uppercase tracking-[.22em] text-primary font-bold mb-3">Legal</p>
        <h1 className="font-display text-4xl md:text-6xl text-white tracking-tight leading-[1.05]">
          {title}
        </h1>
        <p className="text-xs text-text-muted mt-3">Last updated: {lastUpdated}</p>
        <div className="mt-6 text-text-secondary text-base leading-relaxed">{intro}</div>
      </Reveal>

      <div className="mt-12 space-y-10 text-text-secondary leading-relaxed">{children}</div>
    </article>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Reveal>
      <section id={id} className="scroll-mt-28">
        <h2 className="text-white font-bold text-2xl mb-4 tracking-tight">{title}</h2>
        <div className="space-y-3 text-text-secondary">{children}</div>
      </section>
    </Reveal>
  );
}
