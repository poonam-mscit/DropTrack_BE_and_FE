import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import {
  assignments,
  dropperProfiles,
  drops,
  events,
  jobs,
  subZones,
  users,
} from '@droptrack/db';
import { CampaignReportService } from '../ai/campaign-report.service.js';
import { DB } from '../db/db.module.js';
import { FraudShieldService } from '../fraud/fraud-shield.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import type { CreateAssignmentsInput, MarkDropInput } from './assignments.dto.js';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly realtime: RealtimeGateway,
    private readonly reports: CampaignReportService,
    private readonly fraud: FraudShieldService,
  ) {}

  // ───────────────────────── admin: create ─────────────────────────

  async createAssignments(jobId: string, input: CreateAssignmentsInput, actorUserId: string) {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    if (job.status !== 'paid_unassigned' && job.status !== 'assigned') {
      throw new ConflictException(`Job is in status "${job.status}" — cannot assign`);
    }

    // Validate target totals don't exceed the job's leaflet count.
    const totalTarget = input.assignments.reduce((sum, a) => sum + a.targetLeaflets, 0);
    if (totalTarget > job.leafletCount) {
      throw new BadRequestException(
        `Sum of targetLeaflets (${totalTarget}) exceeds job.leafletCount (${job.leafletCount})`,
      );
    }

    // Validate every dropper exists, is a dropper, and has completed onboarding.
    const dropperIds = input.assignments.map((a) => a.dropperUserId);
    const dropperRows = await this.db
      .select({ userId: users.id, email: users.email, role: users.role, status: users.status })
      .from(users)
      .where(inArray(users.id, dropperIds));
    const dropperMap = new Map(dropperRows.map((r) => [r.userId, r]));
    for (const a of input.assignments) {
      const u = dropperMap.get(a.dropperUserId);
      if (!u) throw new BadRequestException(`Dropper ${a.dropperUserId} not found`);
      if (u.role !== 'dropper') throw new BadRequestException(`${u.email} is not a dropper`);
      if (u.status !== 'active') throw new BadRequestException(`${u.email} is ${u.status}`);
    }
    const profiles = await this.db
      .select({ userId: dropperProfiles.userId, onboardingStatus: dropperProfiles.onboardingStatus })
      .from(dropperProfiles)
      .where(inArray(dropperProfiles.userId, dropperIds));
    for (const p of profiles) {
      if (p.onboardingStatus !== 'complete') {
        const u = dropperMap.get(p.userId);
        throw new BadRequestException(`${u?.email ?? p.userId} has incomplete onboarding`);
      }
    }

    // Transactional insert: sub_zones (if provided) + assignments + job.status flip.
    return this.db.transaction(async (tx) => {
      const created: Array<{ assignmentId: string; subZoneId: string | null }> = [];

      for (const a of input.assignments) {
        let subZoneId: string | null = null;
        if (a.polygon) {
          const [sz] = await tx
            .insert(subZones)
            .values({
              jobId,
              label: a.label ?? 'Zone',
              polygon: a.polygon,
              targetLeaflets: a.targetLeaflets,
              dropperUserId: a.dropperUserId,
            })
            .returning();
          subZoneId = sz.id;
        }
        const [asgn] = await tx
          .insert(assignments)
          .values({
            jobId,
            subZoneId,
            dropperUserId: a.dropperUserId,
            assignedByUserId: actorUserId,
            status: 'pending',
          })
          .returning();
        created.push({ assignmentId: asgn.id, subZoneId });

        await tx.insert(events).values({
          actorUserId,
          subjectType: 'assignment',
          subjectId: asgn.id,
          eventType: 'assignment.created',
          data: { jobId, dropperUserId: a.dropperUserId, targetLeaflets: a.targetLeaflets },
        });
      }

      await tx.update(jobs).set({ status: 'assigned' }).where(eq(jobs.id, jobId));

      return { jobId, assignments: created, jobStatus: 'assigned' as const };
    });
  }

  // ─────────────────────── dropper: list/start/etc ──────────────────────

  async listForDropper(userId: string) {
    return this.db
      .select({
        assignment: assignments,
        job: { id: jobs.id, code: jobs.jobCode, title: jobs.title, startDate: jobs.startDate, status: jobs.status },
        subZone: subZones,
      })
      .from(assignments)
      .where(eq(assignments.dropperUserId, userId))
      .innerJoin(jobs, eq(jobs.id, assignments.jobId))
      .leftJoin(subZones, eq(subZones.id, assignments.subZoneId))
      .orderBy(desc(assignments.createdAt));
  }

  async listForJob(jobId: string) {
    return this.db
      .select({
        assignment: assignments,
        dropper: { id: users.id, email: users.email },
        subZone: subZones,
      })
      .from(assignments)
      .where(eq(assignments.jobId, jobId))
      .innerJoin(users, eq(users.id, assignments.dropperUserId))
      .leftJoin(subZones, eq(subZones.id, assignments.subZoneId));
  }

  /** Dropper transitions: pending → started → (paused ↔ started)* → completed. */
  async start(assignmentId: string, dropperUserId: string) {
    return this.transition(assignmentId, dropperUserId, 'started', (existing) => {
      if (existing.status !== 'pending' && existing.status !== 'paused') {
        throw new ConflictException(`Cannot start an assignment in status "${existing.status}"`);
      }
      return { startedAt: existing.startedAt ?? new Date() };
    });
  }

  async pause(assignmentId: string, dropperUserId: string) {
    return this.transition(assignmentId, dropperUserId, 'paused', (existing) => {
      if (existing.status !== 'started') {
        throw new ConflictException(`Cannot pause assignment in status "${existing.status}"`);
      }
      return {};
    });
  }

  async resume(assignmentId: string, dropperUserId: string) {
    return this.transition(assignmentId, dropperUserId, 'started', (existing) => {
      if (existing.status !== 'paused') {
        throw new ConflictException(`Cannot resume assignment in status "${existing.status}"`);
      }
      return {};
    });
  }

  async complete(assignmentId: string, dropperUserId: string) {
    const result = await this.transition(assignmentId, dropperUserId, 'completed', (existing) => {
      if (existing.status !== 'started' && existing.status !== 'paused') {
        throw new ConflictException(`Cannot complete assignment in status "${existing.status}"`);
      }
      return { completedAt: new Date() };
    });

    // If every assignment for this job is now completed, mark the job complete too.
    const sibling = await this.db
      .select({ status: assignments.status })
      .from(assignments)
      .where(eq(assignments.jobId, result.jobId));
    if (sibling.length > 0 && sibling.every((s) => s.status === 'completed')) {
      await this.db
        .update(jobs)
        .set({ status: 'completed', actualCompletedAt: new Date() })
        .where(eq(jobs.id, result.jobId));
      await this.db.insert(events).values({
        actorUserId: dropperUserId,
        subjectType: 'job',
        subjectId: result.jobId,
        eventType: 'job.completed',
        data: { reason: 'all_assignments_completed' },
      });
      this.realtime.emit({
        type: 'job.status',
        jobId: result.jobId,
        status: 'completed',
        at: new Date().toISOString(),
      });
      // Fire-and-forget AI Campaign Report. Failures log but don't block.
      this.reports
        .generateForJob(result.jobId)
        .then((r) => this.logger.log(`AI Report ${r.id} ready for job ${result.jobId}`))
        .catch((err) => this.logger.error(`AI Report failed: ${(err as Error).message}`));
    }
    return result;
  }

  // ─────────────────────────── drops ───────────────────────────

  async markDrop(input: MarkDropInput, dropperUserId: string) {
    const [asgn] = await this.db
      .select()
      .from(assignments)
      .where(eq(assignments.id, input.assignmentId))
      .limit(1);
    if (!asgn) throw new NotFoundException('Assignment not found');
    if (asgn.dropperUserId !== dropperUserId) {
      throw new ForbiddenException('Not your assignment');
    }
    if (asgn.status !== 'started') {
      throw new ConflictException(`Cannot mark drop in status "${asgn.status}" — start first`);
    }

    const [drop] = await this.db
      .insert(drops)
      .values({
        assignmentId: asgn.id,
        dropperUserId,
        location: input.location,
        accuracyM: input.accuracyM ?? null,
      })
      .returning({
        id: drops.id,
        insideZone: drops.insideZone,
        flaggedAnomaly: drops.flaggedAnomaly,
        accuracyM: drops.accuracyM,
        markedAt: drops.markedAt,
      });

    // Increment denormalised counter atomically.
    const [updated] = await this.db
      .update(assignments)
      .set({ dropsCompleted: sql`${assignments.dropsCompleted} + 1` })
      .where(eq(assignments.id, asgn.id))
      .returning({ dropsCompleted: assignments.dropsCompleted });

    // First drop on the assignment → also flip the job to 'active' if it isn't already.
    if (asgn.dropsCompleted === 0) {
      const [job] = await this.db.select().from(jobs).where(eq(jobs.id, asgn.jobId)).limit(1);
      if (job && job.status === 'assigned') {
        await this.db
          .update(jobs)
          .set({ status: 'active', actualStartAt: new Date() })
          .where(eq(jobs.id, asgn.jobId));
        this.realtime.emit({
          type: 'job.status',
          jobId: asgn.jobId,
          status: 'active',
          at: new Date().toISOString(),
        });
      }
    }

    // Broadcast to /job:<jobId> room.
    this.realtime.emit({
      type: 'drop.created',
      jobId: asgn.jobId,
      assignmentId: asgn.id,
      dropId: drop.id,
      dropperUserId,
      location: input.location,
      insideZone: drop.insideZone,
      markedAt: drop.markedAt.toISOString(),
      dropsCompleted: updated.dropsCompleted,
    });

    // Run Fraud Shield in the background — never blocks the drop response.
    this.fraud
      .evaluateDrop({
        dropId: drop.id,
        assignmentId: asgn.id,
        dropperUserId,
        jobId: asgn.jobId,
        location: input.location,
        accuracyM: input.accuracyM ?? null,
        markedAt: drop.markedAt,
      })
      .catch((err) =>
        this.logger.error(`Fraud Shield failed for drop ${drop.id}: ${(err as Error).message}`),
      );

    return { ...drop, dropsCompleted: updated.dropsCompleted };
  }

  // ─────────────────────────── helpers ───────────────────────────

  private async transition(
    assignmentId: string,
    dropperUserId: string,
    newStatus: 'started' | 'paused' | 'completed',
    extra: (existing: typeof assignments.$inferSelect) => Record<string, unknown>,
  ) {
    const [existing] = await this.db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);
    if (!existing) throw new NotFoundException('Assignment not found');
    if (existing.dropperUserId !== dropperUserId) {
      throw new ForbiddenException('Not your assignment');
    }
    const set = { status: newStatus, ...extra(existing) };

    const [updated] = await this.db
      .update(assignments)
      .set(set)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.dropperUserId, dropperUserId)))
      .returning();

    await this.db.insert(events).values({
      actorUserId: dropperUserId,
      subjectType: 'assignment',
      subjectId: assignmentId,
      eventType: `assignment.${newStatus}`,
      data: { from: existing.status, to: newStatus },
    });

    this.realtime.emit({
      type: 'assignment.status',
      jobId: existing.jobId,
      assignmentId,
      status: newStatus,
      dropperUserId,
      at: new Date().toISOString(),
    });

    return updated;
  }
}
