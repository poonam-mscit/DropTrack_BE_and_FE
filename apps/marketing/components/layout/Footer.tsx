import Link from 'next/link';
import { MessageCircle, Mail } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { SITE, whatsappLink } from '@/lib/site';

const PRODUCT = [
  { href: '/features', label: 'Features' },
  { href: '/industries', label: 'Industries' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/faq', label: 'FAQ' },
];
const COMPANY = [
  { href: '/about', label: 'About' },
  { href: '/trust', label: 'Trust & security' },
  { href: '/demo', label: 'Book a demo' },
];
const LEGAL = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/cookies', label: 'Cookie Policy' },
];

export function Footer() {
  return (
    <footer className="relative z-10 mt-32 border-t border-border-subtle">
      <div className="mx-auto max-w-[1280px] px-5 py-16">
        <div className="grid md:grid-cols-5 gap-10 md:gap-6">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-4 text-text-secondary text-sm max-w-sm leading-relaxed">
              {SITE.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href={whatsappLink()} target="_blank" rel="noopener" className="btn-ghost">
                <MessageCircle size={14} /> WhatsApp
              </a>
              <a href={`mailto:${SITE.email}`} className="btn-ghost">
                <Mail size={14} /> {SITE.email}
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[.18em] text-text-muted font-bold mb-4">
              Product
            </h4>
            <ul className="flex flex-col gap-2">
              {PRODUCT.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[.18em] text-text-muted font-bold mb-4">
              Company
            </h4>
            <ul className="flex flex-col gap-2">
              {COMPANY.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[.18em] text-text-muted font-bold mb-4">
              Legal
            </h4>
            <ul className="flex flex-col gap-2">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-border-subtle flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} {SITE.name}. Built in {SITE.addressLocality}, Australia.
          </p>
          <p className="text-xs text-text-muted">
            Privacy Act 1988 compliant · Data hosted in AWS Sydney (ap-southeast-2)
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-border-subtle text-center">
          <p className="text-xs text-text-muted">
            Powered by{' '}
            <a
              href="https://thelinetech.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-text-secondary hover:text-text-primary transition-colors"
            >
              thelinetech.uk
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
