import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  children: ReactNode;
  className?: string;
  title?: string;
}

/**
 * Browser-chrome frame wrapping an app mockup. Adds the "real software"
 * feel — dots, address bar, glass surround.
 */
export function MockFrame({ children, className, title = 'app.droptrack.com.au' }: Props) {
  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden border border-white/10',
        'shadow-[0_50px_120px_-30px_rgba(99,102,241,0.4),0_30px_60px_-15px_rgba(0,0,0,0.6)]',
        className,
      )}
    >
      {/* Dark browser chrome (top bar only) */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a24] border-b border-white/5">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-yellow-400/70" />
          <span className="size-2.5 rounded-full bg-green-400/70" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-1 rounded-md bg-white/[0.06] border border-white/5 text-[11px] text-white/60 font-mono">
            {title}
          </div>
        </div>
      </div>
      {/* Light app content */}
      <div className="bg-[#f8f9fb]">{children}</div>
    </div>
  );
}
