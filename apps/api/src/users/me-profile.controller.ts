/**
 * Self-service profile endpoints for the signed-in user.
 *
 *   GET   /api/me/profile  → consolidated user + business-profile row
 *   PATCH /api/me/profile  → partial update of either side
 *
 * No business profile yet? GET returns one with sensible empty defaults; PATCH
 * upserts (creates the row on first save).
 */
import { BadRequestException, Body, Controller, Delete, Get, Inject, Logger, Patch, Post } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { ZodValidationPipe, createZodDto } from 'nestjs-zod';
import { eq } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { businessProfiles, dropperProfiles, users } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { CurrentUser, Roles, type AuthedUser } from '../auth/auth.decorators.js';

const S3_BUCKET = process.env.S3_BUCKET ?? '';
const S3_REGION = process.env.AWS_REGION ?? 'ap-southeast-2';
const PUBLIC_BASE = process.env.S3_PUBLIC_BASE_URL ?? `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;
const s3 = S3_BUCKET ? new S3Client({ region: S3_REGION }) : null;

const ALLOWED_LOGO_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const LogoPresignSchema = z.object({
  contentType: z.string().min(1).max(80),
  byteSize: z.number().int().min(1).max(MAX_LOGO_BYTES),
});
class LogoPresignDto extends createZodDto(LogoPresignSchema) {}

const INDUSTRY = [
  'real_estate', 'medical', 'political', 'food', 'retail', 'education', 'government', 'other',
] as const;
const BUSINESS_SIZE = ['solo', '2_10', '11_50', '50_plus'] as const;
const AU_STATE = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;

const NOTIFICATION_KEYS = ['campaignLaunched', 'campaignCompleted', 'paymentReceipts', 'weeklySummary', 'productUpdates'] as const;

const DropperPatchSchema = z.object({
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().min(1).max(60).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  suburb: z.string().max(80).optional().nullable(),
  state: z.enum(AU_STATE).optional().nullable(),
  postcode: z.string().max(8).optional().nullable(),
  emergencyContactName: z.string().max(120).optional().nullable(),
  emergencyContactPhone: z.string().max(20).optional().nullable(),
  tfn: z.string().regex(/^\d{8,9}$/).optional().nullable(),
  superFundName: z.string().max(80).optional().nullable(),
  superMemberNumber: z.string().max(40).optional().nullable(),
  bankBsb: z.string().regex(/^\d{3}-?\d{3}$/).optional().nullable(),
  bankAccountNumber: z.string().regex(/^\d{4,12}$/).optional().nullable(),
  wwccNumber: z.string().max(40).optional().nullable(),
  wwccExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  primaryZone: z.string().max(80).optional().nullable(),
}).partial();

const ProfilePatchSchema = z.object({
  // user fields
  mobile: z.string().max(20).optional().nullable(),
  notificationPrefs: z.record(z.enum(NOTIFICATION_KEYS), z.boolean()).optional().nullable(),
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

@Roles('client', 'dropper', 'admin')
@Controller('me')
export class MeProfileController {
  private readonly logger = new Logger(MeProfileController.name);
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get('profile')
  async get(@CurrentUser() user: AuthedUser) {
    const [u] = await this.db
      .select({
        id: users.id,
        email: users.email,
        mobile: users.mobile,
        role: users.role,
        notificationPrefs: users.notificationPrefs,
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

    // Dropper-side profile — full field set so the mobile profile editor can
    // hydrate every section. Sensitive fields (TFN, bank account) are masked.
    const [dp] = await this.db
      .select()
      .from(dropperProfiles)
      .where(eq(dropperProfiles.userId, user.id))
      .limit(1);

    const dpView = dp
      ? {
          employeeId: dp.employeeId,
          firstName: dp.firstName,
          lastName: dp.lastName,
          dob: dp.dob,
          photoS3Key: dp.photoS3Key,
          addressLine1: dp.addressLine1,
          suburb: dp.suburb,
          state: dp.state,
          postcode: dp.postcode,
          emergencyContactName: dp.emergencyContactName,
          emergencyContactPhone: dp.emergencyContactPhone,
          tfnLast4: dp.tfnEncrypted ? dp.tfnEncrypted.slice(-4) : null,
          superFundName: dp.superFundName,
          superMemberNumber: dp.superMemberNumber,
          bankBsb: dp.bankBsb,
          bankAccountLast4: dp.bankAccountLast4,
          wwccNumber: dp.wwccNumber,
          wwccExpiresAt: dp.wwccExpiresAt,
          primaryZone: dp.primaryZone,
          onboardingStatus: dp.onboardingStatus,
          contractSignedAt: dp.contractSignedAt,
        }
      : null;

    return {
      user: u,
      business: bp
        ? {
            ...bp,
            logoUrl: bp.logoS3Key ? `${PUBLIC_BASE}/${bp.logoS3Key}` : null,
          }
        : null,
      dropper: dpView,
    };
  }

  /**
   * PATCH /api/me/dropper-profile — partial update of the dropper's own row.
   * For MVP: TFN and full bank-account number are stored in the *_encrypted
   * columns as plaintext (TODO: real envelope encryption with KMS), and we
   * derive the public `*Last4` columns alongside.
   */
  @Patch('dropper-profile')
  async patchDropper(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(DropperPatchSchema)) body: z.infer<typeof DropperPatchSchema>,
  ) {
    const patch: Record<string, unknown> = {};
    if (body.firstName !== undefined) patch.firstName = body.firstName;
    if (body.lastName !== undefined) patch.lastName = body.lastName;
    if (body.dob !== undefined) patch.dob = body.dob;
    if (body.addressLine1 !== undefined) patch.addressLine1 = body.addressLine1;
    if (body.suburb !== undefined) patch.suburb = body.suburb;
    if (body.state !== undefined) patch.state = body.state;
    if (body.postcode !== undefined) patch.postcode = body.postcode;
    if (body.emergencyContactName !== undefined) patch.emergencyContactName = body.emergencyContactName;
    if (body.emergencyContactPhone !== undefined) patch.emergencyContactPhone = body.emergencyContactPhone;
    if (body.superFundName !== undefined) patch.superFundName = body.superFundName;
    if (body.superMemberNumber !== undefined) patch.superMemberNumber = body.superMemberNumber;
    if (body.wwccNumber !== undefined) patch.wwccNumber = body.wwccNumber;
    if (body.wwccExpiresAt !== undefined) patch.wwccExpiresAt = body.wwccExpiresAt;
    if (body.primaryZone !== undefined) patch.primaryZone = body.primaryZone;

    // TFN — store plain (TODO encrypt). Only update when supplied & non-empty.
    if (body.tfn) patch.tfnEncrypted = body.tfn;
    if (body.tfn === null) patch.tfnEncrypted = null;

    // Bank — store full digits in *_encrypted, last 4 in *_last4. Both nullable.
    if (body.bankBsb !== undefined) patch.bankBsb = body.bankBsb?.replace('-', '') ?? null;
    if (body.bankAccountNumber) {
      patch.bankAccountEncrypted = body.bankAccountNumber;
      patch.bankAccountLast4 = body.bankAccountNumber.slice(-4);
    } else if (body.bankAccountNumber === null) {
      patch.bankAccountEncrypted = null;
      patch.bankAccountLast4 = null;
    }

    if (Object.keys(patch).length === 0) return this.get(user);

    const [existing] = await this.db
      .select({ userId: dropperProfiles.userId })
      .from(dropperProfiles)
      .where(eq(dropperProfiles.userId, user.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(dropperProfiles)
        .set({ ...patch })
        .where(eq(dropperProfiles.userId, user.id));
    } else {
      // Bare-minimum required fields for an insert; the rest are nullable.
      await this.db.insert(dropperProfiles).values({
        userId: user.id,
        employeeId: `EMP-${user.id.slice(0, 4)}`,
        firstName: (patch.firstName as string) ?? (user.email.split('@')[0] ?? 'Dropper'),
        lastName: (patch.lastName as string) ?? '',
        ...patch,
      } as never);
    }

    this.logger.log(`dropper profile patched · user=${user.id} fields=${Object.keys(patch).join(',')}`);
    return this.get(user);
  }

  /**
   * POST /api/me/profile/logo/presign — returns a presigned PUT URL the browser
   * uploads to directly, plus the eventual public URL so the page can preview.
   * The DB row isn't updated until /commit is called with the same s3Key.
   */
  @Post('profile/logo/presign')
  async presignLogo(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(LogoPresignSchema)) body: LogoPresignDto,
  ) {
    if (!s3) throw new BadRequestException('S3 not configured — set S3_BUCKET in env.');
    if (!ALLOWED_LOGO_MIME.has(body.contentType)) {
      throw new BadRequestException(`Unsupported mime type "${body.contentType}". Use PNG, JPEG, WebP, or SVG.`);
    }

    const ext = body.contentType.split('/')[1]?.replace('+xml', '') ?? 'bin';
    const s3Key = `logos/${user.id}/${randomUUID()}.${ext}`;
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      ContentType: body.contentType,
      ContentLength: body.byteSize,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return {
      s3Key,
      uploadUrl,
      publicUrl: `${PUBLIC_BASE}/${s3Key}`,
      contentType: body.contentType,
      expiresIn: 300,
    };
  }

  /**
   * POST /api/me/profile/logo/commit — once the browser PUT to S3 has succeeded,
   * commit the new logo key onto the business profile row.
   */
  @Post('profile/logo/commit')
  async commitLogo(
    @CurrentUser() user: AuthedUser,
    @Body() body: { s3Key?: string },
  ) {
    const s3Key = String(body?.s3Key ?? '');
    if (!s3Key.startsWith(`logos/${user.id}/`)) {
      throw new BadRequestException('s3Key does not match this user — refused');
    }

    const [existing] = await this.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, user.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(businessProfiles)
        .set({ logoS3Key: s3Key, updatedAt: new Date() })
        .where(eq(businessProfiles.userId, user.id));
    } else {
      await this.db.insert(businessProfiles).values({
        userId: user.id,
        businessName: user.email.split('@')[0],
        industry: 'other',
        gstRegistered: false,
        logoS3Key: s3Key,
      });
    }
    this.logger.log(`profile logo committed · user=${user.id} key=${s3Key}`);
    return this.get(user);
  }

  /**
   * DELETE /api/me/profile/logo — clear the logo. Removes the S3 object
   * (best-effort) and nulls business_profiles.logo_s3_key.
   */
  @Delete('profile/logo')
  async removeLogo(@CurrentUser() user: AuthedUser) {
    const [existing] = await this.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, user.id))
      .limit(1);
    if (!existing?.logoS3Key) return this.get(user);

    if (s3) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: existing.logoS3Key }));
      } catch (err) {
        // Don't block the DB clear if S3 delete fails — log and move on.
        this.logger.warn(`S3 logo delete failed · key=${existing.logoS3Key}: ${(err as Error).message}`);
      }
    }
    await this.db
      .update(businessProfiles)
      .set({ logoS3Key: null, updatedAt: new Date() })
      .where(eq(businessProfiles.userId, user.id));
    this.logger.log(`profile logo removed · user=${user.id} key=${existing.logoS3Key}`);
    return this.get(user);
  }

  @Patch('profile')
  async patch(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(ProfilePatchSchema)) body: ProfilePatchDto,
  ) {
    // Update user fields (mobile + notification prefs).
    const userPatch: Record<string, unknown> = {};
    if (body.mobile !== undefined) userPatch.mobile = body.mobile;
    if (body.notificationPrefs !== undefined) userPatch.notificationPrefs = body.notificationPrefs;
    if (Object.keys(userPatch).length) {
      await this.db.update(users).set(userPatch).where(eq(users.id, user.id));
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
