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
  dropperLocations,
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
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import type { CreateAssignmentsInput, MarkDropInput, MarkLocationInput } from './assignments.dto.js';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly realtime: RealtimeGateway,
    private readonly reports: CampaignReportService,
    private readonly fraud: FraudShieldService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────────────────── admin: create ─────────────────────────

  async createAssignments(jobId: string, input: CreateAssignmentsInput, actorUserId: string) {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    if (job.status !== 'paid_unassigned' && job.status !== 'assigned') {
      throw new ConflictException(`Job is in status "${job.status}" — cannot assign`);
    }

    // How many leaflets are already covered by prior assignments on this job?
    const priorRows = await this.db
      .select({ target: assignments.targetLeaflets })
      .from(assignments)
      .where(eq(assignments.jobId, jobId));
    const priorAssigned = priorRows.reduce((s, r) => s + (r.target ?? 0), 0);

    const totalTarget = input.assignments.reduce((sum, a) => sum + a.targetLeaflets, 0);
    if (priorAssigned + totalTarget > job.leafletCount) {
      throw new BadRequestException(
        `Assigning ${totalTarget} would exceed remaining (${job.leafletCount - priorAssigned} of ${job.leafletCount}).`,
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
            targetLeaflets: a.targetLeaflets,
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
    }).then((result) => {
      // Notify the client that droppers are on the way. Fire-and-forget
      // outside the transaction so a notification insert failure can't roll
      // the assignments back.
      const n = input.assignments.length;
      void this.notifications.emit({
        userId: job.clientUserId,
        type: 'assignment',
        title: n === 1 ? 'Dropper assigned to your campaign' : `${n} droppers assigned`,
        body: `"${job.title}" is scheduled and will start ${job.startDate ?? 'shortly'}.`,
        linkUrl: `/campaigns/${jobId}/track`,
      });
      return result;
    });
  }

  // ─────────────────────── dropper: list/start/etc ──────────────────────

  async listForDropper(userId: string) {
    return this.db
      .select({
        assignment: assignments,
        job: {
          id: jobs.id,
          code: jobs.jobCode,
          title: jobs.title,
          startDate: jobs.startDate,
          status: jobs.status,
          leafletCount: jobs.leafletCount,
        },
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

    // Bump the denormalised counter shown on the admin droppers detail card.
    // Uses SQL increment so concurrent completions can't clobber each other.
    await this.db
      .update(dropperProfiles)
      .set({ jobsDone: sql`${dropperProfiles.jobsDone} + 1` })
      .where(eq(dropperProfiles.userId, dropperUserId));

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
    // Completed or abandoned shifts are terminal — refuse.
    if (asgn.status === 'completed' || asgn.status === 'abandoned') {
      throw new ConflictException(`This drop is ${asgn.status} — cannot add more.`);
    }
    // pending or paused → auto-transition to started so the dropper can just
    // tap Mark Drop without hunting for a separate Start button.
    if (asgn.status === 'pending' || asgn.status === 'paused') {
      await this.db
        .update(assignments)
        .set({ status: 'started', startedAt: asgn.startedAt ?? new Date() })
        .where(eq(assignments.id, asgn.id));
      this.logger.log(
        `assignment ${asgn.id} auto-started via markDrop (was ${asgn.status})`,
      );
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
        // Fire the "campaign is live" notification once per job — this branch
        // only entered when transitioning assigned → active, which means this
        // is the very first drop on the whole campaign.
        void this.notifications.emit({
          userId: job.clientUserId,
          type: 'campaign_milestone',
          title: 'Your campaign is live',
          body: `First drop just landed for "${job.title}". Track it in real time.`,
          linkUrl: `/campaigns/${job.id}/track`,
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

  // ───────────────────── live tracking ─────────────────────

  /**
   * Dropper-app GPS ping. Inserts a row + broadcasts on the job's room so the
   * client's live-tracking page sees the marker move in real time.
   *
   * Throttling: we don't dedup here — the dropper app should ping every ~5 s,
   * which is small enough to be cheap and large enough to look "smooth".
   */
  async recordLocation(input: MarkLocationInput, dropperUserId: string) {
    const [assignment] = await this.db
      .select({
        id: assignments.id,
        jobId: assignments.jobId,
        status: assignments.status,
        ownerUserId: assignments.dropperUserId,
      })
      .from(assignments)
      .where(eq(assignments.id, input.assignmentId))
      .limit(1);
    if (!assignment) throw new NotFoundException(`Assignment ${input.assignmentId} not found`);
    if (assignment.ownerUserId !== dropperUserId) {
      throw new ForbiddenException('Not your assignment');
    }
    if (assignment.status !== 'started') {
      throw new ConflictException(`Assignment is in status "${assignment.status}" — start it first`);
    }

    const recordedAt = input.recordedAt ? new Date(input.recordedAt) : new Date();
    await this.db.insert(dropperLocations).values({
      assignmentId: input.assignmentId,
      dropperUserId,
      location: { lat: input.location.lat, lng: input.location.lng },
      accuracyM: input.accuracyM,
      speedMps: input.speedMps?.toString(),
      heading: input.heading,
      recordedAt,
    });

    this.realtime.emit({
      type: 'dropper.location',
      jobId: assignment.jobId,
      assignmentId: assignment.id,
      dropperUserId,
      location: input.location,
      speedMps: input.speedMps ?? null,
      heading: input.heading ?? null,
      at: recordedAt.toISOString(),
    });

    return { ok: true };
  }

  /**
   * Client-facing snapshot for the live-tracking page: every active assignment
   * on a job + each dropper's latest known position + drop count + pace.
   */
  /**
   * Swap the dropper on an existing assignment in place. Preserves the
   * assignment id + target + sub-zone + all historical drops and GPS pings
   * (those stay attributed to the previous dropper for audit + payroll).
   *
   * Refuses when:
   *   - assignment is in a terminal state (`completed` or `abandoned`)
   *   - assignment is `started` — dropper must pause first, so we don't
   *     silently split a live shift across two people
   *   - new dropper is the same as the current one (no-op)
   *   - new dropper already has another live assignment on this job
   *   - new dropper is not a dropper, not active, or onboarding incomplete
   *
   * Emits notifications to both parties and a realtime event so any open
   * screens react without a poll.
   */
  async reassign(assignmentId: string, newDropperUserId: string, actorUserId: string) {
    const [asgn] = await this.db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);
    if (!asgn) throw new NotFoundException('Assignment not found');

    if (asgn.status === 'completed' || asgn.status === 'abandoned') {
      throw new ConflictException(
        `Cannot reassign a ${asgn.status} assignment — add a fresh assignment on the job instead.`,
      );
    }
    const wasStarted = asgn.status === 'started';
    if (asgn.dropperUserId === newDropperUserId) {
      throw new BadRequestException('Already assigned to this dropper');
    }

    // Validate the incoming dropper: exists + role + active + onboarded.
    const [newDropper] = await this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
        onboardingStatus: dropperProfiles.onboardingStatus,
        firstName: dropperProfiles.firstName,
        lastName: dropperProfiles.lastName,
      })
      .from(users)
      .leftJoin(dropperProfiles, eq(dropperProfiles.userId, users.id))
      .where(eq(users.id, newDropperUserId))
      .limit(1);
    if (!newDropper) throw new NotFoundException('Dropper not found');
    if (newDropper.role !== 'dropper') {
      throw new BadRequestException(`${newDropper.email} is not a dropper`);
    }
    if (newDropper.status !== 'active') {
      throw new BadRequestException(`${newDropper.email} is ${newDropper.status}`);
    }
    if (newDropper.onboardingStatus !== 'complete') {
      throw new BadRequestException(`${newDropper.email} hasn't completed onboarding yet`);
    }

    // Refuse if the incoming dropper is already on another assignment for
    // this same job. Splitting a dropper across two sub-zones on one job is
    // rare and messy; force admin to consolidate.
    const [dup] = await this.db
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          eq(assignments.jobId, asgn.jobId),
          eq(assignments.dropperUserId, newDropperUserId),
          inArray(assignments.status, ['pending', 'started', 'paused']),
        ),
      )
      .limit(1);
    if (dup) {
      throw new BadRequestException(
        `${newDropper.email} already has an active assignment on this job`,
      );
    }

    const previousDropperUserId = asgn.dropperUserId;

    // One UPDATE — historical drops + GPS rows are FK'd to dropper_user_id
    // and are NOT rewritten, so the audit trail is preserved.
    // If the current dropper is mid-shift, auto-pause as part of the swap so
    // their app stops pinging and the incoming dropper starts from a clean
    // paused state (they hit Start on their end).
    const [updated] = await this.db
      .update(assignments)
      .set({
        dropperUserId: newDropperUserId,
        ...(wasStarted ? { status: 'paused' as const } : {}),
      })
      .where(eq(assignments.id, assignmentId))
      .returning();

    await this.db.insert(events).values({
      actorUserId,
      subjectType: 'assignment',
      subjectId: assignmentId,
      eventType: 'assignment.reassigned',
      data: {
        jobId: asgn.jobId,
        fromDropperUserId: previousDropperUserId,
        toDropperUserId: newDropperUserId,
        dropsInherited: asgn.dropsCompleted,
        autoPaused: wasStarted,
      },
    });

    // Load the job title for readable notification copy.
    const [job] = await this.db
      .select({ id: jobs.id, title: jobs.title })
      .from(jobs)
      .where(eq(jobs.id, asgn.jobId))
      .limit(1);
    const jobTitle = job?.title ?? 'a campaign';

    void this.notifications.emit({
      userId: previousDropperUserId,
      type: 'assignment',
      title: 'Job reassigned',
      body: wasStarted
        ? `Your "${jobTitle}" shift was paused and reassigned by admin. Drops you already recorded stay attributed to you.`
        : `Your "${jobTitle}" assignment has been reassigned by admin. Any drops you already recorded stay attributed to you.`,
      linkUrl: `/dropper`,
    });
    void this.notifications.emit({
      userId: newDropperUserId,
      type: 'assignment',
      title: 'New job for you',
      body: `Admin assigned you "${jobTitle}". Head to your jobs list to start.`,
      linkUrl: `/dropper/jobs/${assignmentId}`,
    });

    this.realtime.emit({
      type: 'assignment.status',
      jobId: asgn.jobId,
      assignmentId,
      dropperUserId: newDropperUserId,
      status: updated.status,
      at: new Date().toISOString(),
    });

    return {
      assignmentId,
      jobId: asgn.jobId,
      previousDropperUserId,
      newDropperUserId,
      status: updated.status,
      dropsInherited: asgn.dropsCompleted,
    };
  }

  async liveState(jobId: string) {
    const rows = await this.db.execute<{
      assignment_id: string;
      dropper_user_id: string;
      dropper_name: string | null;
      dropper_email: string;
      status: string;
      target_leaflets: number;
      drops_completed: number;
      started_at: string | null;
      last_lat: number | null;
      last_lng: number | null;
      last_at: string | null;
      last_heading: number | null;
      last_speed_mps: number | null;
    }>(sql`
      SELECT
        a.id                         AS assignment_id,
        a.dropper_user_id            AS dropper_user_id,
        COALESCE(NULLIF(trim(coalesce(dp.first_name,'') || ' ' || coalesce(dp.last_name,'')), ''), u.email) AS dropper_name,
        u.email                      AS dropper_email,
        a.status::text               AS status,
        COALESCE(a.target_leaflets, sz.target_leaflets, j.leaflet_count, 0) AS target_leaflets,
        a.drops_completed            AS drops_completed,
        a.started_at                 AS started_at,
        ST_Y(l.location::geometry)::float AS last_lat,
        ST_X(l.location::geometry)::float AS last_lng,
        l.recorded_at                AS last_at,
        l.heading                    AS last_heading,
        l.speed_mps::float           AS last_speed_mps
      FROM assignments a
      JOIN users u ON u.id = a.dropper_user_id
      JOIN jobs j ON j.id = a.job_id
      LEFT JOIN dropper_profiles dp ON dp.user_id = a.dropper_user_id
      LEFT JOIN sub_zones sz ON sz.id = a.sub_zone_id
      LEFT JOIN LATERAL (
        SELECT location, recorded_at, heading, speed_mps
        FROM dropper_locations
        WHERE assignment_id = a.id
        ORDER BY recorded_at DESC
        LIMIT 1
      ) l ON TRUE
      WHERE a.job_id = ${jobId}
        AND a.status IN ('started', 'paused', 'completed')
      ORDER BY a.started_at NULLS LAST;
    `);

    return rows.map((r) => ({
      assignmentId: r.assignment_id,
      dropperUserId: r.dropper_user_id,
      dropperName: r.dropper_name ?? r.dropper_email,
      status: r.status,
      targetLeaflets: r.target_leaflets,
      dropsCompleted: r.drops_completed,
      startedAt: r.started_at,
      lastLocation:
        r.last_lat != null && r.last_lng != null
          ? {
              lat: r.last_lat,
              lng: r.last_lng,
              at: r.last_at,
              heading: r.last_heading,
              speedMps: r.last_speed_mps,
            }
          : null,
    }));
  }
}
