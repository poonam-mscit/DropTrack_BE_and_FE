import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CookieBanner } from '@/components/layout/CookieBanner';
import { MeshBackground } from '@/components/ui/MeshBackground';
import { SITE } from '@/lib/site';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#07070b',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    'leaflet distribution Australia',
    'letterbox drop Sydney',
    'GPS verified flyer delivery',
    'leaflet drop tracking',
    'AI letterbox marketing',
    'real estate flyer distribution',
    'political campaign letterbox',
    'clinic flyer distribution',
  ],
  authors: [{ name: SITE.founder }],
  creator: SITE.founder,
  publisher: SITE.name,
  openGraph: {
    type: 'website',
    locale: 'en_AU',
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: { canonical: SITE.url },
};

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE.name,
  url: SITE.url,
  logo: `${SITE.url}/og.png`,
  founder: { '@type': 'Person', name: SITE.founder, jobTitle: SITE.founderTitle },
  foundingDate: '2026',
  description: SITE.description,
  areaServed: { '@type': 'Country', name: 'Australia' },
  address: {
    '@type': 'PostalAddress',
    addressLocality: SITE.addressLocality,
    addressRegion: SITE.addressRegion,
    addressCountry: SITE.addressCountry,
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: SITE.email,
      areaServed: 'AU',
      availableLanguage: ['English'],
    },
  ],
};

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'Leaflet distribution and tracking',
  provider: { '@type': 'Organization', name: SITE.name, url: SITE.url },
  areaServed: { '@type': 'Country', name: 'Australia' },
  description:
    'GPS-verified letterbox distribution with AI-generated campaign reports, fraud detection, and zone planning. Built for Australian real estate agents, clinics, and political campaigns.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${inter.variable} ${instrument.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <MeshBackground />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:text-black focus:px-3 focus:py-2 focus:rounded-lg"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="relative z-10 flex-1 pt-28">
          {children}
        </main>
        <Footer />
        <CookieBanner />
      </body>
    </html>
  );
}
