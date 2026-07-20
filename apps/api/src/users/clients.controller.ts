import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { assignments, businessProfiles, jobs, payments, users } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { Roles } from '../auth/auth.decorators.js';

@Controller('admin/clients')
@Roles('admin')
export class ClientsController {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** GET /api/admin/clients — admin directory of client accounts. */
  @Get()
  async list() {
    const rows = await this.db
      .select({
        userId: users.id,
        email: users.email,
        status: users.status,
        createdAt: users.createdAt,
        businessName: businessProfiles.businessName,
        industry: businessProfiles.industry,
        abn: businessProfiles.abn,
        suburb: businessProfiles.suburb,
        state: businessProfiles.state,
        mobile: businessProfiles.mobile,
        totalJobs: sql<number>`(
          SELECT COUNT(*)::int FROM ${jobs} WHERE ${jobs.clientUserId} = ${users.id}
        )`,
        totalSpendCents: sql<number>`(
          SELECT COALESCE(SUM(${payments.amountTotalCents}), 0)::bigint
          FROM ${payments}
          WHERE ${payments.clientUserId} = ${users.id}
            AND ${payments.status} = 'succeeded'
        )`,
      })
      .from(users)
      .where(eq(users.role, 'client'))
      .leftJoin(businessProfiles, eq(businessProfiles.userId, users.id))
      .orderBy(desc(users.createdAt));

    return { count: rows.length, data: rows };
  }

  /**
   * GET /api/admin/clients/:userId — full client detail: account, business
   * profile, campaign history + spend breakdown.
   */
  @Get(':userId')
  async detail(@Param('userId') userId: string) {
    const [row] = await this.db
      .select({
        user: {
          id: users.id,
          email: users.email,
          status: users.status,
          mobile: users.mobile,
          createdAt: users.createdAt,
          cognitoSub: users.cognitoSub,
        },
        biz: businessProfiles,
      })
      .from(users)
      .leftJoin(businessProfiles, eq(businessProfiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) throw new NotFoundException('Client not found');
    if (row.user.status === 'active' && !row.biz) {
      // still return — biz profile may be missing on a partially-signed-up user
    }

    const campaignRows = await this.db
      .select({
        job: {
          id: jobs.id,
          jobCode: jobs.jobCode,
          title: jobs.title,
          leafletCount: jobs.leafletCount,
          campaignType: jobs.campaignType,
          startDate: jobs.startDate,
          deadline: jobs.deadline,
          status: jobs.status,
          createdAt: jobs.createdAt,
          paidAt: jobs.paidAt,
        },
        payment: {
          status: payments.status,
          amountTotalCents: payments.amountTotalCents,
        },
        assignmentsCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${assignments} WHERE ${assignments.jobId} = ${jobs.id}
        )`,
        assignedLeaflets: sql<number>`(
          SELECT COALESCE(SUM(target_leaflets), 0)::int FROM ${assignments}
          WHERE ${assignments.jobId} = ${jobs.id}
        )`,
        dropsCompleted: sql<number>`(
          SELECT COALESCE(SUM(drops_completed), 0)::int FROM ${assignments}
          WHERE ${assignments.jobId} = ${jobs.id}
        )`,
      })
      .from(jobs)
      .leftJoin(payments, eq(payments.jobId, jobs.id))
      .where(eq(jobs.clientUserId, userId))
      .orderBy(desc(jobs.createdAt));

    // Aggregate spend by payment status
    const [aggr] = await this.db
      .select({
        totalPaidCents: sql<number>`COALESCE(SUM(CASE WHEN ${payments.status} = 'succeeded' THEN ${payments.amountTotalCents} ELSE 0 END), 0)::bigint`,
        totalPendingCents: sql<number>`COALESCE(SUM(CASE WHEN ${payments.status} = 'pending' THEN ${payments.amountTotalCents} ELSE 0 END), 0)::bigint`,
        refundedCents: sql<number>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('refunded','partial_refund') THEN ${payments.amountTotalCents} ELSE 0 END), 0)::bigint`,
      })
      .from(payments)
      .where(eq(payments.clientUserId, userId));

    const biz = row.biz;
    return {
      user: {
        ...row.user,
        cognitoLinked: !!row.user.cognitoSub,
      },
      business: biz
        ? {
            businessName: biz.businessName,
            industry: biz.industry,
            businessSize: biz.businessSize,
            abn: biz.abn,
            gstRegistered: biz.gstRegistered,
            addressLine1: biz.addressLine1,
            suburb: biz.suburb,
            state: biz.state,
            postcode: biz.postcode,
            mobile: biz.mobile,
            logoS3Key: biz.logoS3Key,
            stripeCustomerId: biz.stripeCustomerId,
          }
        : null,
      spend: {
        totalPaidCents: Number(aggr?.totalPaidCents ?? 0),
        totalPendingCents: Number(aggr?.totalPendingCents ?? 0),
        refundedCents: Number(aggr?.refundedCents ?? 0),
      },
      campaigns: campaignRows,
    };
  }
}
