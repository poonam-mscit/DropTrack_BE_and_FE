import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock3, MapPin, MessageCircle, ShieldCheck } from 'lucide-react';
import { PageHero } from '@/components/sections/PageHero';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { whatsappLink, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Book a 15-minute demo',
  description:
    'See DropTrack live with our team. Walk through a real GPS-tracked campaign, see an AI Campaign Report and get a quote for your suburb — all in 15 minutes on WhatsApp.',
  alternates: { canonical: `${SITE.url}/demo` },
};

const POINTS = [
  { icon: Clock3, label: '15 minutes', body: 'Quick, focused, no slide deck.' },
  { icon: MapPin, label: 'Your suburb', body: 'We quote your zone live on the call.' },
  { icon: ShieldCheck, label: 'No pressure', body: 'You decide if it fits before we follow up.' },
];

export default function DemoPage() {
  return (
    <>
      <PageHero
        eyebrow="Book a demo · 15 min · WhatsApp"
        title={
          <>
            See DropTrack in <span className="gradient-text">15 minutes.</span>
          </>
        }
        intro={
          <>
            Tap the button and message us on WhatsApp. We'll send a Loom of the platform, then jump
            on a quick call to quote your suburb and answer anything.
          </>
        }
        cta={
          <a href={whatsappLink()} target="_blank" rel="noopener" className="btn-primary">
            <MessageCircle size={14} /> Open WhatsApp
          </a>
        }
      />

      <section className="mx-auto max-w-[1100px] px-5">
        <div className="grid md:grid-cols-3 gap-5">
          {POINTS.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.label} delay={i * 0.06}>
                <GlassCard className="text-center h-full">
                  <Icon size={22} className="text-primary mx-auto mb-3" />
                  <div className="font-display text-2xl text-white">{p.label}</div>
                  <p className="text-text-secondary text-sm mt-2">{p.body}</p>
                </GlassCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[800px] px-5 mt-24 text-center">
        <Reveal>
          <p className="text-text-muted text-sm mb-6">
            Prefer email? Reach{' '}
            <a href={`mailto:${SITE.email}`} className="text-primary hover:underline">
              {SITE.email}
            </a>{' '}
            and we'll reply within one business day. Or browse the{' '}
            <Link href="/features" className="text-primary hover:underline">
              full feature list
            </Link>{' '}
            first.
          </p>
        </Reveal>
      </section>
    </>
  );
}
