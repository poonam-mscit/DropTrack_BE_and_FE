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
  founder: 'Joy Patel',
  founderTitle: 'Founder & CEO',
  // WhatsApp click-to-chat. Format: 614XXXXXXXX (no plus, no spaces).
  whatsappNumber: '61499912090',
  whatsappMessage: 'Hi DropTrack, I\'d like to book a demo.',
  email: 'hello@droptrack.com.au',
  addressLocality: 'Canberra',
  addressRegion: 'ACT',
  addressCountry: 'AU',
};

export const whatsappLink = () => {
  const text = encodeURIComponent(SITE.whatsappMessage);
  return `https://wa.me/${SITE.whatsappNumber}?text=${text}`;
};

export const NAV = [
  { href: '/features', label: 'Features' },
  { href: '/industries', label: 'Industries' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/faq', label: 'FAQ' },
  { href: '/trust', label: 'Trust' },
  { href: '/about', label: 'About' },
];
