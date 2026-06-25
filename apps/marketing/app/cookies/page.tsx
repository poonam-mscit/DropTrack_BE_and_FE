import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/components/sections/LegalLayout';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description:
    'Which cookies DropTrack uses, what each one does, and how to control them. Strictly-necessary only on the marketing site, no advertising or cross-site tracking.',
  alternates: { canonical: `${SITE.url}/cookies` },
};

const LAST_UPDATED = '14 May 2026';

const COOKIES = [
  {
    name: 'dt_session',
    purpose:
      'Keeps you signed in to the DropTrack app. Set only after successful login on app.droptrack.com.au.',
    duration: 'Up to 30 days, refreshed on use',
    category: 'Strictly necessary',
    set: 'app.droptrack.com.au',
  },
  {
    name: 'dt_consent',
    purpose:
      'Remembers your cookie preferences so we do not ask you again on every visit.',
    duration: '12 months',
    category: 'Strictly necessary',
    set: 'droptrack.com.au',
  },
  {
    name: 'dt_csrf',
    purpose:
      'A cross-site request forgery (CSRF) token that protects form submissions inside the DropTrack app.',
    duration: 'Session only',
    category: 'Strictly necessary',
    set: 'app.droptrack.com.au',
  },
];

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          This Cookie Policy explains how DropTrack Pty Ltd uses cookies and similar tracking
          technologies on {SITE.url} and the DropTrack application. It complements our{' '}
          <Link className="text-primary hover:underline" href="/privacy">
            Privacy Policy
          </Link>
          .
        </>
      }
    >
      <LegalSection id="what-are-cookies" title="1. What are cookies?">
        <p>
          Cookies are small text files placed on your device by your browser when you visit a
          website. They allow the site to remember your actions and preferences (such as login,
          language and other display preferences) over a period of time, so you do not have to keep
          re-entering them whenever you come back to the site or browse between pages.
        </p>
        <p>
          Similar technologies include localStorage, sessionStorage and IndexedDB — we treat these
          the same way as cookies for the purposes of this policy.
        </p>
      </LegalSection>

      <LegalSection id="how-we-use" title="2. How DropTrack uses cookies">
        <p>
          DropTrack uses cookies sparingly and only for purposes that improve the security and
          usability of the platform. Specifically, we use cookies to:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>keep you signed in to the DropTrack app between sessions;</li>
          <li>protect form submissions from cross-site request forgery (CSRF) attacks;</li>
          <li>remember your cookie preferences and notification dismissals.</li>
        </ul>
        <p>
          <strong className="text-white">We do not use</strong> advertising cookies, cross-site
          tracking pixels, social-media tracking widgets, or third-party retargeting tools.
        </p>
      </LegalSection>

      <LegalSection id="full-list" title="3. The cookies we set">
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border-strong text-left text-white">
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Purpose</th>
                <th className="py-2 pr-3 font-semibold">Duration</th>
                <th className="py-2 pr-3 font-semibold">Category</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              {COOKIES.map((c) => (
                <tr key={c.name} className="border-b border-border-subtle align-top">
                  <td className="py-3 pr-3 font-mono text-xs text-white">{c.name}</td>
                  <td className="py-3 pr-3">{c.purpose}</td>
                  <td className="py-3 pr-3 whitespace-nowrap text-xs">{c.duration}</td>
                  <td className="py-3 pr-3 whitespace-nowrap text-xs">{c.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection id="third-party" title="4. Third-party cookies">
        <p>The marketing site at {SITE.domain} sets no third-party cookies.</p>
        <p>
          The DropTrack application at app.droptrack.com.au loads a small number of third-party
          resources to function:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-white">Stripe</strong> — for hosted payment checkout. Stripe
            sets its own cookies, governed by{' '}
            <a
              className="text-primary hover:underline"
              href="https://stripe.com/au/privacy"
              rel="noopener"
              target="_blank"
            >
              Stripe's Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong className="text-white">Mapbox</strong> — for map tile rendering. Mapbox may set
            usage cookies governed by{' '}
            <a
              className="text-primary hover:underline"
              href="https://www.mapbox.com/legal/privacy"
              rel="noopener"
              target="_blank"
            >
              Mapbox's Privacy Policy
            </a>
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="control" title="5. How to control cookies">
        <p>You can control cookies in several ways:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-white">Browser settings</strong> — every modern browser lets
            you block or delete cookies. Note that blocking strictly-necessary cookies will prevent
            you from signing in to DropTrack.
          </li>
          <li>
            <strong className="text-white">Account deletion</strong> — closing your DropTrack
            account removes the server-side session that the cookies reference.
          </li>
          <li>
            <strong className="text-white">"Do Not Track"</strong> — DropTrack honours the
            browser's "Do Not Track" header by not setting any non-essential storage.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="changes" title="6. Changes to this Policy">
        <p>
          We may update this Cookie Policy from time to time. The "Last updated" date at the top of
          the page will reflect any changes. We will not add advertising, retargeting or
          cross-site-tracking cookies without explicit opt-in consent.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="7. Contact">
        <p>
          Questions about cookies? Email{' '}
          <a className="text-primary hover:underline" href={`mailto:${SITE.email}`}>
            {SITE.email}
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
