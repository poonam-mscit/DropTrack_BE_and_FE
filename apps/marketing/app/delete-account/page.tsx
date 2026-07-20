import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/components/sections/LegalLayout';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Delete Your Account',
  description:
    'How to request deletion of your DropTrack account and any personal data we hold about you.',
  alternates: { canonical: `${SITE.url}/delete-account` },
};

const LAST_UPDATED = '2 July 2026';

export default function DeleteAccountPage() {
  return (
    <LegalLayout
      title="Delete Your Account"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          Drop Track Pty Ltd (ABN 39 697 128 920, trading as &ldquo;DropTrack&rdquo;) provides
          multiple ways for you to request deletion of your DropTrack account and the personal
          information we hold about you. This page describes the process, what happens once you
          submit a request, and which data we are legally required to retain after deletion.
        </>
      }
    >
      <LegalSection id="delete-section-1" title="How to request account deletion">
        <p>
          You can request deletion of your DropTrack account by any of the following methods.
          Each method reaches the same team and is processed on the same timeline.
        </p>
        <ul className="list-disc pl-6 mt-3 space-y-2">
          <li>
            <strong>Email us</strong> at{' '}
            <a className="text-primary hover:underline" href="mailto:hello@droptrack.com.au">
              hello@droptrack.com.au
            </a>{' '}
            from the address associated with your account. Subject line:{' '}
            <em>&ldquo;Delete my DropTrack account&rdquo;</em>. No further information is required &mdash;
            we verify your identity via the sender email.
          </li>
          <li>
            <strong>Inside the DropTrack Dropper mobile app</strong>: tap your profile avatar
            (top right) &rarr; <em>Profile &amp; settings</em> &rarr; scroll to the bottom &rarr;{' '}
            <em>Request account deletion</em>. This opens an in-app email draft addressed to us.
          </li>
          <li>
            <strong>On the DropTrack web portal</strong>:{' '}
            <a className="text-primary hover:underline" href="https://portal.droptrack.com.au/profile">
              portal.droptrack.com.au/profile
            </a>{' '}
            &rarr; scroll to <em>Danger zone</em> &rarr; <em>Request account deletion</em>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="delete-section-2" title="What we delete">
        <p>
          Once we verify your request, we permanently delete the following within{' '}
          <strong>30 days</strong>:
        </p>
        <ul className="list-disc pl-6 mt-3 space-y-2">
          <li>Your user profile (name, email, phone, date of birth, address).</li>
          <li>Your business profile, logo and branding data (client accounts).</li>
          <li>Your dropper profile, TFN, super and bank details (dropper accounts).</li>
          <li>Draft campaigns you created but did not confirm.</li>
          <li>GPS location traces recorded during your delivery jobs.</li>
          <li>In-app notifications, chat history and preferences.</li>
          <li>Your AWS Cognito identity (removes ability to sign in).</li>
        </ul>
      </LegalSection>

      <LegalSection id="delete-section-3" title="What we retain after deletion">
        <p>
          Australian taxation and consumer-protection law requires us to keep certain records
          even after you delete your account. The following data is retained in read-only,
          anonymised form:
        </p>
        <ul className="list-disc pl-6 mt-3 space-y-2">
          <li>
            <strong>Tax invoices and payment records</strong> (client accounts): retained for
            seven (7) years to satisfy Australian Taxation Office requirements under the{' '}
            <em>Income Tax Assessment Act 1997</em>.
          </li>
          <li>
            <strong>Payroll and superannuation records</strong> (dropper accounts): retained for
            seven (7) years to satisfy the <em>Fair Work Act 2009</em> and{' '}
            <em>Superannuation Guarantee (Administration) Act 1992</em>.
          </li>
          <li>
            <strong>Completed campaign coverage reports</strong> (aggregated): retained
            indefinitely in anonymised form so historical campaigns commissioned by a client
            still show the work that was completed. Your personal identifiers are stripped.
          </li>
          <li>
            <strong>Security and fraud logs</strong>: retained for two (2) years to detect and
            prevent misuse.
          </li>
        </ul>
        <p className="mt-4">
          Retained records are stored on encrypted infrastructure in AWS Sydney
          (ap-southeast-2) and are not used for any purpose other than legal compliance.
        </p>
      </LegalSection>

      <LegalSection id="delete-section-4" title="Timeline">
        <p>
          After we receive your request:
        </p>
        <ul className="list-disc pl-6 mt-3 space-y-2">
          <li>
            <strong>Within 2 business days</strong>: we email you to confirm receipt and, if we
            cannot verify the request from the sending address, we ask a follow-up question.
          </li>
          <li>
            <strong>Within 30 days</strong>: your account and personal data are permanently
            deleted, and we email you a confirmation of what was removed and what was retained
            (per section 3).
          </li>
          <li>
            <strong>Cognito sign-in</strong>: your ability to log in is revoked immediately when
            you submit the request &mdash; you do not have to wait 30 days to be locked out.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="delete-section-5" title="Cancelling a deletion request">
        <p>
          If you change your mind, email{' '}
          <a className="text-primary hover:underline" href="mailto:hello@droptrack.com.au">
            hello@droptrack.com.au
          </a>{' '}
          within seven (7) days of your original request. After seven days, the deletion
          workflow becomes irreversible and you will need to create a new account (client) or be
          re-invited (dropper) to use DropTrack again.
        </p>
      </LegalSection>

      <LegalSection id="delete-section-6" title="Questions">
        <p>
          For questions about this process or the data we hold about you, contact us at{' '}
          <a className="text-primary hover:underline" href="mailto:hello@droptrack.com.au">
            hello@droptrack.com.au
          </a>
          . You can also read our full{' '}
          <Link className="text-primary hover:underline" href="/privacy">
            Privacy Policy
          </Link>{' '}
          for details on how we handle personal information.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Drop Track Pty Ltd &middot; ABN 39 697 128 920 &middot; 42/21 Braybrooke Street, Bruce
          ACT 2617
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
