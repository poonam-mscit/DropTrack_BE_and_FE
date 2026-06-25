import type { Metadata } from 'next';
import { Database, Lock, MessageCircle, ScrollText, ShieldCheck, UsersRound } from 'lucide-react';
import { PageHero } from '@/components/sections/PageHero';
import { SectionHeading } from '@/components/sections/SectionHeading';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { Faq, FaqJsonLd, type FaqItem } from '@/components/sections/Faq';
import { CTABanner } from '@/components/sections/CTABanner';
import { whatsappLink, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Trust, privacy and compliance',
  description:
    'How DropTrack protects your data: Privacy Act 1988 compliance, AWS Sydney residency, encrypted at rest and in transit, vetted droppers, Stripe-secured payments.',
  alternates: { canonical: `${SITE.url}/trust` },
};

const PILLARS = [
  {
    icon: ScrollText,
    title: 'Privacy Act 1988',
    body:
      "DropTrack is built to comply with the Australian Privacy Principles (APPs). We collect only the data we need to run your campaign, we disclose what we collect and why, and we give you the right to access, correct or delete your information at any time.",
  },
  {
    icon: Database,
    title: 'Australian data residency',
    body:
      'All campaign, dropper and tracking data is stored in AWS Sydney (ap-southeast-2). AI inference also runs in Sydney via AWS Bedrock — your data never leaves Australia and never trains a public model.',
  },
  {
    icon: Lock,
    title: 'Encrypted end to end',
    body:
      "Data is encrypted in transit (TLS 1.3) and at rest (AWS KMS, AES-256). Authentication runs on AWS Cognito with JWT access tokens. Payments are handled by Stripe — DropTrack never sees your card details.",
  },
  {
    icon: UsersRound,
    title: 'Vetted & accountable droppers',
    body:
      'Every dropper is individually vetted and trained on our coverage standards before their first job, then held accountable on every campaign through GPS verification and Fraud Shield. Same standard, same tracking, every drop.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit trail by default',
    body:
      "Every drop carries a signed GPS pin. Once a campaign closes, the pin set is immutable — you can prove coverage to a vendor, an AEC officer or your own compliance team six months later.",
  },
];

const FAQ: FaqItem[] = [
  {
    q: 'Where is DropTrack data physically stored?',
    a: 'All databases, file storage and AI inference run in AWS Sydney, ap-southeast-2. We do not replicate or back up to any region outside Australia. This is explicit, contractual, and built into our IAM policies — not a marketing promise.',
  },
  {
    q: 'Can I request export or deletion of my campaign data?',
    a: 'Yes — at any time. Export is available in JSON and PDF. Deletion is processed within 30 days and is irreversible. Aggregate, anonymised data may be retained for service improvement; we will tell you precisely what before you sign up.',
  },
  {
    q: 'How does DropTrack handle the personal information of letterbox recipients?',
    a: 'DropTrack does not collect personal information about the people who receive your flyers. We pin the GPS location of the letterbox, not the identity of the resident. We do not buy, sell or hold any consumer marketing lists.',
  },
  {
    q: 'Who has access to my campaign data inside DropTrack?',
    a: 'Three groups: you and any team members you grant access to; the assigned dropper for the duration of their job (location data only); the DropTrack ops team for support and Fraud Shield review. No third parties. No data brokers. Ever.',
  },
  {
    q: 'Is DropTrack SOC 2 or ISO 27001 certified?',
    a: 'Not yet. We are operating to SOC 2 controls as a small AU-based team and intend to formalise certification by FY2027. AWS infrastructure underneath is SOC 2, ISO 27001 and IRAP-assessed already, which covers the underlying compute, storage and identity layer.',
  },
];

export default function TrustPage() {
  return (
    <>
      <FaqJsonLd items={FAQ} />

      <PageHero
        eyebrow="Trust · Privacy · Compliance"
        title={
          <>
            Built for the <span className="gradient-text">Australian standard.</span>
          </>
        }
        intro={
          <>
            DropTrack is an AU-founded, AU-hosted, AU-staffed platform. Every architectural choice
            we make starts with: does this hold up under the Privacy Act 1988 and the next round of
            APP guidance?
          </>
        }
        cta={
          <a href={whatsappLink()} target="_blank" rel="noopener" className="btn-primary">
            <MessageCircle size={14} /> Ask our team a compliance question
          </a>
        }
      />

      <section className="mx-auto max-w-[1280px] px-5">
        <div className="grid md:grid-cols-2 gap-5">
          {PILLARS.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.title} delay={i * 0.05}>
                <GlassCard className="h-full">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))',
                        border: '1px solid rgba(129,140,248,0.35)',
                      }}
                    >
                      <Icon size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg mb-2">{p.title}</h3>
                      <p className="text-text-secondary text-sm leading-relaxed">{p.body}</p>
                    </div>
                  </div>
                </GlassCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 mt-32">
        <SectionHeading
          eyebrow="Compliance & privacy"
          title="The questions we are asked by every legal team."
        />
        <Faq items={FAQ} />
      </section>

      <CTABanner />
    </>
  );
}
