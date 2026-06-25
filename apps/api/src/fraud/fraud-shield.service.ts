/**
 * AI Fraud Shield — rules-engine v1.
 *
 * Runs after each drop insert. Flags suspicious activity, inserts into
 * `fraud_alerts`, optionally sets `drops.flagged_anomaly`, and emits a
 * realtime event so admins see it without refresh.
 *
 * NOTE: Droppers use **walking, bicycles, and e-scooters** (confirmed
 * 2026-05-13). Thresholds reflect that — we don't flag normal cycling pace.
 *
 * Rules:
 *   1. impossible_speed   — >35 km/h between adjacent drops (catches
 *                           vehicles / GPS teleports, not legit transport).
 *                           severity=high   auto-flag drop.
 *   2. mock_location      — accuracyM ≤ 1 m (real consumer GPS rarely better
 *                           than 3-5 m).    severity=high   auto-flag drop.
 *   3. cluster_density    — current drop's location is identical (<2 m) to
 *                           a previous one on this assignment within last
 *                           5 minutes.       severity=low   auto-cleared.
 *
 * High-severity alerts also write `flagged_anomaly = true` on the drop so the
 * UI can render a red pin instead of green.
 *
 * Future: per-dropper `preferred_transport` (walking | bicycle | e_scooter)
 * with mode-specific thresholds, so we can flag a "walking" dropper hitting
 * 25 km/h while still allowing it for an e-scooter.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { dropperProfiles, drops, fraudAlerts } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

/** Per-mode "impossible speed" threshold (km/h). Above this is fraud. */
const SPEED_LIMIT_KMH: Record<'walking' | 'bicycle' | 'e_scooter', number> = {
  walking: 12, // brisk walk/jog tops out around 10
  bicycle: 35, // suburban cyclists rarely exceed 30
  e_scooter: 32, // AU legal cap 25, allow buffer
};

const CLUSTER_RADIUS_M = 2;
const CLUSTER_WINDOW_MS = 5 * 60 * 1000;
const MIN_PLAUSIBLE_ACCURACY_M = 1;

export interface FraudCheckInput {
  dropId: string;
  assignmentId: string;
  dropperUserId: string;
  jobId: string;
  location: { lat: number; lng: number };
  accuracyM: number | null;
  markedAt: Date;
}

export interface FraudFinding {
  type: 'impossible_speed' | 'pace_spike' | 'mock_location' | 'cluster_density';
  severity: 'low' | 'medium' | 'high';
  status: 'auto_cleared' | 'manual_review' | 'confirmed';
  evidence: Record<string, unknown>;
}

@Injectable()
export class FraudShieldService {
  private readonly logger = new Logger(FraudShieldService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Evaluate a freshly-inserted drop and log any findings. */
  async evaluateDrop(input: FraudCheckInput) {
    const findings: FraudFinding[] = [];

    // Pull the dropper's transport mode to pick the right speed threshold.
    const [profile] = await this.db
      .select({ mode: dropperProfiles.preferredTransport })
      .from(dropperProfiles)
      .where(eq(dropperProfiles.userId, input.dropperUserId))
      .limit(1);
    const mode = (profile?.mode ?? 'walking') as keyof typeof SPEED_LIMIT_KMH;
    const speedLimitKmh = SPEED_LIMIT_KMH[mode];
    const speedLimitMps = (speedLimitKmh * 1000) / 3600;

    // ── Mock location: implausibly high reported accuracy ──
    if (input.accuracyM !== null && input.accuracyM <= MIN_PLAUSIBLE_ACCURACY_M) {
      findings.push({
        type: 'mock_location',
        severity: 'high',
        status: 'manual_review',
        evidence: {
          reportedAccuracyM: input.accuracyM,
          threshold: MIN_PLAUSIBLE_ACCURACY_M,
          reason: 'consumer GPS rarely reports better than 3-5m',
        },
      });
    }

    // ── Speed checks vs the previous drop ──
    const [prev] = await this.db.execute<{
      id: string;
      lat: number;
      lng: number;
      marked_at: string;
      distance_m: number;
    }>(sql`
      SELECT
        id,
        ST_Y(location::geometry)::float AS lat,
        ST_X(location::geometry)::float AS lng,
        marked_at,
        ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326)::geography
        )::float AS distance_m
      FROM drops
      WHERE assignment_id = ${input.assignmentId}
        AND id <> ${input.dropId}
      ORDER BY marked_at DESC
      LIMIT 1;
    `);

    if (prev) {
      const dtMs = input.markedAt.getTime() - new Date(prev.marked_at).getTime();
      if (dtMs > 0) {
        const speedMps = prev.distance_m / (dtMs / 1000);
        if (speedMps > speedLimitMps) {
          findings.push({
            type: 'impossible_speed',
            severity: 'high',
            status: 'manual_review',
            evidence: {
              speedMps: round(speedMps, 2),
              speedKmh: round(speedMps * 3.6, 2),
              distanceM: round(prev.distance_m, 1),
              elapsedS: round(dtMs / 1000, 1),
              previousDropId: prev.id,
              transportMode: mode,
              thresholdKmh: speedLimitKmh,
            },
          });
        }

        // ── Cluster: very close to a recent drop ──
        if (
          prev.distance_m < CLUSTER_RADIUS_M &&
          dtMs < CLUSTER_WINDOW_MS
        ) {
          findings.push({
            type: 'cluster_density',
            severity: 'low',
            status: 'auto_cleared',
            evidence: {
              distanceM: round(prev.distance_m, 2),
              elapsedS: round(dtMs / 1000, 1),
              previousDropId: prev.id,
              hint: 'likely apartment block or same letterbox cluster',
            },
          });
        }
      }
    }

    if (findings.length === 0) return [];

    // Insert all findings.
    const inserted = await this.db
      .insert(fraudAlerts)
      .values(
        findings.map((f) => ({
          assignmentId: input.assignmentId,
          dropperUserId: input.dropperUserId,
          alertType: f.type,
          severity: f.severity,
          status: f.status,
          evidence: { ...f.evidence, dropId: input.dropId, jobId: input.jobId },
        })),
      )
      .returning();

    // Promote the drop to "flagged" if anything is high severity.
    const anyHigh = findings.some((f) => f.severity === 'high');
    if (anyHigh) {
      await this.db
        .update(drops)
        .set({ flaggedAnomaly: true })
        .where(eq(drops.id, input.dropId));
    }

    // Emit a realtime event per finding so admins watching the job see it.
    for (const alert of inserted) {
      this.realtime.emit({
        type: 'fraud.alert',
        jobId: input.jobId,
        assignmentId: input.assignmentId,
        dropperUserId: input.dropperUserId,
        alertId: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        status: alert.status,
        evidence: alert.evidence ?? {},
        at: alert.createdAt.toISOString(),
      });
    }

    this.logger.log(
      `Fraud Shield: drop ${input.dropId.slice(0, 8)}.. → ${findings
        .map((f) => `${f.type}(${f.severity})`)
        .join(', ')}${anyHigh ? ' [auto-flagged]' : ''}`,
    );
    return inserted;
  }
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
