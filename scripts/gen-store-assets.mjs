/**
 * Build Play Store marketing assets from SVG:
 *   • feature graphic (1024 × 500)
 *   • 5 phone screenshots (1080 × 1920)
 *
 * Each is composed at SVG-level so text/scale/vector fidelity is perfect,
 * then rasterised to PNG via sharp.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
if (!OUT) throw new Error('usage: gen-store-assets.mjs <outdir>');
fs.mkdirSync(OUT, { recursive: true });

// ── Reusable SVG chunks ──────────────────────────────────────────
const gradientDef = `
  <defs>
    <linearGradient id="mark" x1="6" y1="2" x2="32" y2="42" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset=".55" stop-color="#a855f7"/>
      <stop offset="1" stop-color="#a3e635"/>
    </linearGradient>
    <linearGradient id="brandBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0F1029"/>
      <stop offset="1" stop-color="#1a1330"/>
    </linearGradient>
    <linearGradient id="btnGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset=".55" stop-color="#a855f7"/>
      <stop offset="1" stop-color="#a3e635"/>
    </linearGradient>
  </defs>
`;

const logoMark = (x, y, size) => `
  <g transform="translate(${x - size / 2},${y - size * 44 / 36 / 2})">
    <path transform="scale(${size / 36})"
      d="M18 2C9.163 2 2 9.163 2 18c0 4.74 3.39 10.07 7.08 14.41C12.79 36.78 16.7 40.62 17.4 41.32a.85.85 0 0 0 1.2 0c.7-.7 4.61-4.54 8.32-8.91C30.61 28.07 34 22.74 34 18 34 9.163 26.837 2 18 2Z"
      fill="url(#mark)" stroke="white" stroke-width="${3.5 * 36 / size}" stroke-linejoin="round"/>
    <circle cx="${18 * size / 36}" cy="${16 * size / 36}" r="${6.5 * size / 36}" fill="#fff"/>
    <circle cx="${18 * size / 36}" cy="${16 * size / 36}" r="${3 * size / 36}" fill="#a3e635"/>
  </g>
`;

// ── 1. Feature graphic (1024 × 500) ──────────────────────────────
const feature = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  ${gradientDef}
  <rect width="1024" height="500" fill="url(#brandBg)"/>
  <circle cx="800" cy="70" r="220" fill="#7c3aed" opacity="0.15"/>
  <circle cx="900" cy="450" r="260" fill="#a3e635" opacity="0.10"/>
  ${logoMark(140, 250, 130)}
  <text x="240" y="220" font-family="Inter,Helvetica,Arial,sans-serif" font-size="72" font-weight="900" fill="#ffffff" letter-spacing="-1.6">DropTrack</text>
  <text x="240" y="278" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="500" fill="#a3e635" letter-spacing="0.5">GPS-VERIFIED LEAFLET DELIVERY</text>
  <text x="240" y="330" font-family="Inter,Helvetica,Arial,sans-serif" font-size="24" font-weight="400" fill="#e5e7eb">Track every drop. Get paid weekly.</text>
  <rect x="240" y="380" width="220" height="52" rx="26" fill="url(#btnGrad)"/>
  <text x="350" y="414" font-family="Inter,Helvetica,Arial,sans-serif" font-size="19" font-weight="800" fill="#0F1029" text-anchor="middle">START WALKING</text>
</svg>`;

// ── Helper: Phone screenshot frame ───────────────────────────────
// 1080 × 1920 canvas. Everything rendered edge-to-edge so the "phone"
// device chrome is implied. Copy sits at top, mock UI at bottom.

function screenshot({ headline, sub, mockup, accent = '#a3e635' }) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  ${gradientDef}
  <rect width="1080" height="1920" fill="url(#brandBg)"/>
  <circle cx="900" cy="180" r="260" fill="${accent}" opacity="0.10"/>

  <!-- Brand mark strip -->
  ${logoMark(90, 130, 60)}
  <text x="150" y="147" font-family="Inter,Helvetica,Arial,sans-serif" font-size="34" font-weight="800" fill="#ffffff">DropTrack</text>

  <!-- Headline block -->
  <text x="60" y="330" font-family="Inter,Helvetica,Arial,sans-serif" font-size="88" font-weight="900" fill="#ffffff" letter-spacing="-3">
    ${headline}
  </text>
  <text x="60" y="410" font-family="Inter,Helvetica,Arial,sans-serif" font-size="34" font-weight="400" fill="#a3e635" letter-spacing="0.5">
    ${sub}
  </text>

  <!-- Mockup panel -->
  ${mockup}
</svg>`;
}

// Utility: text-wrap helper isn't needed since we hand-write short strings.

// ── Screenshot 1 — Home / Jobs ────────────────────────────────────
const s1 = screenshot({
  headline: 'YOUR JOBS,',
  sub: 'in one place.',
  mockup: `
    <rect x="60" y="500" width="960" height="1360" rx="46" fill="#151428" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
    <!-- section label -->
    <text x="100" y="580" font-family="Inter,Helvetica,Arial,sans-serif" font-size="22" font-weight="700" fill="#71717a" letter-spacing="3">TODAY · 2 JUL</text>

    <!-- Active card -->
    <rect x="100" y="620" width="880" height="360" rx="28" fill="#0F1029" stroke="#a3e635" stroke-width="3"/>
    <rect x="130" y="650" width="150" height="34" rx="4" fill="#a3e635"/>
    <text x="205" y="674" font-family="Inter,Helvetica,Arial,sans-serif" font-size="18" font-weight="900" fill="#0F1029" text-anchor="middle">IN PROGRESS</text>
    <text x="130" y="740" font-family="Inter,Helvetica,Arial,sans-serif" font-size="42" font-weight="800" fill="#fff">Bondi Junction</text>
    <text x="130" y="780" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="500" fill="#a1a1aa">Belle Property · 2,500 drops</text>
    <rect x="130" y="820" width="820" height="12" rx="6" fill="rgba(255,255,255,0.08)"/>
    <rect x="130" y="820" width="480" height="12" rx="6" fill="#a3e635"/>
    <text x="130" y="890" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="700" fill="#fff">1,468 / 2,500 drops</text>
    <text x="820" y="890" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="700" fill="#a3e635" text-anchor="end">59%</text>

    <!-- Up next -->
    <rect x="100" y="1020" width="880" height="220" rx="28" fill="#0F1029" stroke="rgba(255,255,255,0.10)"/>
    <rect x="130" y="1050" width="140" height="30" rx="4" fill="rgba(255,255,255,0.10)"/>
    <text x="200" y="1071" font-family="Inter,Helvetica,Arial,sans-serif" font-size="17" font-weight="800" fill="#a1a1aa" text-anchor="middle">UP NEXT</text>
    <text x="130" y="1130" font-family="Inter,Helvetica,Arial,sans-serif" font-size="36" font-weight="700" fill="#fff">Surry Hills · 1,800 drops</text>
    <text x="130" y="1175" font-family="Inter,Helvetica,Arial,sans-serif" font-size="24" font-weight="400" fill="#71717a">Ready to start · $432 payout</text>

    <!-- Later -->
    <rect x="100" y="1280" width="880" height="200" rx="28" fill="#0F1029" opacity="0.65"/>
    <text x="130" y="1360" font-family="Inter,Helvetica,Arial,sans-serif" font-size="34" font-weight="700" fill="#fff">Newtown</text>
    <text x="130" y="1405" font-family="Inter,Helvetica,Arial,sans-serif" font-size="23" font-weight="400" fill="#71717a">Fri 5 Jul · 2,200 drops</text>

    <!-- Bottom tab bar hint -->
    <rect x="60" y="1770" width="960" height="80" fill="none"/>
    <circle cx="270" cy="1810" r="20" fill="#a3e635"/>
    <circle cx="540" cy="1810" r="14" fill="rgba(255,255,255,0.30)"/>
    <circle cx="810" cy="1810" r="14" fill="rgba(255,255,255,0.30)"/>
  `,
});

// ── Screenshot 2 — Active map + Mark Drop ─────────────────────────
const s2 = screenshot({
  headline: 'ONE TAP',
  sub: 'per drop.',
  mockup: `
    <rect x="60" y="500" width="960" height="1360" rx="46" fill="#151428" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>

    <!-- LIVE tag row -->
    <text x="100" y="580" font-family="Inter,Helvetica,Arial,sans-serif" font-size="22" font-weight="800" fill="#a3e635" letter-spacing="3">● LIVE · TRACKING</text>
    <text x="100" y="630" font-family="Inter,Helvetica,Arial,sans-serif" font-size="34" font-weight="700" fill="#fff">Bondi Junction · Zone A</text>

    <!-- Map background (mock) -->
    <rect x="100" y="680" width="880" height="720" rx="24" fill="#22223b"/>
    <!-- streets -->
    <path d="M 100 850 L 980 900" stroke="rgba(255,255,255,0.15)" stroke-width="6"/>
    <path d="M 100 1050 L 980 1000" stroke="rgba(255,255,255,0.15)" stroke-width="6"/>
    <path d="M 100 1250 L 980 1230" stroke="rgba(255,255,255,0.15)" stroke-width="6"/>
    <path d="M 300 680 L 350 1400" stroke="rgba(255,255,255,0.10)" stroke-width="4"/>
    <path d="M 620 680 L 640 1400" stroke="rgba(255,255,255,0.10)" stroke-width="4"/>
    <path d="M 820 680 L 810 1400" stroke="rgba(255,255,255,0.10)" stroke-width="4"/>
    <!-- polygon -->
    <path d="M 180 780 L 900 800 L 890 1300 L 200 1290 Z" fill="rgba(163,230,53,0.10)" stroke="#a3e635" stroke-width="4"/>
    <!-- walked trail -->
    <path d="M 250 900 Q 350 950 340 1050 Q 400 1150 550 1140 Q 700 1130 720 1230" stroke="#a3e635" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="0"/>
    <!-- drops -->
    <circle cx="250" cy="900" r="12" fill="#10B981" stroke="#fff" stroke-width="3"/>
    <circle cx="340" cy="1050" r="12" fill="#10B981" stroke="#fff" stroke-width="3"/>
    <circle cx="550" cy="1140" r="12" fill="#10B981" stroke="#fff" stroke-width="3"/>
    <circle cx="720" cy="1230" r="12" fill="#10B981" stroke="#fff" stroke-width="3"/>
    <!-- user dot -->
    <circle cx="720" cy="1230" r="30" fill="#6366f1" opacity="0.25"/>
    <circle cx="720" cy="1230" r="18" fill="#6366f1" stroke="#fff" stroke-width="4"/>

    <!-- Counter -->
    <rect x="100" y="1440" width="880" height="120" rx="24" fill="#0F1029" stroke="rgba(255,255,255,0.08)"/>
    <text x="150" y="1490" font-family="Inter,Helvetica,Arial,sans-serif" font-size="24" font-weight="500" fill="#71717a">DROPS COMPLETED</text>
    <text x="150" y="1540" font-family="Inter,Helvetica,Arial,sans-serif" font-size="52" font-weight="900" fill="#fff">247 / 500</text>
    <text x="930" y="1540" font-family="Inter,Helvetica,Arial,sans-serif" font-size="52" font-weight="900" fill="#a3e635" text-anchor="end">49%</text>

    <!-- MARK DROP button -->
    <rect x="100" y="1620" width="880" height="140" rx="70" fill="url(#btnGrad)"/>
    <text x="540" y="1710" font-family="Inter,Helvetica,Arial,sans-serif" font-size="46" font-weight="900" fill="#0F1029" text-anchor="middle">MARK DROP</text>
  `,
});

// ── Screenshot 3 — Route recap (like Strava) ──────────────────────
const s3 = screenshot({
  headline: 'PROOF YOU',
  sub: 'walked it.',
  mockup: `
    <rect x="60" y="500" width="960" height="1360" rx="46" fill="#151428" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
    <text x="540" y="580" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="700" fill="#71717a" letter-spacing="3" text-anchor="middle">CAMPAIGN COMPLETE</text>

    <!-- Route drawing -->
    <rect x="100" y="620" width="880" height="820" rx="24" fill="#22223b"/>
    <path d="M 180 700 L 900 700 L 900 1400 L 180 1400 Z" fill="rgba(163,230,53,0.05)" stroke="rgba(163,230,53,0.4)" stroke-width="3"/>
    <!-- dense route -->
    <path d="M 220 750 L 320 760 L 320 830 L 400 840 L 400 900 L 500 910 L 500 830 L 620 840 L 620 900 L 720 920 L 720 830 L 820 840 L 820 940 L 720 960 L 620 970 L 500 980 L 400 990 L 320 1000 L 220 1010 L 220 1080 L 320 1090 L 400 1100 L 500 1110 L 620 1120 L 720 1130 L 820 1140 L 820 1220 L 720 1230 L 620 1240 L 500 1250 L 400 1260 L 320 1270 L 220 1280 L 220 1350 L 900 1350"
      stroke="#f97316" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>

    <!-- Stats -->
    <rect x="100" y="1490" width="280" height="220" rx="20" fill="#0F1029"/>
    <text x="240" y="1560" font-family="Inter,Helvetica,Arial,sans-serif" font-size="22" font-weight="500" fill="#71717a" text-anchor="middle">DISTANCE</text>
    <text x="240" y="1650" font-family="Inter,Helvetica,Arial,sans-serif" font-size="70" font-weight="900" fill="#fff" text-anchor="middle">17.8</text>
    <text x="240" y="1690" font-family="Inter,Helvetica,Arial,sans-serif" font-size="24" font-weight="500" fill="#a1a1aa" text-anchor="middle">km walked</text>

    <rect x="400" y="1490" width="280" height="220" rx="20" fill="#0F1029"/>
    <text x="540" y="1560" font-family="Inter,Helvetica,Arial,sans-serif" font-size="22" font-weight="500" fill="#71717a" text-anchor="middle">COVERAGE</text>
    <text x="540" y="1650" font-family="Inter,Helvetica,Arial,sans-serif" font-size="70" font-weight="900" fill="#a3e635" text-anchor="middle">96%</text>
    <text x="540" y="1690" font-family="Inter,Helvetica,Arial,sans-serif" font-size="24" font-weight="500" fill="#a1a1aa" text-anchor="middle">of zone</text>

    <rect x="700" y="1490" width="280" height="220" rx="20" fill="#0F1029"/>
    <text x="840" y="1560" font-family="Inter,Helvetica,Arial,sans-serif" font-size="22" font-weight="500" fill="#71717a" text-anchor="middle">TIME</text>
    <text x="840" y="1650" font-family="Inter,Helvetica,Arial,sans-serif" font-size="70" font-weight="900" fill="#fff" text-anchor="middle">3h 41</text>
    <text x="840" y="1690" font-family="Inter,Helvetica,Arial,sans-serif" font-size="24" font-weight="500" fill="#a1a1aa" text-anchor="middle">on the ground</text>
  `,
});

// ── Screenshot 4 — Payout / Profile ───────────────────────────────
const s4 = screenshot({
  headline: 'GET PAID',
  sub: 'every Friday.',
  mockup: `
    <rect x="60" y="500" width="960" height="1360" rx="46" fill="#151428" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>

    <!-- Header row -->
    <circle cx="180" cy="620" r="70" fill="url(#btnGrad)"/>
    <text x="180" y="642" font-family="Inter,Helvetica,Arial,sans-serif" font-size="42" font-weight="900" fill="#0F1029" text-anchor="middle">JK</text>
    <text x="280" y="610" font-family="Inter,Helvetica,Arial,sans-serif" font-size="40" font-weight="800" fill="#fff">James Kowalski</text>
    <text x="280" y="650" font-family="Inter,Helvetica,Arial,sans-serif" font-size="24" font-weight="400" fill="#a1a1aa">EMP-1204 · Bondi</text>

    <!-- This week card -->
    <rect x="100" y="740" width="880" height="240" rx="28" fill="url(#brandBg)" stroke="rgba(163,230,53,0.3)" stroke-width="2"/>
    <text x="130" y="800" font-family="Inter,Helvetica,Arial,sans-serif" font-size="24" font-weight="700" fill="#a3e635" letter-spacing="3">THIS WEEK · PENDING</text>
    <text x="130" y="900" font-family="Inter,Helvetica,Arial,sans-serif" font-size="120" font-weight="900" fill="#fff">$847</text>
    <text x="130" y="950" font-family="Inter,Helvetica,Arial,sans-serif" font-size="24" font-weight="500" fill="#a1a1aa">3,420 drops · pays Fri 5 Jul</text>

    <!-- Bank card -->
    <rect x="100" y="1020" width="880" height="200" rx="28" fill="#0F1029" stroke="rgba(255,255,255,0.08)"/>
    <text x="130" y="1080" font-family="Inter,Helvetica,Arial,sans-serif" font-size="22" font-weight="700" fill="#71717a" letter-spacing="2">PAY DIRECT TO</text>
    <text x="130" y="1130" font-family="Inter,Helvetica,Arial,sans-serif" font-size="30" font-weight="700" fill="#fff">Commonwealth Bank</text>
    <text x="130" y="1175" font-family="Inter,Helvetica,Arial,sans-serif" font-size="24" font-weight="400" fill="#a1a1aa">BSB 062-000 · Acc •••• 4837</text>

    <!-- History rows -->
    <text x="130" y="1290" font-family="Inter,Helvetica,Arial,sans-serif" font-size="22" font-weight="700" fill="#71717a" letter-spacing="2">RECENT PAYOUTS</text>

    <rect x="100" y="1320" width="880" height="80" rx="16" fill="rgba(255,255,255,0.03)"/>
    <text x="130" y="1370" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="700" fill="#fff">Week ending 28 Jun</text>
    <text x="950" y="1370" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="800" fill="#a3e635" text-anchor="end">$1,127</text>

    <rect x="100" y="1420" width="880" height="80" rx="16" fill="rgba(255,255,255,0.03)"/>
    <text x="130" y="1470" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="700" fill="#fff">Week ending 21 Jun</text>
    <text x="950" y="1470" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="800" fill="#a3e635" text-anchor="end">$946</text>

    <rect x="100" y="1520" width="880" height="80" rx="16" fill="rgba(255,255,255,0.03)"/>
    <text x="130" y="1570" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="700" fill="#fff">Week ending 14 Jun</text>
    <text x="950" y="1570" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="800" fill="#a3e635" text-anchor="end">$1,208</text>
  `,
});

// ── Screenshot 5 — Value pitch, no UI ─────────────────────────────
const s5 = `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  ${gradientDef}
  <rect width="1080" height="1920" fill="url(#brandBg)"/>

  ${logoMark(540, 500, 260)}

  <text x="540" y="900" font-family="Inter,Helvetica,Arial,sans-serif" font-size="72" font-weight="900" fill="#fff" text-anchor="middle" letter-spacing="-2">DropTrack</text>
  <text x="540" y="970" font-family="Inter,Helvetica,Arial,sans-serif" font-size="30" font-weight="500" fill="#a3e635" text-anchor="middle" letter-spacing="1">FOR DROPPERS · BY DROPPERS</text>

  <!-- Bullets -->
  <g font-family="Inter,Helvetica,Arial,sans-serif" fill="#e5e7eb" font-size="34">
    <text x="180" y="1200">✓</text><text x="240" y="1200">GPS-verified drops</text>
    <text x="180" y="1280">✓</text><text x="240" y="1280">Live route + coverage map</text>
    <text x="180" y="1360">✓</text><text x="240" y="1360">Pause / resume any time</text>
    <text x="180" y="1440">✓</text><text x="240" y="1440">Weekly BSB payouts</text>
    <text x="180" y="1520">✓</text><text x="240" y="1520">Straightforward Aussie tax setup</text>
  </g>

  <text x="540" y="1750" font-family="Inter,Helvetica,Arial,sans-serif" font-size="26" font-weight="500" fill="#71717a" text-anchor="middle">Canberra ACT · droptrack.com.au</text>
</svg>`;

// ── Render ────────────────────────────────────────────────────────
async function toPng(name, svgString, opts = {}) {
  await sharp(Buffer.from(svgString), { density: 300 })
    .png()
    .toFile(path.join(OUT, name));
  console.log('  ✓', name);
}

await toPng('feature-graphic.png', feature);
await toPng('screenshot-1-jobs.png', s1);
await toPng('screenshot-2-active.png', s2);
await toPng('screenshot-3-route.png', s3);
await toPng('screenshot-4-payout.png', s4);
await toPng('screenshot-5-brand.png', s5);
