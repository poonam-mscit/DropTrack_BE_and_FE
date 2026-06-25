import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { jobs, payments, users, zones, type Job } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import type { CreateJobInput } from './jobs.dto.js';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service.js';
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from '../payments/pricing.js';
import { estimateZone, type ZoneEstimate } from './zone-estimator.js';

@Injectable()
export class JobsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly settings: SettingsService,
  ) {}

  /** Resolve the live (admin-tunable) pricing config from settings. */
  private async livePricingConfig(): Promise<PricingConfig> {
    const [base, fee, gst] = await Promise.all([
      this.settings.get<number>(SETTING_KEYS.pricingBasePerLeafletCents, DEFAULT_PRICING_CONFIG.basePerLeafletCents),
      this.settings.get<number>(SETTING_KEYS.pricingPlatformFeePct, DEFAULT_PRICING_CONFIG.platformFeePct),
      this.settings.get<number>(SETTING_KEYS.pricingGstPct, DEFAULT_PRICING_CONFIG.gstPct),
    ]);
    return { basePerLeafletCents: base, platformFeePct: fee, gstPct: gst };
  }

  async list(): Promise<(Job & { paymentStatus: string | null; amountTotalCents: number | null })[]> {
    // A job with multiple payment attempts (e.g. pending → succeeded) would
    // duplicate via the LEFT JOIN. Fetch all rows then collapse client-side,
    // preferring succeeded > pending > anything else, ties broken by recency.
    const rows = await this.db
      .select({
        job: jobs,
        paymentStatus: payments.status,
        amountTotalCents: payments.amountTotalCents,
        paymentCreatedAt: payments.createdAt,
      })
      .from(jobs)
      .leftJoin(payments, eq(payments.jobId, jobs.id))
      .orderBy(desc(jobs.createdAt));

    const rank = (s: string | null) =>
      s === 'succeeded' ? 0 : s === 'pending' ? 1 : 2;

    const bestPerJob = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const existing = bestPerJob.get(row.job.id);
      if (!existing) {
        bestPerJob.set(row.job.id, row);
        continue;
      }
      const existingRank = rank(existing.paymentStatus);
      const newRank = rank(row.paymentStatus);
      if (
        newRank < existingRank ||
        (newRank === existingRank &&
          (row.paymentCreatedAt?.getTime() ?? 0) >
            (existing.paymentCreatedAt?.getTime() ?? 0))
      ) {
        bestPerJob.set(row.job.id, row);
      }
    }

    return Array.from(bestPerJob.values())
      .sort((a, b) => b.job.createdAt.getTime() - a.job.createdAt.getTime())
      .map(({ job, paymentStatus, amountTotalCents }) => ({
        ...job,
        paymentStatus,
        amountTotalCents,
      }));
  }

  async findOne(id: string): Promise<Job | null> {
    const [row] = await this.db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    return row ?? null;
  }

  /** AI Smart Zones preview — no DB writes. Uses live (admin-set) pricing. */
  async estimate(polygon: CreateJobInput['zone'], leafletCount?: number): Promise<ZoneEstimate> {
    return estimateZone(this.db, polygon, leafletCount, 'walking', await this.livePricingConfig());
  }

  /**
   * Create a draft job + its zone in one transaction.
   * Computes Smart Zones estimate, generates a unique JOB-#### code,
   * sets the 48-hr cancellation window from `startDate`.
   */
  async create(input: CreateJobInput) {
    // Validate the client exists and is a client.
    const [client] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, input.clientUserId))
      .limit(1);
    if (!client) throw new BadRequestException(`Client ${input.clientUserId} not found`);
    if (client.role !== 'client') {
      throw new BadRequestException(`User ${client.id} is not a client (role=${client.role})`);
    }
    if (new Date(input.deadline) <= new Date(input.startDate)) {
      throw new BadRequestException('deadline must be after startDate');
    }

    const estimate = await estimateZone(
      this.db,
      input.zone,
      input.leafletCount,
      'walking',
      await this.livePricingConfig(),
    );

    return this.db.transaction(async (tx) => {
      const [codeRow] = await tx.execute<{ next_code: string }>(sql`
        SELECT 'JOB-' || LPAD(
          (COALESCE(MAX((substring(job_code from 'JOB-(\\d+)'))::int), 2800) + 1)::text,
          4,
          '0'
        ) AS next_code
        FROM jobs;
      `);
      const jobCode = codeRow?.next_code ?? `JOB-${Date.now()}`;
      const startDate = new Date(`${input.startDate}T00:00:00+10:00`);
      const cancellationWindowEndAt = new Date(startDate.getTime() - 48 * 60 * 60 * 1000);

      const [job] = await tx
        .insert(jobs)
        .values({
          jobCode,
          clientUserId: input.clientUserId,
          title: input.title,
          campaignType: input.campaignType,
          leafletCount: input.leafletCount,
          leafletSize: input.leafletSize,
          status: 'draft',
          startDate: input.startDate,
          deadline: input.deadline,
          skipNoJunkMail: input.skipNoJunkMail,
          skipApartments: input.skipApartments,
          specialInstructions: input.specialInstructions ?? null,
          cancellationWindowEndAt,
        })
        .returning();

      if (!job) throw new BadRequestException('Job insert failed');

      const [zone] = await tx
        .insert(zones)
        .values({
          jobId: job.id,
          polygon: input.zone,
          areaSqm: String(estimate.areaSqm),
          estimatedLetterboxes: estimate.estimatedLetterboxes,
          estimatedHouses: estimate.estimatedHouses,
          estimatedApartments: estimate.estimatedApartments,
          estimatedDistanceKm: String(estimate.estimatedDistanceKm),
          estimatedMinutes: estimate.estimatedMinutes,
        })
        .returning();

      return { job, zone, estimate };
    });
  }

  /**
   * Returns the zone polygon, sub-zones, and all drops as plain GeoJSON / lat-lng
   * pairs (extracted from PostGIS geography → JSON for the browser to render).
   */
  async getMapData(jobId: string) {
    const [zoneRow] = await this.db.execute<{
      polygon: unknown;
      area_sqm: string;
      estimated_letterboxes: number | null;
    }>(sql`
      SELECT
        ST_AsGeoJSON(polygon::geometry)::json AS polygon,
        area_sqm,
        estimated_letterboxes
      FROM zones
      WHERE job_id = ${jobId}
      LIMIT 1;
    `);

    const subZoneRows = await this.db.execute<{
      id: string;
      label: string;
      target_leaflets: number;
      dropper_user_id: string | null;
      polygon: unknown;
    }>(sql`
      SELECT id, label, target_leaflets, dropper_user_id,
             ST_AsGeoJSON(polygon::geometry)::json AS polygon
      FROM sub_zones
      WHERE job_id = ${jobId}
      ORDER BY label;
    `);

    const dropRows = await this.db.execute<{
      id: string;
      assignment_id: string;
      dropper_user_id: string;
      lat: number;
      lng: number;
      inside_zone: boolean;
      marked_at: string;
    }>(sql`
      SELECT d.id, d.assignment_id, d.dropper_user_id,
             ST_Y(d.location::geometry) AS lat,
             ST_X(d.location::geometry) AS lng,
             d.inside_zone,
             d.marked_at
      FROM drops d
      WHERE d.assignment_id IN (SELECT id FROM assignments WHERE job_id = ${jobId})
      ORDER BY d.marked_at;
    `);

    return {
      zone: zoneRow
        ? {
            polygon: zoneRow.polygon,
            areaSqm: Number(zoneRow.area_sqm),
            estimatedLetterboxes: zoneRow.estimated_letterboxes,
          }
        : null,
      subZones: subZoneRows.map((r) => ({
        id: r.id,
        label: r.label,
        targetLeaflets: r.target_leaflets,
        dropperUserId: r.dropper_user_id,
        polygon: r.polygon,
      })),
      drops: dropRows.map((r) => ({
        id: r.id,
        assignmentId: r.assignment_id,
        dropperUserId: r.dropper_user_id,
        lat: Number(r.lat),
        lng: Number(r.lng),
        insideZone: r.inside_zone,
        markedAt: r.marked_at,
      })),
    };
  }

  /**
   * Partial update of a draft job. Only allowed while status='draft'.
   *  - Any provided field updates that column.
   *  - If `zone` is provided, the existing zone row is replaced + Smart Zones re-runs.
   *  - The price estimate is rolled forward into `payments`-relevant fields when zone/leafletCount changes.
   */
  async updateDraft(id: string, patch: import('./jobs.dto.js').UpdateJobInput) {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    if (job.status !== 'draft') {
      throw new BadRequestException(`Cannot edit a job in status "${job.status}" — only drafts.`);
    }
    if (patch.deadline && patch.startDate && new Date(patch.deadline) <= new Date(patch.startDate)) {
      throw new BadRequestException('deadline must be after startDate');
    }

    // Decide whether we need to re-estimate (zone or leafletCount changed).
    const finalLeafletCount = patch.leafletCount ?? job.leafletCount;
    let estimate: ZoneEstimate | null = null;
    if (patch.zone) {
      estimate = await estimateZone(
        this.db,
        patch.zone,
        finalLeafletCount,
        'walking',
        await this.livePricingConfig(),
      );
    } else if (patch.leafletCount && patch.leafletCount !== job.leafletCount) {
      const [existingZone] = await this.db
        .select({ polygon: zones.polygon })
        .from(zones)
        .where(eq(zones.jobId, id))
        .limit(1);
      if (existingZone?.polygon) {
        estimate = await estimateZone(
          this.db,
          existingZone.polygon as CreateJobInput['zone'],
          finalLeafletCount,
          'walking',
          await this.livePricingConfig(),
        );
      }
    }

    return this.db.transaction(async (tx) => {
      // Build the SET clause from provided fields only.
      const jobPatch: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.title !== undefined) jobPatch.title = patch.title;
      if (patch.campaignType !== undefined) jobPatch.campaignType = patch.campaignType;
      if (patch.leafletCount !== undefined) jobPatch.leafletCount = patch.leafletCount;
      if (patch.leafletSize !== undefined) jobPatch.leafletSize = patch.leafletSize;
      if (patch.startDate !== undefined) jobPatch.startDate = patch.startDate;
      if (patch.deadline !== undefined) jobPatch.deadline = patch.deadline;
      if (patch.skipNoJunkMail !== undefined) jobPatch.skipNoJunkMail = patch.skipNoJunkMail;
      if (patch.skipApartments !== undefined) jobPatch.skipApartments = patch.skipApartments;
      if (patch.specialInstructions !== undefined) jobPatch.specialInstructions = patch.specialInstructions;

      const [updated] = await tx
        .update(jobs)
        .set(jobPatch)
        .where(eq(jobs.id, id))
        .returning();

      if (patch.zone) {
        // Replace the existing zone row so PostGIS picks up the new polygon.
        await tx.delete(zones).where(eq(zones.jobId, id));
        await tx.insert(zones).values({
          jobId: id,
          polygon: patch.zone,
          areaSqm: String(estimate?.areaSqm ?? 0),
          estimatedLetterboxes: estimate?.estimatedLetterboxes,
          estimatedHouses: estimate?.estimatedHouses,
          estimatedApartments: estimate?.estimatedApartments,
          estimatedDistanceKm: estimate ? String(estimate.estimatedDistanceKm) : undefined,
          estimatedMinutes: estimate?.estimatedMinutes,
        });
      }

      return { ...updated, estimate };
    });
  }

  /**
   * Confirm a draft → create a pending invoice (payments row) so it shows up in
   * the client's billing list. Job stays in 'draft' status until an admin marks
   * the invoice paid, at which point status transitions to 'paid_unassigned'.
   *
   * Idempotent: calling twice on the same draft reuses the existing pending payment.
   */
  async confirm(jobId: string, requesterId: string) {
    const job = await this.findOne(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    if (job.clientUserId !== requesterId) {
      throw new ForbiddenException('Not your campaign');
    }
    if (job.status !== 'draft') {
      throw new BadRequestException(`Cannot confirm a job in status "${job.status}"`);
    }

    // Reuse existing pending payment if present.
    const [existing] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.jobId, jobId))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    if (existing && existing.status === 'pending') {
      return { job, payment: existing };
    }

    // Recompute price from current zone + leaflet count.
    // We must coerce the stored geography column back to GeoJSON (the custom
    // type only defines toDriver, so a raw select returns EWKB hex).
    const [zoneRow] = await this.db.execute<{ polygon: import('@droptrack/db').GeoJsonPolygon }>(sql`
      SELECT ST_AsGeoJSON(polygon::geometry)::json AS polygon
      FROM zones
      WHERE job_id = ${jobId}
      LIMIT 1;
    `);
    if (!zoneRow) throw new BadRequestException('Job has no zone yet — cannot confirm.');

    const estimate = await estimateZone(
      this.db,
      zoneRow.polygon,
      job.leafletCount,
      'walking',
      await this.livePricingConfig(),
    );

    const [payment] = await this.db
      .insert(payments)
      .values({
        jobId: job.id,
        clientUserId: job.clientUserId,
        amountNetCents: estimate.priceBreakdown.netCents,
        gstCents: estimate.priceBreakdown.gstCents,
        platformFeeCents: estimate.priceBreakdown.platformFeeCents,
        amountTotalCents: estimate.priceBreakdown.totalCents,
        currency: 'aud',
        status: 'pending',
      })
      .returning();

    return { job, payment };
  }

  /**
   * Admin-only: mark a pending invoice as paid. Flips the linked job's status
   * from 'draft' → 'paid_unassigned', locking out client edits.
   */
  async adminMarkPaid(paymentId: string) {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);
    if (payment.status === 'succeeded') return { payment, alreadyPaid: true };

    return this.db.transaction(async (tx) => {
      const [updatedPayment] = await tx
        .update(payments)
        .set({ status: 'succeeded', updatedAt: new Date() })
        .where(eq(payments.id, paymentId))
        .returning();

      const [updatedJob] = await tx
        .update(jobs)
        .set({ status: 'paid_unassigned' })
        .where(eq(jobs.id, payment.jobId))
        .returning();

      return { payment: updatedPayment, job: updatedJob };
    });
  }

  async deleteDraft(id: string) {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    if (job.status !== 'draft') {
      throw new BadRequestException(`Cannot delete a job in status "${job.status}"`);
    }
    await this.db.delete(jobs).where(eq(jobs.id, id));
    return { deleted: true };
  }
}
