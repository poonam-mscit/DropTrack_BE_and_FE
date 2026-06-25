'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Cookie, X } from 'lucide-react';

const CONSENT_KEY = 'dt_consent';

/**
 * AU-compliant cookie consent banner. Privacy-respecting by default —
 * we only set strictly-necessary cookies on the marketing site, so the banner
 * is informational rather than an opt-in gate. Dismissing it stores the
 * decision in localStorage so it doesn't reappear on every visit.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    // Defer to client only — localStorage isn't available during SSG.
    const stored = typeof window !== 'undefined' && window.localStorage.getItem(CONSENT_KEY);
    if (!stored) setVisible(true);
  }, []);

  function accept() {
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ accepted: true, date: new Date().toISOString() }),
    );
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: 24 }}
          transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
          role="dialog"
          aria-label="Cookie notice"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-32px)] max-w-[680px]"
        >
          <div className="glass-strong rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background:
                  'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))',
                border: '1px solid rgba(129,140,248,0.35)',
              }}
            >
              <Cookie size={18} className="text-primary" />
            </div>
            <p className="flex-1 text-sm text-text-secondary leading-relaxed">
              DropTrack uses only strictly-necessary cookies — no advertising, no cross-site
              tracking. See our{' '}
              <Link href="/cookies" className="text-primary hover:underline">
                Cookie Policy
              </Link>{' '}
              for the full list.
            </p>
            <div className="flex gap-2 w-full md:w-auto">
              <button onClick={accept} className="btn-primary flex-1 md:flex-none justify-center">
                Got it
              </button>
              <button
                onClick={accept}
                className="btn-ghost p-2.5 shrink-0"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
