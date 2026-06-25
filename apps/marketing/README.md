# @droptrack/marketing

Static marketing website for DropTrack — `droptrack.com.au`. Built with Next.js static export, deployed to S3 + CloudFront.

## Run locally

```bash
pnpm --filter @droptrack/marketing dev      # http://localhost:3003
pnpm --filter @droptrack/marketing build    # generates out/
pnpm --filter @droptrack/marketing preview  # serves out/ statically on :3003
```

## Before going live

- [ ] Replace WhatsApp placeholder `61400000000` in `lib/site.ts`
- [ ] Add real ABN in `lib/site.ts`
- [ ] Drop a real `og.png` (1200×630) into `public/`
- [ ] Add favicon at `app/icon.png`

## Deploy to S3 + CloudFront

### One-time AWS setup

1. **S3 bucket** (Sydney) — name it `droptrack-com-au`. Block public access OFF for now (CloudFront OAC replaces this in step 4). Static website hosting can be left OFF.

2. **Upload once** so the bucket isn't empty:
   ```bash
   cd apps/marketing
   pnpm build
   aws s3 sync out/ s3://droptrack-com-au --region ap-southeast-2
   ```

3. **ACM cert** in **us-east-1** (CloudFront requires global). Request a public cert for `droptrack.com.au` + `www.droptrack.com.au`, validate via DNS.

4. **CloudFront distribution**
   - Origin → your S3 bucket, use **Origin Access Control** (creates a bucket policy that locks the bucket to this distribution only)
   - Viewer protocol: redirect HTTP → HTTPS
   - Alternate domain names (CNAMEs): `droptrack.com.au`, `www.droptrack.com.au`
   - Custom SSL cert: pick the ACM cert from step 3
   - Default root object: `index.html`
   - Compress objects: ON

5. **CloudFront Function** for pretty URLs — paste `scripts/cloudfront-rewrite.js` into:
   - CloudFront → Functions → Create function (runtime cloudfront-js-2.0)
   - Associate with the distribution's default behavior, event type **Viewer request**

6. **Custom error responses** in the distribution:
   - 403 → `/404.html`, status 404
   - 404 → `/404.html`, status 404

7. **Route 53** — point both `droptrack.com.au` and `www.droptrack.com.au` A/AAAA records to the CloudFront distribution (alias).

### Recurring deploys

```bash
S3_BUCKET=droptrack-com-au \
AWS_REGION=ap-southeast-2 \
CLOUDFRONT_DISTRIBUTION=E1XXXXXXXXXX \
pnpm --filter @droptrack/marketing deploy
```

That script (`scripts/deploy-s3.sh`):
- Runs `pnpm build` → `out/`
- Syncs `out/_next/static/*` with `Cache-Control: max-age=31536000, immutable`
- Syncs everything else with `Cache-Control: max-age=0, must-revalidate`
- Creates a CloudFront invalidation on `/*` so users see the new HTML immediately

The IAM user running this needs `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on the bucket and `cloudfront:CreateInvalidation` on the distribution.

## Stack

- Next.js 15 App Router · `output: 'export'`, `trailingSlash: true`
- Tailwind v4 (tokens in `app/globals.css`)
- Framer Motion (mesh-gradient drift, scroll reveals, tab transitions)
- Lucide icons
- All animations respect `prefers-reduced-motion`

## SEO + AEO

- [x] Per-page metadata + canonical URLs
- [x] JSON-LD: Organization, Service, FAQPage on every page
- [x] Open Graph + Twitter cards
- [x] sitemap.xml (auto, static)
- [x] robots.txt (auto, static)
- [x] llms.txt for AI search engines
- [x] AU spelling and English

## Architecture notes

- Static export → zero runtime cost, plain HTML/JS/CSS in S3
- All `'use client'` components hydrate on the client (Framer Motion, accordion, tabs)
- Glass cards use real backdrop-filter — Safari 14+ and modern Chrome only
- The dev API and webapp run on `:3001` and `:3002` — marketing on `:3003`
