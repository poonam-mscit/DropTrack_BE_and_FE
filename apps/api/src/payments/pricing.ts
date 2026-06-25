/**
 * Pricing engine for DropTrack campaigns.
 *
 * Rates are runtime-tunable via the `app_settings` table (admin UI). Callers
 * fetch the live config from SettingsService and pass it into priceForLeaflets.
 * DEFAULTS below match the production-launch numbers and are used as fallbacks
 * (or for tests) when settings haven't been written.
 *
 * All values are in CENTS (integer).
 */

export const DEFAULT_PRICING_CONFIG = {
  basePerLeafletCents: 20, // AUD $0.20 / leaflet
  platformFeePct: 0.03, // 3%
  gstPct: 0.1, // AU GST 10%
} as const;

export interface PricingConfig {
  basePerLeafletCents: number;
  platformFeePct: number;
  gstPct: number;
}

export interface PriceBreakdown {
  leafletCount: number;
  ratePerLeafletCents: number;
  subtotalCents: number;
  platformFeeCents: number;
  netCents: number; // subtotal + fee
  gstCents: number;
  totalCents: number;
}

export function priceForLeaflets(
  leafletCount: number,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): PriceBreakdown {
  if (!Number.isInteger(leafletCount) || leafletCount < 1) {
    throw new Error('leafletCount must be a positive integer');
  }
  const ratePerLeafletCents = config.basePerLeafletCents;
  const subtotalCents = Math.round(leafletCount * ratePerLeafletCents);
  const platformFeeCents = Math.round(subtotalCents * config.platformFeePct);
  const netCents = subtotalCents + platformFeeCents;
  const gstCents = Math.round(netCents * config.gstPct);
  const totalCents = netCents + gstCents;
  return {
    leafletCount,
    ratePerLeafletCents,
    subtotalCents,
    platformFeeCents,
    netCents,
    gstCents,
    totalCents,
  };
}

export function formatCentsAud(cents: number): string {
  return (cents / 100).toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
  });
}
