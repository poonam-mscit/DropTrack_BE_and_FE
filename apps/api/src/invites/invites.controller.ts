/**
 * Dropper invitation flow.
 *
 *   admin → POST /api/admin/dropper-invites    create + email link
 *   admin → GET  /api/admin/dropper-invites    list outstanding/recent
 *   public→ GET  /api/invites/:token           verify before accept (no auth)
 *   public→ POST /api/auth/accept-dropper-invite  create cognito user + DB rows
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ZodValidationPipe, createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { dropperProfiles, invites, users } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { CurrentUser, Public, Roles, type AuthedUser } from '../auth/auth.decorators.js';
import { CognitoAuthService } from '../auth/cognito-auth.service.js';

const APP_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3002';
const DROPPER_DEEP_LINK = process.env.DROPPER_DEEP_LINK_BASE || 'droptrackdropper://accept';

const InviteCreateSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60).optional(),
  primaryZone: z.string().max(80).optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});
class InviteCreateDto extends createZodDto(InviteCreateSchema) {}

const AcceptSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(10).max(64),
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().min(1).max(60).optional(),
});
class AcceptDto extends createZodDto(AcceptSchema) {}

@Controller()
export class InvitesController {
  private readonly logger = new Logger(InvitesController.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly cognito: CognitoAuthService,
  ) {}

  // ───────────────────── admin ─────────────────────

  /** POST /api/admin/dropper-invites */
  @Post('admin/dropper-invites')
  @Roles('admin')
  async create(
    @CurrentUser() admin: AuthedUser,
    @Body(new ZodValidationPipe(InviteCreateSchema)) body: InviteCreateDto,
  ) {
    // Refuse if the email already has a user (existing account, not an invite).
    const [existing] = await this.db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (existing) {
      throw new BadRequestException(`${body.email} is already a DropTrack user.`);
    }

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + body.expiresInDays * 86_400_000);
    const prefill: { firstName: string; lastName: string; primaryZone?: string } = {
      firstName: body.firstName,
      lastName: body.lastName ?? '',
    };
    if (body.primaryZone) prefill.primaryZone = body.primaryZone;

    const [row] = await this.db
      .insert(invites)
      .values({
        email: body.email,
        token,
        role: 'dropper',
        invitedByUserId: admin.id,
        prefill,
        expiresAt,
      })
      .returning();

    const acceptUrl = `${APP_BASE_URL}/accept-invite?token=${token}`;
    const deepLink = `${DROPPER_DEEP_LINK}?token=${token}`;
    this.logger.log(`dropper invite created · email=${body.email} token=…${token.slice(-6)}`);

    // TODO: send email via SES once that's wired. For MVP we return the URLs
    // so admin can copy/paste into Slack/SMS.
    return { invite: row, acceptUrl, deepLink };
  }

  /** GET /api/admin/dropper-invites — outstanding + recently accepted. */
  @Get('admin/dropper-invites')
  @Roles('admin')
  async list() {
    const rows = await this.db
      .select()
      .from(invites)
      .where(eq(invites.role, 'dropper'))
      .orderBy(desc(invites.createdAt))
      .limit(50);
    return { data: rows };
  }

  // ───────────────────── public ─────────────────────

  /** GET /api/invites/:token — used by the accept screen to prefill name. */
  @Get('invites/:token')
  @Public()
  async verify(@Param('token') token: string) {
    const [row] = await this.db
      .select()
      .from(invites)
      .where(and(eq(invites.token, token), gt(invites.expiresAt, new Date()), isNull(invites.acceptedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('Invite is invalid, used, or expired.');
    return {
      email: row.email,
      role: row.role,
      prefill: row.prefill,
      expiresAt: row.expiresAt,
    };
  }

  /** POST /api/auth/accept-dropper-invite — create the Cognito user + DB rows + dropper profile. */
  @Post('auth/accept-dropper-invite')
  @Public()
  async accept(@Body(new ZodValidationPipe(AcceptSchema)) body: AcceptDto) {
    const [invite] = await this.db
      .select()
      .from(invites)
      .where(and(eq(invites.token, body.token), gt(invites.expiresAt, new Date()), isNull(invites.acceptedAt)))
      .limit(1);
    if (!invite) throw new BadRequestException('Invite is invalid, used, or expired.');

    // 1. Cognito account.
    const sub = await this.cognito.adminCreateConfirmedUser(invite.email, body.password);

    // 2. Wrap DB writes in a transaction so a Cognito-success / DB-fail leaves
    //    us in a clean state.
    const result = await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: invite.email,
          cognitoSub: sub,
          role: invite.role,
          status: 'active',
        })
        .returning();

      const prefill = (invite.prefill ?? {}) as { firstName?: string; lastName?: string; primaryZone?: string | null };
      const firstName = body.firstName ?? prefill.firstName ?? invite.email.split('@')[0]!;
      const lastName = body.lastName ?? prefill.lastName ?? '';

      await tx.insert(dropperProfiles).values({
        userId: user.id,
        employeeId: `EMP-${user.id.slice(0, 4)}`,
        firstName,
        lastName,
        primaryZone: prefill.primaryZone ?? undefined,
      });

      await tx
        .update(invites)
        .set({ acceptedAt: new Date(), acceptedUserId: user.id })
        .where(eq(invites.id, invite.id));

      return user;
    });

    // 3. Sign the new user in so they can drop straight into the app.
    const tokens = await this.cognito.login(invite.email, body.password);

    this.logger.log(`dropper invite accepted · email=${invite.email} userId=${result.id}`);
    return {
      ...tokens,
      provisioned: true,
      userId: result.id,
      email: result.email,
      role: result.role,
    };
  }
}
