/**
 * Single source of truth for site-wide constants.
 * Search-replace WHATSAPP_NUMBER when you have the real one.
 */
export const SITE = {
  name: 'DropTrack',
  tagline: 'GPS-verified leaflet distribution for Australian agents',
  url: 'https://droptrack.com.au',
  domain: 'droptrack.com.au',
  // The agent web app. In production this is portal.droptrack.com.au; in dev
  // it points to the local Next.js webapp on :3002.
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NODE_ENV === 'production'
      ? 'https://portal.droptrack.com.au'
      : 'http://localhost:3002'),
  description:
    'Australia\'s AI-native letterbox distribution platform. Every flyer GPS-verified, every campaign reported, every dollar accounted for.',
  // Contact — company channels only. Personal names, photos and phone
  // numbers are deliberately not surfaced anywhere on the marketing site.
  email: 'hello@droptrack.com.au',
  contactSubject: 'Book a demo',
  contactBody: 'Hi DropTrack team,\n\nI\'d like to book a demo for our team.\n\nSuburb / region:\nApprox. leaflets per month:\n\nThanks,',
  addressLocality: 'Canberra',
  addressRegion: 'ACT',
  addressCountry: 'AU',
};

/**
 * Company-email contact link. Renamed from `whatsappLink` so we no longer
 * expose a personal phone number anywhere on the marketing site. All CTAs
 * that used to open WhatsApp now open the user's default mail client with
 * a prefilled "Book a demo" template.
 */
export const contactLink = () => {
  const subject = encodeURIComponent(SITE.contactSubject);
  const body = encodeURIComponent(SITE.contactBody);
  return `mailto:${SITE.email}?subject=${subject}&body=${body}`;
};

/** Deprecated alias — kept temporarily so old imports still compile.
 *  Now returns the mailto: link instead of a wa.me URL. */
export const whatsappLink = contactLink;

export const NAV = [
  { href: '/features', label: 'Features' },
  { href: '/industries', label: 'Industries' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/faq', label: 'FAQ' },
  { href: '/trust', label: 'Trust' },
  { href: '/about', label: 'About' },
];
