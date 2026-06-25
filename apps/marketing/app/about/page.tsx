import type { Metadata } from 'next';
import { MessageCircle } from 'lucide-react';
import { PageHero } from '@/components/sections/PageHero';
import { SectionHeading } from '@/components/sections/SectionHeading';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { CTABanner } from '@/components/sections/CTABanner';
import { whatsappLink, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About DropTrack — closing the letterbox trust gap',
  description:
    'DropTrack was founded in Canberra by Joy Patel — Australia\'s first AI-native letterbox distribution platform — to bring GPS verification, AI reporting and Privacy Act compliance to a forty-year-old industry that has always run on the honour system.',
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
          <a href={whatsappLink()} target="_blank" rel="noopener" className="btn-primary">
            <MessageCircle size={14} /> Get in touch
          </a>
        }
      />

      {/* Founder */}
      <section className="mx-auto max-w-[1100px] px-5">
        <Reveal>
          <GlassCard className="md:p-12">
            <div className="grid md:grid-cols-[340px_1fr] gap-8 md:gap-14 items-start">
              <div
                className="w-64 h-64 md:w-[340px] md:h-[400px] rounded-3xl mx-auto md:mx-0 overflow-hidden relative shrink-0"
                style={{
                  boxShadow: '0 30px 60px -20px rgba(99,102,241,0.55)',
                  background:
                    'linear-gradient(135deg, #6366f1 0%, #a855f7 45%, #a3e635 100%)',
                  padding: '2px',
                }}
              >
                <img
                  src="/joy-patel.jpg"
                  alt="Joy Patel, Founder & CEO of DropTrack"
                  className="w-full h-full object-cover rounded-[22px]"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[.22em] text-primary font-bold mb-2">
                  Founder & CEO
                </p>
                <h2 className="font-display text-4xl md:text-5xl text-white tracking-tight">
                  {SITE.founder}
                </h2>
                <p className="mt-5 text-text-secondary leading-relaxed">
                  Joy Patel is a Master of Information Technology with more than ten years across
                  Australian real estate and last-mile delivery — two industries that share the
                  same blind spot: nobody can prove the physical thing actually happened.
                </p>
                <p className="mt-4 text-text-secondary leading-relaxed">
                  After watching agents pay thousands for letterbox campaigns with nothing more
                  than a verbal confirmation in return, Joy started DropTrack with one question:
                  what if every flyer carried a receipt? The answer became a GPS pin, a fraud
                  engine, seven AI features, and an Australian-hosted platform built to fill the
                  trust gap from the ground up.
                </p>
              </div>
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
