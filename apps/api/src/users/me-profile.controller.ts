/**
 * Self-service profile endpoints for the signed-in user.
 *
 *   GET   /api/me/profile  → consolidated user + business-profile row
 *   PATCH /api/me/profile  → partial update of either side
 *
 * No business profile yet? GET returns one with sensible empty defaults; PATCH
 * upserts (creates the row on first save).
 */
import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe, createZodDto } from 'nestjs-zod';
import { eq } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { businessProfiles, users } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { CurrentUser, Roles, type AuthedUser } from '../auth/auth.decorators.js';

const INDUSTRY = [
  'real_estate', 'medical', 'political', 'food', 'retail', 'education', 'government', 'other',
] as const;
const BUSINESS_SIZE = ['solo', '2_10', '11_50', '50_plus'] as const;
const AU_STATE = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;

const ProfilePatchSchema = z.object({
  // user fields
  mobile: z.string().max(20).optional().nullable(),
  // business profile fields
  businessName: z.string().min(1).max(120).optional(),
  industry: z.enum(INDUSTRY).optional(),
  businessSize: z.enum(BUSINESS_SIZE).optional().nullable(),
  abn: z.string().max(20).optional().nullable(),
  gstRegistered: z.boolean().optional(),
  addressLine1: z.string().max(200).optional().nullable(),
  suburb: z.string().max(80).optional().nullable(),
  state: z.enum(AU_STATE).optional().nullable(),
  postcode: z.string().max(8).optional().nullable(),
});
class ProfilePatchDto extends createZodDto(ProfilePatchSchema) {}

@Roles('client', 'admin')
@Controller('me')
export class MeProfileController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get('profile')
  async get(@CurrentUser() user: AuthedUser) {
    const [u] = await this.db
      .select({
        id: users.id,
        email: users.email,
        mobile: users.mobile,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const [bp] = await this.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, user.id))
      .limit(1);

    return {
      user: u,
      business: bp ?? null,
    };
  }

  @Patch('profile')
  async patch(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(ProfilePatchSchema)) body: ProfilePatchDto,
  ) {
    // Update user.mobile if provided.
    if (body.mobile !== undefined) {
      await this.db
        .update(users)
        .set({ mobile: body.mobile })
        .where(eq(users.id, user.id));
    }

    // Upsert business profile fields.
    const bpKeys = ['businessName', 'industry', 'businessSize', 'abn', 'gstRegistered', 'addressLine1', 'suburb', 'state', 'postcode'] as const;
    const bpPatch: Record<string, unknown> = {};
    for (const k of bpKeys) {
      if (body[k] !== undefined) bpPatch[k] = body[k];
    }

    if (Object.keys(bpPatch).length) {
      const [existing] = await this.db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.userId, user.id))
        .limit(1);

      if (existing) {
        await this.db
          .update(businessProfiles)
          .set({ ...bpPatch, updatedAt: new Date() })
          .where(eq(businessProfiles.userId, user.id));
      } else {
        // First save — require at least businessName + industry to create.
        const businessName = (bpPatch.businessName as string) ?? user.email.split('@')[0];
        const industry = (bpPatch.industry as (typeof INDUSTRY)[number]) ?? 'other';
        await this.db
          .insert(businessProfiles)
          .values({
            userId: user.id,
            businessName,
            industry,
            gstRegistered: (bpPatch.gstRegistered as boolean) ?? false,
            businessSize: bpPatch.businessSize as (typeof BUSINESS_SIZE)[number] | undefined,
            abn: bpPatch.abn as string | undefined,
            addressLine1: bpPatch.addressLine1 as string | undefined,
            suburb: bpPatch.suburb as string | undefined,
            state: bpPatch.state as (typeof AU_STATE)[number] | undefined,
            postcode: bpPatch.postcode as string | undefined,
          });
      }
    }

    return this.get(user);
  }
}
