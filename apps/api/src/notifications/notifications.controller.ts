import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { notifications } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { CurrentUser, type AuthedUser } from '../auth/auth.decorators.js';

@Controller('me/notifications')
export class NotificationsController {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * GET /api/me/notifications?limit=&cursor=
   * Latest-first, paginated by created-at cursor. Returns rows PLUS the
   * current unread count so the caller doesn't need a second round-trip.
   */
  @Get()
  async list(
    @CurrentUser() user: AuthedUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const n = Math.min(50, Math.max(1, Number(limit) || 20));
    const cursorDate = cursor ? new Date(cursor) : null;
    if (cursorDate && Number.isNaN(cursorDate.getTime())) {
      throw new BadRequestException('cursor must be an ISO timestamp');
    }

    const rows = await this.db
      .select()
      .from(notifications)
      .where(
        cursorDate
          ? and(eq(notifications.userId, user.id), sql`${notifications.createdAt} < ${cursorDate}`)
          : eq(notifications.userId, user.id),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(n + 1);

    const nextCursor = rows.length > n ? rows[n - 1].createdAt.toISOString() : null;
    const data = rows.slice(0, n);

    const [count] = await this.db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

    return {
      data,
      nextCursor,
      unreadCount: count?.n ?? 0,
    };
  }

  /** GET /api/me/notifications/unread-count — cheap poll target. */
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthedUser) {
    const [row] = await this.db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return { unreadCount: row?.n ?? 0 };
  }

  /** PATCH /api/me/notifications/:id/read — mark a single row read. */
  @Patch(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    const [row] = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id), isNull(notifications.readAt)))
      .returning();
    if (!row) {
      // Either already read or belongs to someone else — treat as no-op success.
      return { ok: true, alreadyRead: true };
    }
    return { ok: true, alreadyRead: false };
  }

  /** POST /api/me/notifications/read-all — mark every unread row read. */
  @Post('read-all')
  @HttpCode(200)
  async markAllRead(@CurrentUser() user: AuthedUser) {
    const result = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return { ok: true, marked: result.length };
  }
}
