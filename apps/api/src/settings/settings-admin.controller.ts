/**
 * Admin endpoints for runtime settings — currently scoped to pricing.
 *
 *   GET   /api/admin/settings/pricing  → { basePerLeafletCents, platformFeePct, gstPct }
 *   PATCH /api/admin/settings/pricing  ← { basePerLeafletCents?, platformFeePct?, gstPct? }
 *
 * Changes propagate within ~30 seconds (settings cache TTL).
 */
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe, createZodDto } from 'nestjs-zod';
import { CurrentUser, Roles, type AuthedUser } from '../auth/auth.decorators.js';
import { SETTING_KEYS, SettingsService } from './settings.service.js';

/** Sensible defaults — used when a setting has never been written. */
const DEFAULTS = {
  basePerLeafletCents: 20,
  platformFeePct: 0.03,
  gstPct: 0.1,
};

const PricingPatchSchema = z.object({
  basePerLeafletCents: z.number().int().min(1).max(500).optional(),
  platformFeePct: z.number().min(0).max(0.5).optional(),
  gstPct: z.number().min(0).max(0.3).optional(),
});
class PricingPatchDto extends createZodDto(PricingPatchSchema) {}

@Roles('admin')
@Controller('admin/settings')
export class SettingsAdminController {
  constructor(private readonly settings: SettingsService) {}

  @Get('pricing')
  async getPricing() {
    const [base, fee, gst] = await Promise.all([
      this.settings.get<number>(SETTING_KEYS.pricingBasePerLeafletCents, DEFAULTS.basePerLeafletCents),
      this.settings.get<number>(SETTING_KEYS.pricingPlatformFeePct, DEFAULTS.platformFeePct),
      this.settings.get<number>(SETTING_KEYS.pricingGstPct, DEFAULTS.gstPct),
    ]);
    return {
      basePerLeafletCents: base,
      platformFeePct: fee,
      gstPct: gst,
      defaults: DEFAULTS,
    };
  }

  @Patch('pricing')
  async patchPricing(
    @Body(new ZodValidationPipe(PricingPatchSchema)) body: PricingPatchDto,
    @CurrentUser() user: AuthedUser,
  ) {
    const patch: Record<string, unknown> = {};
    if (body.basePerLeafletCents !== undefined) {
      patch[SETTING_KEYS.pricingBasePerLeafletCents] = body.basePerLeafletCents;
    }
    if (body.platformFeePct !== undefined) {
      patch[SETTING_KEYS.pricingPlatformFeePct] = body.platformFeePct;
    }
    if (body.gstPct !== undefined) {
      patch[SETTING_KEYS.pricingGstPct] = body.gstPct;
    }
    await this.settings.setMany(patch, user.id);
    return this.getPricing();
  }
}
