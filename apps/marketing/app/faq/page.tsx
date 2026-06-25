import type { Metadata } from 'next';
import { MessageCircle } from 'lucide-react';
import { PageHero } from '@/components/sections/PageHero';
import { SectionHeading } from '@/components/sections/SectionHeading';
import { Faq, FaqJsonLd, type FaqItem } from '@/components/sections/Faq';
import { CTABanner } from '@/components/sections/CTABanner';
import { whatsappLink, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    '28 questions answered about GPS-verified leaflet distribution in Australia — pricing, coverage, droppers, AI features, privacy and compliance.',
  alternates: { canonical: `${SITE.url}/faq` },
};

// 28 FAQs across 5 categories.
const GENERAL: FaqItem[] = [
  {
    q: 'What is DropTrack?',
    a: 'DropTrack is an AI-native, GPS-verified letterbox distribution platform built for Australian agents. We pin every flyer drop with latitude, longitude and timestamp, then generate a vendor-ready AI report on completion. The platform exists to close the trust gap in an industry that has run on the honour system for forty years.',
  },
  {
    q: 'Which Australian cities does DropTrack operate in?',
    a: 'DropTrack is launching in Sydney first. Melbourne, Brisbane and Perth are on the immediate roadmap, with regional NSW and the Gold Coast following soon after. All campaigns are handled from our AU-hosted infrastructure in AWS Sydney.',
  },
  {
    q: 'Who uses DropTrack?',
    a: 'Three primary verticals: real-estate agents and agencies running open-house and vendor-drop campaigns; GP and dental clinics building new patient acquisition; and political campaigns at federal, state and council level. Anyone who needs an audit trail for every flyer delivered.',
  },
  {
    q: 'How is DropTrack different from a traditional letterbox contractor?',
    a: 'Traditional contractors give you a quote, a phone call, and a verbal confirmation that the job was done. DropTrack gives you a GPS-pinned drop list, a real-time coverage map, a Fraud Shield report, and an AI-written executive summary — automatically, on every campaign, at a comparable price.',
  },
  {
    q: 'Do I need to install any software to use DropTrack?',
    a: 'No. Agents and clients run everything through a web app at app.droptrack.com.au. Droppers use a mobile-optimised version on their phones. Nothing to download, nothing to maintain.',
  },
];

const PRICING_OPS: FaqItem[] = [
  {
    q: 'How much does letterbox distribution cost in Australia?',
    a: 'DropTrack pricing is on application and varies by suburb density, leaflet count and turnaround. Most jobs land around 20 cents per leaflet inclusive of GST plus a 3% platform fee, but inner-city zones, weekend turnarounds and rural areas adjust the rate. The AI Smart Zones tool quotes your exact job the moment you draw the polygon — message us on WhatsApp for a sample quote.',
  },
  {
    q: 'How long does a typical campaign take from quote to completion?',
    a: 'Most metro-Sydney campaigns of 5,000 leaflets complete inside a single working day. Quote and pay in the morning, drops start within two hours, finished by close of business. Larger campaigns or rural areas span two to three days. The platform will not accept a deadline it cannot meet.',
  },
  {
    q: 'What is the minimum order size?',
    a: 'There is no formal minimum. We have run campaigns as small as 500 leaflets for single-shop-front local businesses and as large as 200,000 for council-wide political campaigns. The Smart Zones quote scales linearly so small jobs do not pay a penalty.',
  },
  {
    q: 'Do you handle printing or only distribution?',
    a: 'Distribution only at launch. Bring your own printed leaflets — we pick them up from your office or a printer near our Sydney hub. Print partnership integrations are planned for FY2027 so you can quote print + drop in a single flow.',
  },
  {
    q: 'Can I run multiple campaigns in parallel?',
    a: 'Yes. The dashboard handles unlimited concurrent campaigns. Each has its own polygon, dropper assignment, live tracking feed and AI report. Larger agencies routinely run 10+ campaigns in a single week.',
  },
  {
    q: 'What if I need to cancel a campaign after paying?',
    a: 'Before assignment: full refund via Stripe, no questions. Once a dropper has started the route, the campaign cannot be cancelled because the dropper has already begun their committed shift. We document this clearly at checkout so there are no surprises.',
  },
];

const DROPPERS: FaqItem[] = [
  {
    q: 'Who actually delivers my leaflets?',
    a: 'Every DropTrack dropper is individually vetted, trained on our coverage standards, and held accountable on every job through GPS verification and Fraud Shield. Whether engaged as staff or as managed contractors, they all work to the same standard and are tracked the same way — so the proof you receive is identical no matter who walks the street.',
  },
  {
    q: 'How are droppers trained?',
    a: 'Every new dropper completes a one-day induction covering app use, coverage standards, GPS protocol, privacy obligations under Privacy Act 1988, and what counts as fraud. Trial campaigns are shadowed by a senior dropper before independent assignment.',
  },
  {
    q: 'What transport do droppers use?',
    a: 'Walking, bicycles and electric scooters. The platform records transport mode per dropper and Fraud Shield speed thresholds are tuned accordingly — a walking dropper at 25 km/h is suspicious, but the same speed on a bicycle is normal.',
  },
  {
    q: 'How does Fraud Shield work?',
    a: 'Fraud Shield watches every dropper in real time. It compares speed against expected pace for their transport mode, detects unusual clustering of drops in tight time windows, and flags any pin landing outside the assigned polygon. Anomalies surface as a banner on your dashboard before the campaign finishes.',
  },
  {
    q: 'What happens if Fraud Shield flags a campaign?',
    a: 'The flag is reviewed by the DropTrack ops team before it appears on your dashboard. If the anomaly is genuine, we void the affected drops, dispatch a replacement dropper to redo that zone at no additional cost, and we deduct the offending dropper from payroll. Your campaign still completes on time.',
  },
];

const AI: FaqItem[] = [
  {
    q: 'Which AI model powers DropTrack?',
    a: 'DropTrack runs Claude 3.5 Haiku via AWS Bedrock in the Sydney region (ap-southeast-2). Choosing Bedrock means model inference happens entirely inside AWS Australia — your campaign data, briefs and reports never leave the country and never train a public model.',
  },
  {
    q: 'Can I use DropTrack without the AI features?',
    a: 'Yes. Every AI feature is opt-in. You can run the platform purely on GPS verification, manual zone drawing and manual reporting if you prefer. The AI features are designed to disappear when you do not need them and surface contextually when they help.',
  },
  {
    q: 'What does the AI Campaign Report contain?',
    a: 'A vendor-ready PDF with: coverage map, drop heatmap, dropper performance breakdown, Fraud Shield summary, hour-by-hour drop pace chart, and a plain-English executive insight written by Claude. Political campaigns also get a per-booth coverage breakdown matched to AEC polling locations.',
  },
  {
    q: 'How does the AI Re-run Recommender pick a date?',
    a: 'It blends three signals: industry-typical re-run cadence (real estate ~18-21 days, clinics ~35 days, political ~10 days), your own past campaigns in the same suburb, and Australian weather and holiday patterns. The output is a specific date — not a vague window — that you can drop straight into your planner.',
  },
  {
    q: 'Does the AI Assistant share my data with third parties?',
    a: 'No. The AI Assistant reads your jobs, dropper roster and report archive to answer questions in plain English. Every model call goes to Claude 3.5 Haiku via AWS Bedrock in Sydney. Your data is never shared with third parties, never sold, and never used to train public models.',
  },
];

const PRIVACY: FaqItem[] = [
  {
    q: 'Where is DropTrack data physically stored?',
    a: 'All databases, file storage and AI inference run in AWS Sydney, ap-southeast-2. We do not replicate or back up to any region outside Australia. This is contractual, built into our IAM policies, not a marketing promise.',
  },
  {
    q: 'How does DropTrack comply with the Privacy Act 1988?',
    a: 'DropTrack is built around the Australian Privacy Principles (APPs). We collect only what we need, disclose what we hold and why, and give you the right to access, correct or delete your personal information at any time. Our full Privacy Policy spells out the detail.',
  },
  {
    q: 'Does DropTrack collect data about letterbox recipients?',
    a: 'No. DropTrack does not collect personal information about the people who receive your flyers. We pin the GPS location of the letterbox, not the identity of the resident. We do not buy, sell or hold consumer marketing lists.',
  },
  {
    q: 'How do I request export or deletion of my data?',
    a: 'Email hello@droptrack.com.au from the address on your account. Export is provided in JSON and PDF within five business days. Deletion is processed within 30 days and is irreversible. Aggregate anonymised data may be retained for service improvement — we tell you precisely what before you sign up.',
  },
  {
    q: 'Who has access to my campaign data inside DropTrack?',
    a: 'Three groups only: you and any team members you grant access to; the assigned dropper for the duration of their job (location data only); the DropTrack ops team for support and Fraud Shield review. No third parties. No data brokers.',
  },
  {
    q: 'Is DropTrack SOC 2 or ISO 27001 certified?',
    a: 'Not yet. We operate to SOC 2 controls as a small AU-based team and intend to formalise certification by FY2027. AWS infrastructure underneath is SOC 2, ISO 27001 and IRAP-assessed, which covers the underlying compute, storage and identity layer.',
  },
  {
    q: 'How are payments secured?',
    a: 'Payments run through Stripe-hosted checkout. DropTrack never sees or stores your card details — Stripe handles PCI compliance, fraud monitoring and 3D Secure. We only receive a token confirming the payment succeeded.',
  },
];

const CATEGORIES = [
  { key: 'general', title: 'About DropTrack', items: GENERAL },
  { key: 'pricing', title: 'Pricing & operations', items: PRICING_OPS },
  { key: 'droppers', title: 'Droppers & Fraud Shield', items: DROPPERS },
  { key: 'ai', title: 'AI features', items: AI },
  { key: 'privacy', title: 'Privacy & compliance', items: PRIVACY },
];

const ALL_FAQS = CATEGORIES.flatMap((c) => c.items);

export default function FaqPage() {
  return (
    <>
      <FaqJsonLd items={ALL_FAQS} />

      <PageHero
        eyebrow={`${ALL_FAQS.length} answers · Updated monthly`}
        title={
          <>
            Every question we've{' '}
            <span className="gradient-text">heard so far.</span>
          </>
        }
        intro={
          <>
            If your question is not on this page, message us on WhatsApp — we will answer within
            one business day and add it here for the next agent who asks.
          </>
        }
        cta={
          <a href={whatsappLink()} target="_blank" rel="noopener" className="btn-primary">
            <MessageCircle size={14} /> Ask on WhatsApp
          </a>
        }
      />

      <div className="mx-auto max-w-[1280px] px-5 space-y-20">
        {CATEGORIES.map((cat) => (
          <section key={cat.key} id={cat.key}>
            <SectionHeading
              eyebrow={`${cat.items.length} questions`}
              title={cat.title}
              align="left"
            />
            <Faq items={cat.items} />
          </section>
        ))}
      </div>

      <CTABanner />
    </>
  );
}
