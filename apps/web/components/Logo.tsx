'use client';
import { useId } from 'react';

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** White border thickness in SVG units (0 to disable). Default 3.5. */
  borderWidth?: number;
}

/**
 * DropTrack mark — teardrop pin with thick white border + verified-drop dot inside.
 * Pure SVG, scales from 16px favicon to 256px hero.
 */
export function LogoMark({ size = 40, className, borderWidth = 3.5 }: LogoMarkProps) {
  const gid = `dt-grad-${useId().replace(/:/g, '')}`;
  return (
    <svg
      width={size}
      height={size * (44 / 36)}
      viewBox="0 0 36 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="6" y1="2" x2="32" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="55%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#a3e635" />
        </linearGradient>
      </defs>
      <path
        d="M18 2C9.163 2 2 9.163 2 18c0 4.74 3.39 10.07 7.08 14.41C12.79 36.78 16.7 40.62 17.4 41.32a.85.85 0 0 0 1.2 0c.7-.7 4.61-4.54 8.32-8.91C30.61 28.07 34 22.74 34 18 34 9.163 26.837 2 18 2Z"
        fill={`url(#${gid})`}
        stroke={borderWidth > 0 ? 'white' : 'none'}
        strokeWidth={borderWidth}
        strokeLinejoin="round"
      />
      <circle cx="18" cy="16" r="6.5" fill="white" />
      <circle cx="18" cy="16" r="3" fill="#a3e635" />
    </svg>
  );
}

/** Stylised "T" with extended crossbar — used in the wordmark. */
function LogoT() {
  return (
    <svg
      height="0.78em"
      viewBox="0 0 28 22"
      fill="currentColor"
      className="inline-block"
      style={{ verticalAlign: '0.04em' }}
      aria-hidden="true"
    >
      <rect x="0" y="0" width="28" height="4" rx="2" />
      <rect x="11" y="4" width="6" height="18" rx="1.2" />
    </svg>
  );
}

interface LogoProps {
  size?: number;
  /** Override wordmark color — defaults to currentColor (inherits). */
  className?: string;
  /** Where the logo links to. Defaults to the marketing site home. */
  href?: string;
}

export function Logo({
  size = 40,
  className,
  href = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://droptrack.com.au',
}: LogoProps) {
  return (
    <a
      href={href}
      aria-label="DropTrack home"
      className={`flex items-center gap-3 select-none group cursor-pointer ${className ?? ''}`}
    >
      <LogoMark
        size={size}
        className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
      />
      <span className="text-[1.75rem] font-extrabold tracking-tight leading-none flex items-baseline">
        Drop<LogoT />rack
      </span>
    </a>
  );
}
