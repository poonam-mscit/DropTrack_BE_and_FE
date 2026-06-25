import type { Metadata } from 'next';
import {
  Brain,
  ChartLine,
  MapPin,
  MessageCircle,
  Repeat2,
  Shield,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { PageHero } from '@/components/sections/PageHero';
import { SectionHeading } from '@/components/sections/SectionHeading';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { Faq, FaqJsonLd, type FaqItem } from '@/components/sections/Faq';
import { CTABanner } from '@/components/sections/CTABanner';
import { MockAgentDashboard } from '@/components/mocks/MockAgentDashboard';
import { MockAIAssistant } from '@/components/mocks/MockAIAssistant';
import { MockJobCreator } from '@/components/mocks/MockJobCreator';
import { MockCampaignBuilder } from '@/components/mocks/MockCampaignBuilder';
import { whatsappLink, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'AI features built for Australian letterbox campaigns',
  description:
    'GPS verification, Fraud Shield, Smart Zones, Job Creator, AI Campaign Reports, Re-run Recommender and AI Assistant — every feature is AU-trained and built into the workflow.',
  alternates: { canonical: `${SITE.url}/features` },
};

const FEATURES = [
  {
    icon: MapPin,
    name: 'GPS-pin proof of delivery',
    short: 'Every flyer carries a verified lat/long/timestamp.',
    body:
      "Droppers mark each delivery on a mobile app that captures GPS at the moment of drop. Pins are stitched to a live map so you and your client can watch coverage build street by street. Once the campaign closes, the pin set is locked, signed and exported — your audit trail, ready to forward.",
    bullets: [
      'GPS accuracy verified against device sensors',
      'Pins immutable once the job completes',
      'Exportable as KML, GeoJSON or PDF map',
    ],
  },
  {
    icon: Shield,
    name: 'Fraud Shield',
    short: 'AI catches what your eye would miss.',
    body:
      'Fraud Shield watches every dropper in real time. It compares speed against expected pace for their transport mode — walking, bicycle, or e-scooter — and flags drops that cluster too tightly, skip streets, or land outside the assigned polygon. Anomalies surface as a banner on your dashboard before the campaign finishes.',
    bullets: [
      'Transport-aware speed limits (walking 12 km/h, bike 35, scooter 32)',
      'Cluster detection catches "dump and run" patterns',
      'Off-polygon drops auto-flagged for review',
    ],
  },
  {
    icon: Wand2,
    name: 'AI Smart Zones',
    short: 'Draw a suburb. Get an AI-priced job in seconds.',
    body:
      "Outline the streets you want covered. Smart Zones scores density (inner-city, inner-suburb, suburban), estimates leaflet count, plans the most efficient walking route, and returns a precise quote — all before you click pay. The model is trained on Australian census and route data, not generic global heuristics.",
    bullets: [
      'AU census-trained density scoring',
      'Walk-route optimised for one-day completion',
      'Quote inclusive of GST and platform fee',
    ],
  },
  {
    icon: Sparkles,
    name: 'AI Job Creator',
    short: 'Paste a brief. Watch a campaign appear.',
    body:
      'Drop your client brief, your past email, or a couple of bullet points into Job Creator. It extracts target suburb, leaflet count, campaign type, deadline and target audience — then prefills the campaign form for you to confirm. Cuts setup time from twenty minutes to under two.',
    bullets: [
      'Understands AU industry jargon',
      'Confirms every field before submission',
      'Handles open-house, clinic and political briefs',
    ],
  },
  {
    icon: ChartLine,
    name: 'AI Campaign Reports',
    short: 'A vendor-ready PDF the moment the job closes.',
    body:
      'When the campaign completes, an AI Campaign Report is automatically generated and emailed: coverage map, drop heatmap, dropper performance, fraud-shield summary, and a plain-English executive insight written by Claude 3.5 Haiku via AWS Bedrock. Brand-safe to forward to your vendor or compliance officer.',
    bullets: [
      'Sample report available on request',
      'AEC-style audit trail for political campaigns',
      'AU spelling, plain English, no jargon',
    ],
  },
  {
    icon: Repeat2,
    name: 'AI Re-run Recommender',
    short: 'When to drop again — backed by your own data.',
    body:
      "Open any completed job and the Re-run Recommender suggests a specific date for your next drop. It blends industry norms (real estate ~18-21 days, clinics ~35 days, political tightens to ~10) with your suburb's response history and weather patterns — so you stop guessing and start scheduling.",
    bullets: [
      'Specific date, not a vague window',
      'Learns from your own past campaigns',
      'Surfaced inline — no separate dashboard',
    ],
  },
  {
    icon: Brain,
    name: 'AI Assistant',
    short: 'Ask anything about your campaigns.',
    body:
      "The AI Assistant has full read access to your jobs, dropper roster and report archive. Ask 'How did Bondi go?' and get a plain-English answer with numbers. Ask 'What if my coverage trails the deadline?' and it'll surface options. Powered by Claude via AWS Bedrock — your data never leaves Sydney.",
    bullets: [
      'Claude 3.5 Haiku via AWS Bedrock Sydney',
      'No data sharing — your campaigns are private',
      'Threaded chat, deletable, exportable',
    ],
  },
];

const FAQ: FaqItem[] = [
  {
    q: 'Which AI model powers the DropTrack features?',
    a: 'DropTrack runs Claude 3.5 Haiku via AWS Bedrock in the Sydney region (ap-southeast-2). Choosing Bedrock means model inference happens entirely inside AWS Australia — your campaign data, briefs and reports never leave the country and never train a public model.',
  },
  {
    q: 'Can I use DropTrack without the AI features?',
    a: 'Yes. Every AI feature is opt-in. You can run the platform purely on GPS verification, manual zone drawing and manual reporting if you prefer. The AI features are designed to disappear when you do not need them and surface contextually when they help.',
  },
  {
    q: 'How is dropper performance measured?',
    a: 'Each dropper is scored on three signals: coverage completion against assigned polygon, average pace against the expected speed for their transport mode, and fraud-shield flags. Scores feed back into the dispatcher so high-performing droppers get priority assignment on premium jobs.',
  },
  {
    q: 'Does Fraud Shield ever produce false positives?',
    a: 'It can. That is why every flag is reviewed by the DropTrack ops team before it is shown on your dashboard. We tune thresholds per transport mode and per density zone — an e-scooter dropper in Bondi is not the same shape as a walker in Mosman.',
  },
];

export default function FeaturesPage() {
  return (
    <>
      <FaqJsonLd items={FAQ} />

      <PageHero
        eyebrow="Seven AI features · One platform"
        title={
          <>
            Letterbox marketing, <span className="gradient-text">finally intelligent.</span>
          </>
        }
        intro={
          <>
            Each feature is trained on Australian campaign data and built into the workflow you
            already run — no separate tools, no separate logins, no separate bills.
          </>
        }
        cta={
          <a href={whatsappLink()} target="_blank" rel="noopener" className="btn-primary">
            <MessageCircle size={14} /> Book a 15-minute walkthrough
          </a>
        }
      />

      <section className="mx-auto max-w-[1280px] px-5">
        <div className="grid gap-6 md:gap-7">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            const flipped = i % 2 === 1;
            return (
              <Reveal key={f.name} delay={0.04}>
                <GlassCard className="md:p-10">
                  <div
                    className={`grid md:grid-cols-[140px_1fr] gap-6 md:gap-10 items-start ${
                      flipped ? 'md:[direction:rtl]' : ''
                    }`}
                  >
                    <div className="[direction:ltr]">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(99,102,241,0.30), rgba(168,85,247,0.30), rgba(163,230,53,0.15))',
                          border: '1px solid rgba(129,140,248,0.4)',
                          boxShadow: '0 10px 30px -10px rgba(99,102,241,0.5)',
                        }}
                      >
                        <Icon size={28} className="text-white" />
                      </div>
                      <div className="font-display text-3xl text-white/30 mt-3">
                        0{i + 1}
                      </div>
                    </div>
                    <div className="[direction:ltr]">
                      <p className="text-xs uppercase tracking-[.2em] text-primary font-bold mb-2">
                        {f.short}
                      </p>
                      <h2 className="font-display text-3xl md:text-4xl text-white tracking-tight mb-3">
                        {f.name}
                      </h2>
                      <p className="text-text-secondary leading-relaxed">{f.body}</p>
                      <ul className="mt-5 space-y-2">
                        {f.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-3 text-sm text-text-secondary">
                            <span className="mt-1.5 size-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_2px_rgba(163,230,53,0.5)] shrink-0" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </GlassCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Inside the agent workspace */}
      <section className="mx-auto max-w-[1180px] px-5 mt-32">
        <SectionHeading
          eyebrow="Inside the agent workspace"
          title={
            <>
              Built for the way <span className="gradient-text">agents actually work.</span>
            </>
          }
          intro="A peek at the screens your team will live in — sidebar nav, AU-flavoured copy, dark mode out of the box."
        />

        <div className="space-y-24">
          {/* Dashboard */}
          <div>
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-[.22em] text-primary font-bold mb-1">
                Dashboard
              </p>
              <h3 className="font-display text-2xl md:text-3xl text-white tracking-tight">
                Every campaign, one glance.
              </h3>
              <p className="text-text-secondary text-sm md:text-base mt-2 max-w-xl mx-auto">
                Active drops, coverage live, monthly spend — the snapshot most agents check first
                thing every morning.
              </p>
            </div>
            <Reveal>
              <MockAgentDashboard />
            </Reveal>
          </div>

          {/* AI Job Creator */}
          <div>
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-[.22em] text-primary font-bold mb-1">
                AI Job Creator
              </p>
              <h3 className="font-display text-2xl md:text-3xl text-white tracking-tight">
                Paste a brief. Watch a campaign appear.
              </h3>
              <p className="text-text-secondary text-sm md:text-base mt-2 max-w-xl mx-auto">
                Suburb, leaflet count, deadline and audience extracted in about a second — every
                field reviewable before you commit.
              </p>
            </div>
            <Reveal>
              <MockJobCreator />
            </Reveal>
          </div>

          {/* Smart Zones */}
          <div>
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-[.22em] text-primary font-bold mb-1">
                AI Smart Zones
              </p>
              <h3 className="font-display text-2xl md:text-3xl text-white tracking-tight">
                Draw a suburb. Get a priced job in seconds.
              </h3>
              <p className="text-text-secondary text-sm md:text-base mt-2 max-w-xl mx-auto">
                Outline the streets, see density score, route plan and a locked AU-dollar quote
                before you ever reach for the card.
              </p>
            </div>
            <Reveal>
              <MockCampaignBuilder />
            </Reveal>
          </div>

          {/* AI Assistant */}
          <div>
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-[.22em] text-primary font-bold mb-1">
                AI Assistant
              </p>
              <h3 className="font-display text-2xl md:text-3xl text-white tracking-tight">
                Plain-English answers about your campaigns.
              </h3>
              <p className="text-text-secondary text-sm md:text-base mt-2 max-w-xl mx-auto">
                Ask anything — "How did Bondi go?" "When should I re-run Mosman?" — and get answers
                grounded in your real data, not generic chatbot copy.
              </p>
            </div>
            <Reveal>
              <MockAIAssistant />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 mt-32">
        <SectionHeading
          eyebrow="The fine print"
          title="Everything you might ask about the AI."
        />
        <Faq items={FAQ} />
      </section>

      <CTABanner />
    </>
  );
}
