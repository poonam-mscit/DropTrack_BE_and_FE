import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/components/sections/LegalLayout';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How DropTrack collects, uses, stores and discloses personal information under the Privacy Act 1988 and the Australian Privacy Principles.',
  alternates: { canonical: `${SITE.url}/privacy` },
};

const LAST_UPDATED = '14 May 2026';

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          DropTrack Pty Ltd ("DropTrack", "we", "our", "us") respects your privacy. This Privacy
          Policy explains how we collect, use, store, disclose and protect your personal information
          when you use our website ({SITE.url}), our applications, or our services. We comply with
          the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs).
        </>
      }
    >
      <LegalSection id="who-we-are" title="1. Who we are">
        <p>
          DropTrack is an Australian-incorporated company providing GPS-verified letterbox
          distribution services, including AI-generated campaign reporting. We are based in
          Canberra, ACT, and our infrastructure is hosted in AWS Sydney (ap-southeast-2).
        </p>
        <p>
          Our Privacy Officer can be reached at{' '}
          <a className="text-primary hover:underline" href={`mailto:${SITE.email}`}>
            {SITE.email}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="what-we-collect" title="2. What personal information we collect">
        <p>We collect the following categories of personal information:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-white">Account information:</strong> name, business name, email
            address, mobile number, business address and ABN.
          </li>
          <li>
            <strong className="text-white">Campaign information:</strong> the polygons you draw, the
            briefs you submit, the leaflet artwork you upload and the dates and locations of your
            campaigns.
          </li>
          <li>
            <strong className="text-white">Dropper information (where applicable):</strong>{' '}
            employment details, transport mode, GPS location while on shift, and performance
            metrics. This is collected from individuals we directly employ.
          </li>
          <li>
            <strong className="text-white">Payment information:</strong> we do not store payment
            card details ourselves; payments are processed by Stripe under their own privacy policy.
          </li>
          <li>
            <strong className="text-white">Technical information:</strong> IP address, browser type,
            device identifiers, pages visited, and cookies (see our{' '}
            <Link className="text-primary hover:underline" href="/cookies">
              Cookie Policy
            </Link>
            ).
          </li>
        </ul>
        <p>
          We do not collect personal information about the people who receive your flyers. We pin
          the GPS coordinates of letterboxes, never the identity of residents.
        </p>
      </LegalSection>

      <LegalSection id="how-we-use" title="3. How we use your information">
        <p>We use personal information only for the purposes for which it was collected, including:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>delivering the campaigns you commission, including GPS verification and reporting;</li>
          <li>paying our droppers and managing employment obligations;</li>
          <li>generating AI-written campaign reports using Claude 3.5 Haiku via AWS Bedrock in Sydney;</li>
          <li>improving our products and tuning Fraud Shield thresholds (using aggregated, de-identified data);</li>
          <li>responding to your enquiries and providing customer support;</li>
          <li>meeting our legal, regulatory and tax obligations in Australia.</li>
        </ul>
      </LegalSection>

      <LegalSection id="storage" title="4. Where your information is stored">
        <p>
          All personal information collected by DropTrack is stored in Amazon Web Services'
          Sydney region (ap-southeast-2). We do not replicate, back up or transfer data to any
          region outside Australia. This restriction is enforced through AWS IAM policies and is
          contractual, not aspirational.
        </p>
        <p>
          Data is encrypted at rest using AWS KMS (AES-256) and in transit using TLS 1.3.
          Authentication runs on AWS Cognito with short-lived JWT access tokens.
        </p>
      </LegalSection>

      <LegalSection id="disclosure" title="5. Who we disclose your information to">
        <p>We disclose personal information only to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-white">Our service providers</strong> — Stripe (payments),
            Amazon Web Services (hosting and AI inference), Mapbox (map tile rendering) — under
            written agreements that restrict their use to providing services to us;
          </li>
          <li>
            <strong className="text-white">Your assigned dropper</strong>, who receives the campaign
            polygon and leaflet count for the duration of their job;
          </li>
          <li>
            <strong className="text-white">Australian regulators or law enforcement</strong>, where
            we are legally required to do so.
          </li>
        </ul>
        <p>
          We do not sell personal information. We do not share information with data brokers,
          marketing networks or third-party advertising platforms.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="6. Cookies and tracking">
        <p>
          DropTrack uses a minimal set of strictly-necessary cookies and analytics cookies. We do
          not use advertising cookies or cross-site tracking. See our{' '}
          <Link className="text-primary hover:underline" href="/cookies">
            Cookie Policy
          </Link>{' '}
          for the full list.
        </p>
      </LegalSection>

      <LegalSection id="access-correction" title="7. Accessing, correcting or deleting your information">
        <p>
          You have the right to access your personal information, request correction of inaccurate
          information, and request deletion. Email{' '}
          <a className="text-primary hover:underline" href={`mailto:${SITE.email}`}>
            {SITE.email}
          </a>{' '}
          from the address on your account.
        </p>
        <p>
          Export is provided in JSON and PDF within five business days. Deletion is processed within
          30 days and is irreversible. Aggregate, anonymised statistics may be retained to improve
          the service — we will tell you exactly what before you sign up.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="8. How long we keep your information">
        <p>
          We retain personal information for as long as your DropTrack account is active, plus seven
          years after closure to meet Australian tax, employment and dispute-resolution
          obligations. Campaign GPS data is retained indefinitely in an immutable, signed form so
          your audit trail remains valid for vendor, AEC or compliance review.
        </p>
      </LegalSection>

      <LegalSection id="security" title="9. Security">
        <p>
          We take reasonable steps to protect personal information from misuse, interference, loss,
          unauthorised access, modification or disclosure. These include AWS KMS encryption, TLS
          1.3, AWS Cognito identity, scoped IAM policies, audit logging via AWS CloudTrail, and
          regular review of access by the small DropTrack team.
        </p>
        <p>
          If a notifiable data breach occurs, we will notify affected individuals and the Office of
          the Australian Information Commissioner (OAIC) in accordance with Part IIIC of the
          Privacy Act 1988.
        </p>
      </LegalSection>

      <LegalSection id="children" title="10. Children's privacy">
        <p>
          DropTrack is a B2B service and is not directed at children. We do not knowingly collect
          personal information from anyone under 18. If you believe we have collected such
          information, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="11. Changes to this Policy">
        <p>
          We may update this Privacy Policy from time to time. The "Last updated" date at the top
          of the page will reflect any changes. Material changes will be emailed to account
          holders at least 14 days before they take effect.
        </p>
      </LegalSection>

      <LegalSection id="complaints" title="12. Complaints">
        <p>
          If you believe we have breached the Australian Privacy Principles or mishandled your
          personal information, please email{' '}
          <a className="text-primary hover:underline" href={`mailto:${SITE.email}`}>
            {SITE.email}
          </a>
          . We will acknowledge your complaint within five business days and respond substantively
          within 30 days.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
