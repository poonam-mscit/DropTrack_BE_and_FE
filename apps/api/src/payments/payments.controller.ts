import {
  Controller,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service.js';
import { and, desc, eq, lte } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { businessProfiles, jobs, payments as paymentsTable, users } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { CurrentUser, Roles, type AuthedUser } from '../auth/auth.decorators.js';

@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly jobsService: JobsService,
    @Inject(DB) private readonly db: Database,
  ) {}

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
   * GET /api/me/invoices/:id — full data needed to render a printable invoice
   * (business profile + job + line items). Owners/admins only.
   */
  @Get('me/invoices/:id')
  @Roles('client', 'admin')
  async invoice(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    const [row] = await this.db
      .select({
        paymentId: paymentsTable.id,
        clientUserId: paymentsTable.clientUserId,
        amountNetCents: paymentsTable.amountNetCents,
        gstCents: paymentsTable.gstCents,
        platformFeeCents: paymentsTable.platformFeeCents,
        amountTotalCents: paymentsTable.amountTotalCents,
        status: paymentsTable.status,
        currency: paymentsTable.currency,
        createdAt: paymentsTable.createdAt,
        updatedAt: paymentsTable.updatedAt,
        jobCode: jobs.jobCode,
        jobTitle: jobs.title,
        leafletCount: jobs.leafletCount,
        clientEmail: users.email,
        businessName: businessProfiles.businessName,
        abn: businessProfiles.abn,
        gstRegistered: businessProfiles.gstRegistered,
        addressLine1: businessProfiles.addressLine1,
        suburb: businessProfiles.suburb,
        state: businessProfiles.state,
        postcode: businessProfiles.postcode,
      })
      .from(paymentsTable)
      .innerJoin(jobs, eq(jobs.id, paymentsTable.jobId))
      .innerJoin(users, eq(users.id, paymentsTable.clientUserId))
      .leftJoin(businessProfiles, eq(businessProfiles.userId, paymentsTable.clientUserId))
      .where(eq(paymentsTable.id, id))
      .limit(1);

    if (!row) throw new NotFoundException(`Invoice ${id} not found`);
    if (user.role !== 'admin' && row.clientUserId !== user.id) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    // Same per-user chronological numbering as the list endpoint.
    const earlier = await this.db
      .select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.clientUserId, row.clientUserId), lte(paymentsTable.createdAt, row.createdAt)))
      .orderBy(desc(paymentsTable.createdAt));
    const invoiceNumber = `INV-${String(earlier.length).padStart(5, '0')}`;

    return { ...row, invoiceNumber };
  }

}
