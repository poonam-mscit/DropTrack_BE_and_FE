/**
 * Admin endpoints for managing DropTrack accounts.
 *
 *   GET    /api/admin/users          — list every user in the local DB
 *   POST   /api/admin/users          — create Cognito user + DropTrack profile in one shot
 *   PATCH  /api/admin/users/:id/role — change role
 *   PATCH  /api/admin/users/:id/status — suspend / reactivate (also toggles Cognito enable/disable)
 *
 * All endpoints require role=admin.
 */
import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe, createZodDto } from 'nestjs-zod';
import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { users } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { Roles } from '../auth/auth.decorators.js';
import { CognitoAuthService } from '../auth/cognito-auth.service.js';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  role: z.enum(['client', 'dropper', 'admin']),
});
class CreateUserDto extends createZodDto(CreateUserSchema) {}

const RoleSchema = z.object({ role: z.enum(['client', 'dropper', 'admin']) });
class RoleDto extends createZodDto(RoleSchema) {}

const StatusSchema = z.object({ status: z.enum(['active', 'suspended']) });
class StatusDto extends createZodDto(StatusSchema) {}

@Roles('admin')
@Controller('admin/users')
export class UsersAdminController {
  constructor(
    private readonly cognito: CognitoAuthService,
    @Inject(DB) private readonly db: Database,
  ) {}

  @Get()
  async list() {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
        cognitoSub: users.cognitoSub,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    return rows;
  }

  @Post()
  async create(@Body(new ZodValidationPipe(CreateUserSchema)) body: CreateUserDto) {
    // 1. Reject duplicates in our DB up front.
    const [existing] = await this.db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (existing) {
      throw new BadRequestException('A DropTrack user already exists for this email.');
    }

    // 2. Provision in Cognito (idempotent — if it already exists there, we attach to it).
    const cog = await this.cognito.adminCreateUser({ email: body.email, name: body.name });

    // 3. Mirror in our DB. cognitoSub will be backfilled on first login.
    const [created] = await this.db
      .insert(users)
      .values({
        email: body.email,
        role: body.role,
        status: 'active',
        cognitoSub: `pending-${body.email}`, // backfilled on first successful login
      })
      .returning({ id: users.id, email: users.email, role: users.role });

    return {
      ...created,
      tempPassword: cog.tempPassword,
      cognitoExisted: cog.existed,
      message: cog.existed
        ? 'Cognito user already existed — linked to new DropTrack profile. Password unchanged.'
        : 'Account created. Share the temp password with the user — they will be forced to change it on first login.',
    };
  }

  @Patch(':id/role')
  async setRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RoleSchema)) body: RoleDto,
  ) {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row) throw new NotFoundException('User not found');
    await this.db.update(users).set({ role: body.role }).where(eq(users.id, id));
    return { id, role: body.role };
  }

  @Patch(':id/status')
  async setStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(StatusSchema)) body: StatusDto,
  ) {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row) throw new NotFoundException('User not found');

    await this.db.update(users).set({ status: body.status }).where(eq(users.id, id));

    // Mirror to Cognito so suspended users actually can't sign in.
    if (this.cognito.isEnabled()) {
      try {
        if (body.status === 'suspended') {
          await this.cognito.adminDisableUser(row.email);
        } else {
          await this.cognito.adminEnableUser(row.email);
        }
      } catch (err) {
        // Don't fail the DB write if Cognito is degraded — log it.
        console.warn(`Cognito ${body.status} sync failed:`, (err as Error).message);
      }
    }

    return { id, status: body.status };
  }
}
