import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service.js';
import type { Request, Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import type { Database } from '@droptrack/db';
import { jobs, payments as paymentsTable, webhookEvents } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { CurrentUser, Public, Roles, type AuthedUser } from '../auth/auth.decorators.js';
import { PaymentsService } from './payments.service.js';

@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly jobsService: JobsService,
    @Inject(DB) private readonly db: Database,
  ) {}

  /** POST /api/jobs/:id/checkout — returns a Stripe Checkout URL. */
  @Post('jobs/:id/checkout')
  @Roles('client')
  async checkout(@Param('id') id: string) {
    return this.payments.createCheckoutSession(id);
  }

  /**
   * GET /api/me/payments — list the signed-in agent's payments (their billing/invoice history).
   * Each row carries Stripe's hosted receipt URL so the agent can click through
   * to the live tax invoice on Stripe's branded page.
   *
   * Invoice numbers are assigned per-user in chronological order (earliest = INV-00001)
   * so the user sees a stable, increasing sequence.
   */
  @Get('me/payments')
  @Roles('client', 'admin')
  async listMine(@CurrentUser() user: AuthedUser) {
    const rows = await this.db
      .select({
        id: paymentsTable.id,
        jobCode: jobs.jobCode,
        jobTitle: jobs.title,
        amountTotalCents: paymentsTable.amountTotalCents,
        status: paymentsTable.status,
        receiptUrl: paymentsTable.receiptUrl,
        cardBrand: paymentsTable.cardBrand,
        cardLast4: paymentsTable.cardLast4,
        createdAt: paymentsTable.createdAt,
        updatedAt: paymentsTable.updatedAt,
      })
      .from(paymentsTable)
      .innerJoin(jobs, eq(jobs.id, paymentsTable.jobId))
      .where(user.role === 'admin' ? eq(paymentsTable.id, paymentsTable.id) : eq(jobs.clientUserId, user.id))
      .orderBy(desc(paymentsTable.createdAt));

    // Number invoices in chronological order: oldest payment = INV-00001.
    const chrono = [...rows].sort(
      (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
    );
    const numberById = new Map<string, string>();
    chrono.forEach((r, i) => {
      numberById.set(r.id, `INV-${String(i + 1).padStart(5, '0')}`);
    });

    const data = rows.map((r) => ({
      ...r,
      invoiceNumber: numberById.get(r.id) ?? '',
    }));

    return { data };
  }

  /** GET /api/admin/payments — full invoice list across all clients. */
  @Get('admin/payments')
  @Roles('admin')
  async listAll() {
    const rows = await this.db
      .select({
        id: paymentsTable.id,
        jobId: paymentsTable.jobId,
        jobCode: jobs.jobCode,
        jobTitle: jobs.title,
        jobStatus: jobs.status,
        clientUserId: paymentsTable.clientUserId,
        amountTotalCents: paymentsTable.amountTotalCents,
        status: paymentsTable.status,
        createdAt: paymentsTable.createdAt,
        updatedAt: paymentsTable.updatedAt,
      })
      .from(paymentsTable)
      .innerJoin(jobs, eq(jobs.id, paymentsTable.jobId))
      .orderBy(desc(paymentsTable.createdAt));
    return { data: rows };
  }

  /** PATCH /api/admin/payments/:id/mark-paid — flip payment → succeeded + job → paid_unassigned. */
  @Patch('admin/payments/:id/mark-paid')
  @Roles('admin')
  async adminMarkPaid(@Param('id') id: string) {
    const result = await this.jobsService.adminMarkPaid(id);
    if (!result) throw new NotFoundException(`Payment ${id} not found`);
    return result;
  }

  /**
   * POST /api/me/billing-portal — create a Stripe Customer Portal session.
   * Returns `{ url }` for the client to redirect into; Stripe handles card updates,
   * receipts, billing-history downloads, etc. — all PCI-compliant on their side.
   */
  @Post('me/billing-portal')
  @Roles('client', 'admin')
  @HttpCode(200)
  async billingPortal(@CurrentUser() user: AuthedUser) {
    return this.payments.createCustomerPortalSession(user.id);
  }

  /**
   * POST /webhooks/stripe — receives signed events from Stripe.
   * Public — Stripe signs the body; we verify with the webhook secret.
   */
  @Public()
  @Post('/webhooks/stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!raw) throw new BadRequestException('Raw body missing — check middleware');

    let event: import('stripe').Stripe.Event;
    try {
      event = this.payments.verifyWebhook(raw, signature);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${(err as Error).message}`);
      res.status(400).send({ error: 'invalid signature' });
      return;
    }

    // Idempotency — log it.
    try {
      await this.db.insert(webhookEvents).values({
        id: event.id,
        source: 'stripe',
        payload: event as unknown as Record<string, unknown>,
      });
    } catch (err) {
      // Duplicate — Stripe re-delivered. Ack and exit.
      this.logger.log(`Duplicate webhook ${event.id} — ignored`);
      res.status(200).send({ received: true, duplicate: true });
      return;
    }

    await this.payments.handleWebhookEvent(event);
    await this.db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.id, event.id));
    res.status(200).send({ received: true });
  }
}
