import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const IN  = 'apps/dropper/store-assets';
const OUT = 'apps/dropper/store-assets/ios';
fs.mkdirSync(OUT, { recursive: true });

const files = [
  'screenshot-1-jobs.png',
  'screenshot-2-active.png',
  'screenshot-3-route.png',
  'screenshot-4-payout.png',
  'screenshot-5-brand.png',
];

const NAVY = { r: 0x0F, g: 0x10, b: 0x29 };

for (const f of files) {
  const out = path.join(OUT, f);
  await sharp(path.join(IN, f))
    .resize({ width: 1284, height: 2778, fit: 'contain', background: NAVY })
    .png()
    .toFile(out);
  const meta = await sharp(out).metadata();
  console.log(`  ✓ ${f}  →  ${meta.width}×${meta.height}`);
}
