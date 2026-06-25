'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogIn, Menu, MessageCircle, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { NAV, SITE, whatsappLink } from '@/lib/site';
import { cn } from '@/lib/cn';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-50 transition-all duration-300',
        scrolled ? 'py-3' : 'py-5',
      )}
    >
      <div className="mx-auto max-w-[1280px] px-5">
        <div
          className={cn(
            'flex items-center justify-between gap-4 rounded-2xl px-5 py-3 transition-all duration-300',
            scrolled
              ? 'glass-strong shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]'
              : 'bg-transparent border border-transparent',
          )}
        >
          <Logo />
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-white/[0.04]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a
              href={`${SITE.appUrl}/login`}
              className="hidden lg:inline-flex btn-ghost"
            >
              <LogIn size={14} /> Sign in
            </a>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener"
              className="btn-primary hidden sm:inline-flex"
            >
              <MessageCircle size={14} /> Book a demo
            </a>
            <button
              onClick={() => setOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg border border-border text-text-secondary"
              aria-label="Toggle menu"
              aria-expanded={open}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden mt-2 glass-strong rounded-2xl p-3 flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/[0.04] rounded-lg"
              >
                {item.label}
              </Link>
            ))}
            <a
              href={`${SITE.appUrl}/login`}
              onClick={() => setOpen(false)}
              className="btn-ghost mt-1 justify-center"
            >
              <LogIn size={14} /> Sign in
            </a>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener"
              onClick={() => setOpen(false)}
              className="btn-primary mt-1 justify-center"
            >
              <MessageCircle size={14} /> Book a demo
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
