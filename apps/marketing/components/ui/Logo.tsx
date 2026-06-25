'use client';
import { useId } from 'react';
import Link from 'next/link';

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * DropTrack mark — teardrop pin with thick white border + verified-drop dot.
 * Pure SVG, crisp from 16px favicon to 256px hero.
 */
export function LogoMark({ size = 38, className }: LogoMarkProps) {
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

      {/* Teardrop pin with thick white border */}
      <path
        d="M18 2C9.163 2 2 9.163 2 18c0 4.74 3.39 10.07 7.08 14.41C12.79 36.78 16.7 40.62 17.4 41.32a.85.85 0 0 0 1.2 0c.7-.7 4.61-4.54 8.32-8.91C30.61 28.07 34 22.74 34 18 34 9.163 26.837 2 18 2Z"
        fill={`url(#${gid})`}
        stroke="white"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      {/* Verified-drop indicator */}
      <circle cx="18" cy="16" r="6.5" fill="white" />
      <circle cx="18" cy="16" r="3" fill="#a3e635" />
    </svg>
  );
}

/**
 * Stylised "T" with an extended crossbar — used in the wordmark.
 * Inherits colour from the parent via currentColor, scales with font size.
 */
function LogoT({ className }: { className?: string }) {
  return (
    <svg
      height="0.78em"
      viewBox="0 0 28 22"
      fill="currentColor"
      className={`inline-block ${className ?? ''}`}
      style={{ verticalAlign: '0.04em' }}
      aria-hidden="true"
    >
      {/* Extended crossbar — wider than a regular T cap, with rounded ends */}
      <rect x="0" y="0" width="28" height="4" rx="2" />
      {/* Vertical stem, centred */}
      <rect x="11" y="4" width="6" height="18" rx="1.2" />
    </svg>
  );
}

interface LogoProps {
  href?: string;
  /** Mark pixel size — wordmark scales relative to this. Default 38. */
  size?: number;
}

export function Logo({ href = '/', size = 38 }: LogoProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 group select-none"
      aria-label="DropTrack home"
    >
      <LogoMark
        size={size}
        className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
      />
      <span className="text-[1.5rem] md:text-[1.65rem] font-extrabold tracking-tight text-white leading-none flex items-baseline">
        Drop<LogoT />rack
      </span>
    </Link>
  );
}
