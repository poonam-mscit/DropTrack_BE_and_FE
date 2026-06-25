#!/usr/bin/env bash
#
# DropTrack marketing — S3 + CloudFront deploy.
#
# Required env vars:
#   S3_BUCKET                e.g. droptrack-com-au
#   AWS_REGION               e.g. ap-southeast-2
#   CLOUDFRONT_DISTRIBUTION  (optional) CloudFront distribution id; if set, an invalidation is created
#
# Two-pass sync so we get the cache headers right:
#   1. Hashed Next.js assets in /_next/static  → cache 1 year, immutable
#   2. Everything else (HTML, sitemap, robots) → no-cache
#
set -euo pipefail

cd "$(dirname "$0")/.."

: "${S3_BUCKET:?S3_BUCKET env var is required}"
: "${AWS_REGION:?AWS_REGION env var is required}"

echo "→ Building marketing site (static export)..."
pnpm build

if [ ! -d out ]; then
  echo "✗ out/ directory missing — static export failed."
  exit 1
fi

echo "→ Uploading /_next/static (long cache, immutable)..."
aws s3 sync out/_next/static "s3://${S3_BUCKET}/_next/static" \
  --region "${AWS_REGION}" \
  --delete \
  --cache-control "public, max-age=31536000, immutable"

echo "→ Uploading the rest (no-cache HTML, etc.)..."
aws s3 sync out "s3://${S3_BUCKET}" \
  --region "${AWS_REGION}" \
  --delete \
  --exclude "_next/static/*" \
  --cache-control "public, max-age=0, must-revalidate"

if [ -n "${CLOUDFRONT_DISTRIBUTION:-}" ]; then
  echo "→ Invalidating CloudFront (${CLOUDFRONT_DISTRIBUTION})..."
  aws cloudfront create-invalidation \
    --distribution-id "${CLOUDFRONT_DISTRIBUTION}" \
    --paths "/*" \
    --query 'Invalidation.Id' --output text
else
  echo "→ Skipping CloudFront invalidation (CLOUDFRONT_DISTRIBUTION not set)."
fi

echo "✓ Deploy complete → https://${S3_BUCKET}"
