import type { Metadata } from 'next';
import { MapPin, MessageCircle, ScanLine, Sparkles, CreditCard, UserCheck } from 'lucide-react';
import { PageHero } from '@/components/sections/PageHero';
import { SectionHeading } from '@/components/sections/SectionHeading';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { Faq, FaqJsonLd, type FaqItem } from '@/components/sections/Faq';
import { CTABanner } from '@/components/sections/CTABanner';
import { MockAIReport } from '@/components/mocks/MockAIReport';
import {
  WireframeAssignment,
  WireframeDrawZone,
  WireframeGPS,
  WireframePay,
  WireframeReport,
} from '@/components/mocks/StepWireframes';
import { whatsappLink, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'How DropTrack works — from polygon to PDF',
  description:
    'Five steps from drawing your zone on a Sydney map to receiving an AI-written campaign report. See how GPS verification and Fraud Shield combine to give you proof every flyer landed.',
  alternates: { canonical: `${SITE.url}/how-it-works` },
};

const STEPS = [
  {
    num: '01',
    title: 'Draw your zone',
    body:
      'Open the campaign builder. Outline the streets you want covered — a single block or an entire postcode. AI Smart Zones scores density against the AU census, estimates leaflet count, and quotes the job inclusive of GST and platform fee. No surprises at invoice time.',
    icon: ScanLine,
    wireframe: WireframeDrawZone,
  },
  {
    num: '02',
    title: 'Confirm and pay',
    body:
      'Review the polygon, leaflet count, deadline and price. Pay via Stripe-hosted checkout — DropTrack never sees your card details. The moment the payment clears, the job moves to assignment.',
    icon: CreditCard,
    wireframe: WireframePay,
  },
  {
    num: '03',
    title: 'A verified dropper picks it up',
    body:
      "Our dispatcher matches your job to a vetted DropTrack dropper with the right transport mode and the strongest recent performance score. Every dropper is screened, trained on coverage standards, and accountable to us on every drop via GPS and Fraud Shield.",
    icon: UserCheck,
    wireframe: WireframeAssignment,
  },
  {
    num: '04',
    title: 'Every drop, GPS-pinned',
    body:
      "The dropper works the route on a mobile app. Each delivery captures latitude, longitude and timestamp. Pins stream live to your dashboard so you can watch coverage build. Fraud Shield watches in parallel — if speed, clustering or off-polygon drops look wrong, you'll see a banner before the campaign closes.",
    icon: MapPin,
    wireframe: WireframeGPS,
  },
  {
    num: '05',
    title: 'AI Campaign Report lands in your inbox',
    body:
      "On completion, Claude 3.5 Haiku via AWS Bedrock writes a vendor-ready PDF: coverage map, heatmap, dropper performance, fraud summary, executive insight. The AI Re-run Recommender then suggests your next drop date. Forward to your vendor, save to your CRM, or both.",
    icon: Sparkles,
    wireframe: WireframeReport,
  },
];

const FAQ: FaqItem[] = [
  {
    q: 'How long does a typical DropTrack campaign take from quote to completion?',
    a: 'Most metro-Sydney campaigns of 5,000 leaflets complete inside a single working day. Quote and pay in the morning, drops start within two hours, finished by close of business. Larger campaigns or rural areas span two to three days. The platform will not accept a deadline it cannot meet.',
  },
  {
    q: 'What happens if a dropper cannot finish their assigned zone?',
    a: 'Coverage gaps are reassigned automatically. Fraud Shield flags any zone that has trailed the expected pace by more than 15%, and the dispatcher pulls in a second dropper to finish. The original dropper is paid only for what they actually completed.',
  },
  {
    q: 'Can I see the live tracking myself while the campaign runs?',
    a: 'Yes. Every client has a live tracking dashboard showing the polygon, the dropper position, every GPS-pinned delivery and the current coverage percentage. Updates stream in real time over WebSocket. Share the link with your vendor or compliance team — read-only access is one click away.',
  },
  {
    q: 'What if I need to cancel a campaign?',
    a: 'Once the dropper has started, the campaign cannot be cancelled — you have already paid the dropper for their committed shift. Before assignment, full refunds via Stripe are standard. We document this clearly so there are no surprises.',
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <FaqJsonLd items={FAQ} />

      <PageHero
        eyebrow="The full pipeline · zone → drop → report"
        title={
          <>
            From <span className="gradient-text">polygon to PDF</span> in five moves.
          </>
        }
        intro={
          <>
            DropTrack handles quote, payment, assignment, GPS verification and AI-written reporting
            — so you focus on what to say in the flyer, not who'll deliver it.
          </>
        }
        cta={
          <a href={whatsappLink()} target="_blank" rel="noopener" className="btn-primary">
            <MessageCircle size={14} /> Walk through it live with us
          </a>
        }
      />

      {/* Step-by-step with wireframes */}
      <section className="mx-auto max-w-[1180px] px-5">
        <div className="flex flex-col gap-8 md:gap-10">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const Wire = s.wireframe;
            const flip = i % 2 === 1;
            return (
              <Reveal key={s.num} delay={i * 0.05}>
                <div
                  className={`grid md:grid-cols-2 gap-6 md:gap-10 items-center ${
                    flip ? 'md:[direction:rtl]' : ''
                  }`}
                >
                  {/* Text card */}
                  <div className="[direction:ltr]">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0"
                        style={{
                          background:
                            'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #a3e635 100%)',
                          boxShadow: '0 12px 36px -8px rgba(99,102,241,0.55)',
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <span className="font-display text-4xl text-white/30 leading-none">
                        {s.num}
                      </span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
                      {s.title}
                    </h3>
                    <p className="text-text-secondary leading-relaxed">{s.body}</p>
                  </div>

                  {/* Wireframe */}
                  <div className="[direction:ltr]">
                    <Wire />
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* AI Report — the deliverable at the end of step 5 */}
      <section className="mx-auto max-w-[1000px] px-5 mt-32">
        <SectionHeading
          eyebrow="Step 5 — the deliverable"
          title={
            <>
              Open the report.{' '}
              <span className="gradient-text">Forward to your vendor.</span>
            </>
          }
          intro="An AI-written, vendor-ready PDF — written by Claude 3.5 Haiku via AWS Bedrock — auto-generated the moment the campaign closes."
        />
        <Reveal>
          <MockAIReport />
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 mt-32">
        <SectionHeading
          eyebrow="Operations questions"
          title="What you'll want to know before the first campaign."
        />
        <Faq items={FAQ} />
      </section>

      <CTABanner />
    </>
  );
}
