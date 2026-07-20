import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Database } from '@droptrack/db';
import { notifications } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

type NotificationType =
  | 'campaign_milestone'
  | 'ai_report_ready'
  | 'payment_received'
  | 'fraud_alert'
  | 'assignment'
  | 'system';

interface EmitInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
}

/**
 * Fire-and-forget notification writer. Every service point that used to only
 * emit a realtime event now also calls `notifications.emit()` so the bell
 * has something to render. Never throws — a failed insert is logged, not
 * bubbled, because it must not prevent the underlying action (drop mark,
 * payment settlement, etc.) from succeeding.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly realtime: RealtimeGateway,
  ) {}

  async emit(input: EmitInput): Promise<void> {
    try {
      const [row] = await this.db
        .insert(notifications)
        .values({
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          linkUrl: input.linkUrl ?? null,
        })
        .returning();

      // Push over websocket so the bell badge bumps without a poll.
      // Wrapped so a realtime failure doesn't fail the notification write.
      try {
        this.realtime.emitToUser?.(input.userId, 'notification.created', {
          id: row.id,
          type: row.type,
          title: row.title,
          body: row.body,
          linkUrl: row.linkUrl,
          createdAt: row.createdAt.toISOString(),
        });
      } catch {
        // realtime is optional
      }
    } catch (err) {
      this.logger.warn(
        `notification insert failed for user=${input.userId} type=${input.type}: ${(err as Error).message}`,
      );
    }
  }
}

