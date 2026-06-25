import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { Public } from '../auth/auth.decorators.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get()
  async health() {
    const start = Date.now();
    const [{ ok }] = await this.db.execute<{ ok: number }>(sql`SELECT 1 AS ok`);
    const [{ postgis_version }] = await this.db.execute<{ postgis_version: string }>(
      sql`SELECT PostGIS_Version() AS postgis_version`,
    );
    return {
      status: 'ok',
      db_ok: ok === 1,
      postgis: postgis_version,
      latency_ms: Date.now() - start,
      uptime_s: Math.round(process.uptime()),
    };
  }
}
