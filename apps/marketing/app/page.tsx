import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Radar,
  Repeat2,
  Shield,
  Sparkles,
  Wand2,
  ChartLine,
} from 'lucide-react';
import { PageHero } from '@/components/sections/PageHero';
import { SectionHeading } from '@/components/sections/SectionHeading';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { Faq, FaqJsonLd, type FaqItem } from '@/components/sections/Faq';
import { CTABanner } from '@/components/sections/CTABanner';
import { MockHomeMap } from '@/components/mocks/MockHomeMap';
import { whatsappLink, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'GPS-verified leaflet distribution for Australian agents',
  description:
    'DropTrack is the AI-native letterbox distribution platform built for Australia. Every flyer GPS-verified. Every campaign reported. Every dollar accounted for.',
  alternates: { canonical: SITE.url },
};

const FEATURES = [
  {
    icon: MapPin,
    name: 'GPS-pin proof',
    blurb: 'Every drop carries a verified latitude, longitude and timestamp. No more guessing.',
  },
  {
    icon: Shield,
    name: 'Fraud Shield',
    blurb: 'AI flags suspicious speed, clustering or skipped streets in real time.',
  },
  {
    icon: Wand2,
    name: 'AI Smart Zones',
    blurb: 'Draw a suburb. We score density, route the walk, and quote on the spot.',
  },
  {
    icon: Sparkles,
    name: 'AI Job Creator',
    blurb: 'Paste your brief. Watch a complete campaign appear, fields prefilled.',
  },
  {
    icon: ChartLine,
    name: 'AI Campaign Reports',
    blurb: 'Auto-generated PDF with coverage maps, dropper performance and insights.',
  },
  {
    icon: Repeat2,
    name: 'AI Re-run Recommender',
    blurb: 'When to drop again — by industry, by suburb, by your own past results.',
  },
  {
    icon: Brain,
    name: 'AI Assistant',
    blurb: 'Ask anything: "How did Bondi perform?" — answered in plain English.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Draw your zone',
    body:
      'Outline the streets you want covered on the map. AI Smart Zones scores density, picks the route, and quotes the job in seconds.',
  },
  {
    n: '02',
    title: 'Pay and go',
    body:
      'Stripe-hosted checkout. The moment payment clears we assign a vetted, trained dropper from our managed team — every one screened and accountable.',
  },
  {
    n: '03',
    title: 'Watch every pin land',
    body:
      'Real-time map of GPS-verified drops. Fraud Shield flags anomalies live. A full AI Campaign Report lands in your inbox the moment the job completes.',
  },
];

const FAQ: FaqItem[] = [
  {
    q: 'How does DropTrack verify that leaflets were actually delivered?',
    a: 'Every drop is GPS-pinned with latitude, longitude and timestamp at the moment the dropper marks delivery. Our Fraud Shield engine continuously checks speed, route adherence and clustering against industry-typical pace for walking, cycling and e-scooter droppers. Anything outside expected bounds is flagged for review before the campaign is marked complete.',
  },
  {
    q: 'Who actually delivers my leaflets?',
    a: 'Every DropTrack dropper is individually vetted, trained on our coverage standards, and held accountable on every job through GPS verification and Fraud Shield. Whether engaged as staff or as managed contractors, they all work to the same standard, follow the same routes, and are tracked the same way — so the proof you receive is identical regardless of who walks the street.',
  },
  {
    q: 'How much does letterbox distribution cost in Australia?',
    a: 'DropTrack pricing is on application and varies by suburb density, leaflet count and turnaround. Most jobs land around 20 cents per leaflet inclusive of GST, but inner-city zones, weekend turnarounds and rural areas adjust the rate. The AI Smart Zones tool quotes your exact job the moment you draw the polygon — message us on WhatsApp for a sample quote.',
  },
  {
    q: 'Which Australian cities does DropTrack operate in?',
    a: 'DropTrack currently operates in Canberra and the surrounding region. We’ll be expanding to other capital cities soon — get in touch if you’d like to be notified when we launch in yours.',
  },
  {
    q: 'Can I get a report I can show clients or compliance officers?',
    a: 'Yes. Every completed campaign produces an AI-generated PDF with a coverage map, GPS-pinned drop list, dropper performance, anomaly summary and AI-written executive insight. Political campaigns get an AEC-style audit trail; real estate agents get a brand-safe report ready to forward to vendors.',
  },
  {
    q: 'How does DropTrack handle privacy and data?',
    a: 'All campaign and tracking data is stored in AWS Sydney under Privacy Act 1988 obligations. Personal information of droppers and clients is encrypted at rest and in transit. We never sell or share data with third parties. Clients can request export or deletion at any time.',
  },
];

export default function Home() {
  return (
    <>
      <FaqJsonLd items={FAQ} />

      <PageHero
        eyebrow="Australia's first AI-native letterbox platform · Built in Canberra"
        title={
          <>
            Verified leaflet drops,{' '}
            <span className="gradient-text">end&nbsp;to&nbsp;end.</span>
          </>
        }
        intro={
          <>
            DropTrack is the GPS-tracked, AI-reported letterbox distribution platform for Australian
            real-estate agents, clinics and campaigns. Every flyer pinned. Every dollar accounted for.
          </>
        }
        cta={
          <>
            <a href={whatsappLink()} target="_blank" rel="noopener" className="btn-primary">
              <MessageCircle size={14} /> Book a demo on WhatsApp
            </a>
            <Link href="/how-it-works" className="btn-ghost">
              See how it works <ArrowRight size={14} />
            </Link>
          </>
        }
      />

      {/* App preview — real Mapbox map of a Bondi campaign */}
      <section className="mx-auto max-w-[1180px] px-5 mb-20">
        <Reveal>
          <MockHomeMap />
        </Reveal>
        <p className="text-center text-xs text-text-muted mt-4">
          Live tracking on real Mapbox tiles · Bondi · J-2491 · every drop GPS-pinned.
        </p>
      </section>

      {/* Stats strip */}
      <section className="mx-auto max-w-[1100px] px-5">
        <Reveal>
          <div className="glass rounded-2xl grid grid-cols-2 md:grid-cols-4 divide-x divide-border-subtle">
            {[
              ['100%', 'GPS-verified drops'],
              ['<60s', 'AI quote on any zone'],
              ['7', 'Built-in AI features'],
              ['AU', 'Data residency, Sydney'],
            ].map(([n, l]) => (
              <div key={l} className="p-6 text-center">
                <div className="font-display text-3xl md:text-4xl text-white gradient-text">
                  {n}
                </div>
                <div className="text-xs text-text-muted mt-1 uppercase tracking-wider">{l}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1280px] px-5 mt-32">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              From <span className="gradient-text">polygon to PDF</span> in three moves.
            </>
          }
          intro="Built so a busy agent can launch a campaign on a coffee break."
        />
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <GlassCard>
                <div className="font-display text-5xl text-primary/40 mb-3">{s.n}</div>
                <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{s.body}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* AI features grid */}
      <section className="mx-auto max-w-[1280px] px-5 mt-32">
        <SectionHeading
          eyebrow="Seven AI features. One platform."
          title={
            <>
              Letterbox marketing,{' '}
              <span className="gradient-text">finally intelligent.</span>
            </>
          }
          intro="Every feature is opt-in, trained on Australian campaign data, and built into the core workflow."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal key={f.name} delay={i * 0.05}>
                <GlassCard className="h-full">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))',
                      border: '1px solid rgba(129,140,248,0.35)',
                    }}
                  >
                    <Icon size={18} className="text-primary" />
                  </div>
                  <h3 className="text-white font-bold mb-1.5">{f.name}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{f.blurb}</p>
                </GlassCard>
              </Reveal>
            );
          })}
        </div>
        <Reveal delay={0.2}>
          <div className="text-center mt-10">
            <Link href="/features" className="btn-ghost">
              See every feature <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Why DropTrack */}
      <section className="mx-auto max-w-[1280px] px-5 mt-32">
        <SectionHeading
          eyebrow="Why agents pick DropTrack"
          title={
            <>
              Built to <span className="gradient-text">close the trust gap.</span>
            </>
          }
          intro="The letterbox industry has run on the honour system for forty years. We're the first platform with the receipts."
        />
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              icon: Radar,
              title: 'Receipts, not promises',
              body:
                'Every leaflet carries a GPS pin and a timestamp. Forward the report to your vendor, your AEC officer, or your compliance team — done.',
            },
            {
              icon: Shield,
              title: 'Vetted, trained, accountable',
              body:
                'Every dropper is screened, trained on coverage standards, and tracked on every job by GPS + Fraud Shield. Accountability built into the platform, not left to trust.',
            },
            {
              icon: Sparkles,
              title: 'AI that earns its keep',
              body:
                'Seven features that price your zone, plan the route, catch fraud, write the report, and recommend the re-run date. Not a chatbot bolted on.',
            },
          ].map((b, i) => {
            const Icon = b.icon;
            return (
              <Reveal key={b.title} delay={i * 0.08}>
                <GlassCard className="h-full">
                  <Icon size={22} className="text-primary mb-4" />
                  <h3 className="text-white font-bold mb-2">{b.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{b.body}</p>
                </GlassCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Social proof slot */}
      <section className="mx-auto max-w-[1280px] px-5 mt-32">
        <SectionHeading
          eyebrow="Trusted across verticals"
          title="Built for the AU agencies who need the audit trail."
        />
        <Reveal>
          <div className="glass rounded-2xl px-8 py-10 grid grid-cols-2 md:grid-cols-5 items-center gap-6 opacity-70 hover:opacity-100 transition-opacity">
            {['Belle Property', 'Ray White', 'Westside Clinics', 'Bondi Smiles', 'CampaignAU'].map(
              (name) => (
                <div
                  key={name}
                  className="text-center text-text-muted font-display text-lg md:text-xl tracking-tight"
                >
                  {name}
                </div>
              ),
            )}
          </div>
          <p className="mt-3 text-xs text-text-muted text-center">
            Placeholder partners — real logos go here once locked.
          </p>
        </Reveal>
      </section>

      {/* Compliance ticks */}
      <section className="mx-auto max-w-[1100px] px-5 mt-32">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            'Privacy Act 1988',
            'Data hosted in AWS Sydney',
            'WCAG 2.2 AA accessible',
            'Stripe-secured payments',
          ].map((c, i) => (
            <Reveal key={c} delay={i * 0.05}>
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 size={18} className="text-lime-400 shrink-0" />
                <span className="text-sm text-text-secondary">{c}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1280px] px-5 mt-32">
        <SectionHeading
          eyebrow="Common questions"
          title="What agents ask before booking a demo."
        />
        <Faq items={FAQ} />
      </section>

      <CTABanner />
    </>
  );
}
