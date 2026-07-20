import { BadRequestException, Controller, Delete, Get, Inject, Logger, NotFoundException, Param } from '@nestjs/common';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import {
  assignments,
  businessProfiles,
  dropperLocations,
  dropperProfiles,
  drops,
  events,
  fraudAlerts,
  invites,
  jobs,
  subZones,
  users,
} from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { Roles } from '../auth/auth.decorators.js';
import { CognitoAuthService } from '../auth/cognito-auth.service.js';

@Controller('droppers')
@Roles('admin')
export class DroppersController {
  private readonly logger = new Logger(DroppersController.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly cognito: CognitoAuthService,
  ) {}

  /** GET /api/droppers — admin directory. Includes outstanding invites as `state: 'invited'`. */
  @Get()
  async list() {
    const active = await this.db
      .select({
        userId: users.id,
        email: users.email,
        status: users.status,
        employeeId: dropperProfiles.employeeId,
        firstName: dropperProfiles.firstName,
        lastName: dropperProfiles.lastName,
        primaryZone: dropperProfiles.primaryZone,
        onboardingStatus: dropperProfiles.onboardingStatus,
        onboardingCompletedAt: dropperProfiles.onboardingCompletedAt,
        // These four fields drive the "accepted vs onboarding" distinction —
        // stripped from the response after use.
        dob: dropperProfiles.dob,
        addressLine1: dropperProfiles.addressLine1,
        tfnEncrypted: dropperProfiles.tfnEncrypted,
        emergencyContactName: dropperProfiles.emergencyContactName,
        ratingAvg: dropperProfiles.ratingAvg,
        jobsDone: dropperProfiles.jobsDone,
        employmentType: dropperProfiles.employmentType,
        preferredTransport: dropperProfiles.preferredTransport,
        activeAssignments: sql<number>`(
          SELECT COUNT(*)::int FROM ${assignments}
          WHERE ${assignments.dropperUserId} = ${users.id}
            AND ${assignments.status} IN ('pending','started','paused')
        )`,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, 'dropper'))
      .innerJoin(dropperProfiles, eq(dropperProfiles.userId, users.id))
      .orderBy(desc(dropperProfiles.ratingAvg));

    const outstanding = await this.db
      .select({
        id: invites.id,
        email: invites.email,
        token: invites.token,
        prefill: invites.prefill,
        expiresAt: invites.expiresAt,
        createdAt: invites.createdAt,
      })
      .from(invites)
      .where(
        and(
          eq(invites.role, 'dropper'),
          isNull(invites.acceptedAt),
          gt(invites.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(invites.createdAt));

    const APP_BASE_URL = process.env.WEB_BASE_URL || 'https://portal.droptrack.com.au';
    const DROPPER_DEEP_LINK = process.env.DROPPER_DEEP_LINK_BASE || 'droptrackdropper://accept';

    const activeRows = active.map((r) => {
      // "Accepted" = they signed in but haven't filled any profile field yet.
      // Once anything meaningful is filled, we call it "onboarding". A row that
      // meets the API's completion bar is "complete".
      const filledSomething =
        !!r.dob || !!r.addressLine1 || !!r.tfnEncrypted || !!r.emergencyContactName;
      const accountState: 'accepted' | 'onboarding' | 'complete' =
        r.onboardingStatus === 'complete'
          ? 'complete'
          : filledSomething
            ? 'onboarding'
            : 'accepted';
      const { dob, addressLine1, tfnEncrypted, emergencyContactName, ...rest } = r;
      return { ...rest, state: 'active' as const, accountState };
    });

    const invitedRows = outstanding.map((i) => ({
      state: 'invited' as const,
      accountState: 'invited' as const,
      userId: `invite:${i.id}`,
      inviteId: i.id,
      email: i.email,
      status: 'invited',
      employeeId: '—',
      firstName: i.prefill?.firstName ?? '',
      lastName: i.prefill?.lastName ?? '',
      primaryZone: i.prefill?.primaryZone ?? null,
      onboardingStatus: 'partial' as const,
      onboardingCompletedAt: null,
      ratingAvg: null,
      jobsDone: 0,
      employmentType: null,
      preferredTransport: null,
      activeAssignments: 0,
      createdAt: i.createdAt,
      invitedAt: i.createdAt,
      invitedExpiresAt: i.expiresAt,
      acceptUrl: `${APP_BASE_URL}/accept-invite?token=${i.token}`,
      deepLink: `${DROPPER_DEEP_LINK}?token=${i.token}`,
    }));

    return { count: activeRows.length + invitedRows.length, data: [...invitedRows, ...activeRows] };
  }

  /**
   * GET /api/droppers/:userId — full profile detail + assignment history.
   * TFN and bank account number are returned as last-4 only, mirroring the
   * masking pattern used on the dropper's own profile endpoint.
   */
  @Get(':userId')
  async detail(@Param('userId') userId: string) {
    // Synthetic invite id — return the invite as a lightweight detail so the
    // admin UI can render *something* meaningful when they expand the row.
    if (userId.startsWith('invite:')) {
      const inviteId = userId.slice('invite:'.length);
      const [row] = await this.db
        .select()
        .from(invites)
        .where(eq(invites.id, inviteId))
        .limit(1);
      if (!row) throw new NotFoundException('Invite not found');
      return {
        state: 'invited' as const,
        invite: {
          email: row.email,
          prefill: row.prefill,
          expiresAt: row.expiresAt,
          createdAt: row.createdAt,
          acceptedAt: row.acceptedAt,
        },
        user: null,
        profile: null,
        assignments: [],
      };
    }

    const [target] = await this.db
      .select({
        userId: users.id,
        email: users.email,
        status: users.status,
        role: users.role,
        mobile: users.mobile,
        createdAt: users.createdAt,
        cognitoSub: users.cognitoSub,
        profile: dropperProfiles,
      })
      .from(users)
      .innerJoin(dropperProfiles, eq(dropperProfiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!target) throw new NotFoundException('Dropper not found');

    const dp = target.profile;
    const assignmentRows = await this.db
      .select({
        assignment: {
          id: assignments.id,
          status: assignments.status,
          targetLeaflets: assignments.targetLeaflets,
          dropsCompleted: assignments.dropsCompleted,
          distanceWalkedM: assignments.distanceWalkedM,
          startedAt: assignments.startedAt,
          completedAt: assignments.completedAt,
          createdAt: assignments.createdAt,
        },
        job: {
          id: jobs.id,
          jobCode: jobs.jobCode,
          title: jobs.title,
          leafletCount: jobs.leafletCount,
          startDate: jobs.startDate,
          deadline: jobs.deadline,
          status: jobs.status,
        },
        subZone: { id: subZones.id, label: subZones.label },
        client: { businessName: businessProfiles.businessName },
      })
      .from(assignments)
      .innerJoin(jobs, eq(jobs.id, assignments.jobId))
      .leftJoin(subZones, eq(subZones.id, assignments.subZoneId))
      .leftJoin(businessProfiles, eq(businessProfiles.userId, jobs.clientUserId))
      .where(eq(assignments.dropperUserId, userId))
      .orderBy(desc(assignments.createdAt));

    // Also surface the outstanding invite (if any) so admin can see how they
    // were onboarded originally.
    const [acceptedInvite] = await this.db
      .select({
        createdAt: invites.createdAt,
        acceptedAt: invites.acceptedAt,
        expiresAt: invites.expiresAt,
        invitedByUserId: invites.invitedByUserId,
        prefill: invites.prefill,
      })
      .from(invites)
      .where(eq(invites.acceptedUserId, userId))
      .orderBy(desc(invites.createdAt))
      .limit(1);

    return {
      state: 'active' as const,
      user: {
        id: target.userId,
        email: target.email,
        status: target.status,
        mobile: target.mobile,
        createdAt: target.createdAt,
        cognitoLinked: !!target.cognitoSub,
      },
      profile: {
        employeeId: dp.employeeId,
        firstName: dp.firstName,
        lastName: dp.lastName,
        dob: dp.dob,
        addressLine1: dp.addressLine1,
        suburb: dp.suburb,
        state: dp.state,
        postcode: dp.postcode,
        emergencyContactName: dp.emergencyContactName,
        emergencyContactPhone: dp.emergencyContactPhone,
        tfnLast4: dp.tfnEncrypted ? dp.tfnEncrypted.slice(-4) : null,
        superFundName: dp.superFundName,
        superMemberNumber: dp.superMemberNumber,
        bankBsb: dp.bankBsb,
        bankAccountLast4: dp.bankAccountLast4,
        wwccNumber: dp.wwccNumber,
        wwccExpiresAt: dp.wwccExpiresAt,
        primaryZone: dp.primaryZone,
        onboardingStatus: dp.onboardingStatus,
        onboardingCompletedAt: dp.onboardingCompletedAt,
        employmentType: dp.employmentType,
        preferredTransport: dp.preferredTransport,
        ratingAvg: dp.ratingAvg,
        jobsDone: dp.jobsDone,
        contractSignedAt: dp.contractSignedAt,
        startDate: dp.startDate,
      },
      invite: acceptedInvite ?? null,
      assignments: assignmentRows,
    };
  }

  /**
   * DELETE /api/droppers/:userId — hard-delete a dropper OR cancel an
   * outstanding invite. Refuses when the dropper has any pending / started /
   * paused assignment; admin must reassign or cancel those first.
   */
  @Delete(':userId')
  async remove(@Param('userId') userId: string) {
    // Synthetic id: cancel the invite, no user row exists yet.
    if (userId.startsWith('invite:')) {
      const inviteId = userId.slice('invite:'.length);
      const [row] = await this.db
        .delete(invites)
        .where(eq(invites.id, inviteId))
        .returning({ email: invites.email });
      if (!row) throw new NotFoundException('Invite not found');
      this.logger.log(`admin cancelled outstanding invite for ${row.email}`);
      return { deleted: 'invite', email: row.email };
    }

    const [target] = await this.db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!target) throw new NotFoundException('Dropper not found');
    if (target.role !== 'dropper') {
      throw new BadRequestException('Only dropper accounts can be deleted here');
    }

    const [openWork] = await this.db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(assignments)
      .where(
        and(
          eq(assignments.dropperUserId, target.id),
          inArray(assignments.status, ['pending', 'started', 'paused']),
        ),
      );
    if ((openWork?.n ?? 0) > 0) {
      throw new BadRequestException(
        `${target.email} still has ${openWork.n} open assignment${openWork.n === 1 ? '' : 's'}. Reassign or cancel them first.`,
      );
    }

    // Kill Cognito first so if that errors we bail before mutating our DB.
    await this.cognito.adminDeleteUser(target.email);

    // Cascade rules on the schema handle dropper_profiles, admin_profiles,
    // chat_threads (→ chat_messages), notifications. Everything else has to be
    // explicitly cleaned up before the users row can go.
    await this.db.transaction(async (tx) => {
      await tx.delete(drops).where(eq(drops.dropperUserId, target.id));
      await tx.delete(dropperLocations).where(eq(dropperLocations.dropperUserId, target.id));
      await tx.delete(fraudAlerts).where(eq(fraudAlerts.dropperUserId, target.id));
      await tx.delete(assignments).where(eq(assignments.dropperUserId, target.id));
      // Nullable FKs — detach without losing the historical rows.
      await tx.update(invites).set({ acceptedUserId: null }).where(eq(invites.acceptedUserId, target.id));
      await tx.update(events).set({ actorUserId: null }).where(eq(events.actorUserId, target.id));
      await tx.update(fraudAlerts).set({ resolvedByUserId: null }).where(eq(fraudAlerts.resolvedByUserId, target.id));
      // Finally: cascades dropper_profiles + chat/notifications too.
      await tx.delete(users).where(eq(users.id, target.id));
    });

    this.logger.log(`admin deleted dropper ${target.email} (${target.id})`);
    return { deleted: 'dropper', email: target.email, userId: target.id };
  }
}
