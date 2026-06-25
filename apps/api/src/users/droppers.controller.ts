import { Controller, Get, Inject } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { assignments, dropperProfiles, users } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { Roles } from '../auth/auth.decorators.js';

@Controller('droppers')
@Roles('admin')
export class DroppersController {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** GET /api/droppers — admin directory. */
  @Get()
  async list() {
    const rows = await this.db
      .select({
        userId: users.id,
        email: users.email,
        status: users.status,
        employeeId: dropperProfiles.employeeId,
        firstName: dropperProfiles.firstName,
        lastName: dropperProfiles.lastName,
        primaryZone: dropperProfiles.primaryZone,
        onboardingStatus: dropperProfiles.onboardingStatus,
        ratingAvg: dropperProfiles.ratingAvg,
        jobsDone: dropperProfiles.jobsDone,
        employmentType: dropperProfiles.employmentType,
        preferredTransport: dropperProfiles.preferredTransport,
        activeAssignments: sql<number>`(
          SELECT COUNT(*)::int FROM ${assignments}
          WHERE ${assignments.dropperUserId} = ${users.id}
            AND ${assignments.status} IN ('pending','started','paused')
        )`,
      })
      .from(users)
      .where(eq(users.role, 'dropper'))
      .innerJoin(dropperProfiles, eq(dropperProfiles.userId, users.id))
      .orderBy(desc(dropperProfiles.ratingAvg));
    return { count: rows.length, data: rows };
  }
}
