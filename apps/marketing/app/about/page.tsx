import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { PageHero } from '@/components/sections/PageHero';
import { SectionHeading } from '@/components/sections/SectionHeading';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { CTABanner } from '@/components/sections/CTABanner';
import { contactLink, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About DropTrack — closing the letterbox trust gap',
  description:
    'DropTrack is Australia\'s first AI-native letterbox distribution platform — bringing GPS verification, AI reporting and Privacy Act compliance to a forty-year-old industry that has always run on the honour system.',
  alternates: { canonical: `${SITE.url}/about` },
};

const VALUES = [
  {
    title: 'Receipts, not promises',
    body:
      'The letterbox industry has run on the honour system for forty years. Our entire product is the receipt — a GPS pin, a timestamp, an audit trail you can forward.',
  },
  {
    title: 'AU-first, by design',
    body:
      'Sydney data residency, AU spelling, AU census-trained AI, AU dropper employment law. Not a US platform with a flag changed.',
  },
  {
    title: 'Vetted, trained, accountable',
    body:
      'Real accountability is built into the platform — every dropper is screened, trained on our coverage standards, and tracked on every job by GPS and Fraud Shield. The proof is in the data, not a promise.',
  },
  {
    title: 'AI that earns its keep',
    body:
      'No chatbot bolted on. Seven AI features, each tied to a specific decision an agent has to make: how much, where, when, and what does the report say.',
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Founded in Canberra · 2026 · Australia's first AI-native letterbox platform"
        title={
          <>
            Closing the letterbox <span className="gradient-text">trust gap.</span>
          </>
        }
        intro={
          <>
            DropTrack exists because the most measurable channel in marketing — a physical leaflet
            in a real letterbox — has somehow stayed the least measurable. We're fixing that.
          </>
        }
        cta={
          <a href={contactLink()} className="btn-primary">
            <Mail size={14} /> Get in touch
          </a>
        }
      />

      {/* Mission — a company story, no personal details */}
      <section className="mx-auto max-w-[1100px] px-5">
        <Reveal>
          <GlassCard className="md:p-12">
            <div className="max-w-3xl mx-auto">
              <p className="text-xs uppercase tracking-[.22em] text-primary font-bold mb-2 text-center">
                Why we exist
              </p>
              <h2 className="font-display text-4xl md:text-5xl text-white tracking-tight text-center">
                A receipt for every flyer.
              </h2>
              <p className="mt-6 text-text-secondary leading-relaxed">
                Australian agents spend thousands on letterbox campaigns every month and
                receive nothing more than a verbal confirmation in return. The most
                measurable channel in marketing — a physical leaflet in a real letterbox —
                has somehow stayed the least measurable for forty years.
              </p>
              <p className="mt-4 text-text-secondary leading-relaxed">
                DropTrack started with one question: what if every flyer carried a
                receipt? The answer became a GPS pin, a fraud engine, seven AI features,
                and an Australian-hosted platform built to fill the trust gap from the
                ground up. Every campaign is verifiable. Every dollar is accounted for.
              </p>
              <p className="mt-4 text-text-secondary leading-relaxed">
                We are Australian-registered, Canberra-founded, and every byte of client
                data lives in Sydney. Our team is small and focused. If you want to talk
                to a human, email <a className="text-primary hover:underline" href={`mailto:${SITE.email}`}>{SITE.email}</a> and one of us will reply the same day.
              </p>
            </div>
          </GlassCard>
        </Reveal>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-[1280px] px-5 mt-32">
        <SectionHeading
          eyebrow="What we believe"
          title={
            <>
              Four <span className="gradient-text">non-negotiables.</span>
            </>
          }
          intro="Every product decision rolls back to one of these."
        />
        <div className="grid md:grid-cols-2 gap-5">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.06}>
              <GlassCard className="h-full">
                <h3 className="text-white font-bold text-xl mb-2">{v.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{v.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </section>

      <CTABanner />
    </>
  );
}
