import type { Metadata } from 'next';
import { MessageCircle } from 'lucide-react';
import { PageHero } from '@/components/sections/PageHero';
import { SectionHeading } from '@/components/sections/SectionHeading';
import { IndustryTabs } from '@/components/sections/IndustryTabs';
import { Faq, FaqJsonLd, type FaqItem } from '@/components/sections/Faq';
import { CTABanner } from '@/components/sections/CTABanner';
import { whatsappLink, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Industries — real estate, clinics, political campaigns',
  description:
    'DropTrack is built for Australian real-estate agents, GP and dental clinics, and political campaigns who need GPS-verified proof of letterbox delivery.',
  alternates: { canonical: `${SITE.url}/industries` },
};

const FAQ: FaqItem[] = [
  {
    q: 'Can DropTrack handle a federal election campaign roll-out?',
    a: 'Yes. Our Fraud Shield, immutable GPS trail and per-booth coverage breakdown were designed with political campaign compliance in mind. Drops are signed at campaign close so the audit trail is defensible to AEC officers and the press. Tight cadences (10 days or less between drops) are pre-configured.',
  },
  {
    q: 'Is DropTrack suitable for a single-site dental practice?',
    a: 'Yes. The platform scales down to a single 5,000-flyer campaign and up to a multi-site clinic group. Smart Zones automatically excludes apartment blocks and student housing for clinics targeting families, and the re-run recommender uses a clinic-specific cadence of around 35 days.',
  },
  {
    q: 'How does DropTrack compare to a traditional letterbox contractor?',
    a: 'Traditional contractors give you a quote, a phone call, and a verbal confirmation. DropTrack gives you a GPS-pinned drop list, a coverage map, a fraud-shield summary, and an AI-written executive report — automatically, on every campaign, at a comparable price.',
  },
  {
    q: 'Do you only work with agencies, or also direct with vendors and patients?',
    a: 'Direct with both. Agents and account managers run their clients\' campaigns inside DropTrack and forward branded reports. Vendors, practice managers and campaign managers run their own campaigns directly. The platform is the same for both — only the workflow shifts.',
  },
];

export default function IndustriesPage() {
  return (
    <>
      <FaqJsonLd items={FAQ} />

      <PageHero
        eyebrow="Built for AU agencies who need the audit trail"
        title={
          <>
            One platform.{' '}
            <span className="gradient-text">Three industries.</span>
          </>
        }
        intro={
          <>
            Real-estate agents, clinics and political campaigns each have a different cadence, a
            different audience and a different definition of proof. DropTrack ships with all three
            built in.
          </>
        }
        cta={
          <a href={whatsappLink()} target="_blank" rel="noopener" className="btn-primary">
            <MessageCircle size={14} /> Talk to us about your vertical
          </a>
        }
      />

      <section className="mx-auto max-w-[1280px] px-5">
        <IndustryTabs />
      </section>

      <section className="mx-auto max-w-[1280px] px-5 mt-32">
        <SectionHeading
          eyebrow="Common questions"
          title="What different verticals ask us first."
        />
        <Faq items={FAQ} />
      </section>

      <CTABanner />
    </>
  );
}
