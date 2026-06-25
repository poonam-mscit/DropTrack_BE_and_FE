/**
 * AI Re-run Recommender — suggests the best date to repeat a completed campaign,
 * with an expected uplift percentage and a short reason.
 *
 * Inputs:  the just-completed job's stats + this client's past repeats in the
 *          same area (to avoid recommending too soon and cannibalising).
 * Output:  a recommended date, expected uplift band, reasoning, and confidence.
 *
 * Falls back to a deterministic heuristic when Bedrock is unreachable so the
 * feature is still demoable in dev.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, ne, sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { assignments, drops, jobs, zones } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { chat } from './bedrock.client.js';

export interface RerunRecommendation {
  recommendedDate: string; // YYYY-MM-DD
  daysAhead: number;
  expectedUpliftPct: number; // single number, not a range, for display
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
  stubbed: boolean;
  model: string;
  /** Useful for the UI: original job summary one-liner */
  basis: {
    jobTitle: string;
    jobCode: string;
    campaignType: string;
    coveragePct: number;
    completedAt: string;
  };
}

/**
 * Days between consecutive drops in the same area before the *next* one
 * starts cannibalising recall. AU agent rule-of-thumb numbers.
 */
const SWEET_SPOT_DAYS: Record<string, number> = {
  real_estate: 18, // open-home cycle is fortnightly
  medical: 35,
  political: 10, // tighter cadence during a campaign
  food: 10, // weekly promos
  retail: 18,
  education: 28,
  government: 28,
  other: 21,
};

@Injectable()
export class RerunRecommenderService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async recommendForJob(jobId: string): Promise<RerunRecommendation> {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    if (!job.actualCompletedAt) {
      throw new NotFoundException(`Job ${job.jobCode} is not completed yet`);
    }

    // Pull coverage from the source of truth: drops vs leafletCount.
    const [coverageRow] = await this.db.execute<{ total_drops: number }>(sql`
      SELECT COUNT(*)::int AS total_drops FROM ${drops}
      WHERE assignment_id IN (
        SELECT id FROM ${assignments} WHERE job_id = ${jobId}
      );
    `);
    const totalDrops = coverageRow?.total_drops ?? 0;
    const coveragePct =
      job.leafletCount > 0 ? Math.min(100, (totalDrops / job.leafletCount) * 100) : 0;

    // Recent repeats by this client to make sure we don't suggest too soon.
    const recentSameClient = await this.db
      .select({ completedAt: jobs.actualCompletedAt, code: jobs.jobCode })
      .from(jobs)
      .where(
        and(
          eq(jobs.clientUserId, job.clientUserId),
          eq(jobs.campaignType, job.campaignType),
          ne(jobs.id, job.id),
          gte(jobs.actualCompletedAt, new Date(Date.now() - 90 * 86400_000)),
        ),
      )
      .orderBy(desc(jobs.actualCompletedAt))
      .limit(3);

    const [zoneRow] = await this.db
      .select({ areaSqm: zones.areaSqm })
      .from(zones)
      .where(eq(zones.jobId, jobId))
      .limit(1);

    const stats = {
      jobTitle: job.title,
      jobCode: job.jobCode,
      campaignType: job.campaignType,
      leafletCount: job.leafletCount,
      totalDrops,
      coveragePct,
      completedAt: job.actualCompletedAt.toISOString(),
      areaKm2: zoneRow?.areaSqm ? Number(zoneRow.areaSqm) / 1_000_000 : null,
      previousRunsInLast90Days: recentSameClient.length,
      mostRecentRunCode: recentSameClient[0]?.code,
      sweetSpotDays:
        SWEET_SPOT_DAYS[job.campaignType] ?? SWEET_SPOT_DAYS.other,
    };

    // Try the LLM first.
    const ai = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(stats) },
      ],
      { temperature: 0.3, maxTokens: 300 },
    );

    const stub = stubRecommendation(stats);
    const basis = {
      jobTitle: stats.jobTitle,
      jobCode: stats.jobCode,
      campaignType: stats.campaignType,
      coveragePct: Math.round(stats.coveragePct * 10) / 10,
      completedAt: stats.completedAt,
    };

    if (ai.stubbed) {
      return { ...stub, basis, stubbed: true, model: 'stub' };
    }

    const match = ai.text.match(/\{[\s\S]*\}/);
    if (!match) return { ...stub, basis, stubbed: false, model: ai.model };
    try {
      const parsed = JSON.parse(match[0]) as Partial<RerunRecommendation>;
      return {
        recommendedDate: parsed.recommendedDate || stub.recommendedDate,
        daysAhead: parsed.daysAhead ?? stub.daysAhead,
        expectedUpliftPct: parsed.expectedUpliftPct ?? stub.expectedUpliftPct,
        reasoning: parsed.reasoning || stub.reasoning,
        confidence: (parsed.confidence as 'low' | 'medium' | 'high') ?? 'high',
        basis,
        stubbed: false,
        model: ai.model,
      };
    } catch {
      return { ...stub, basis, stubbed: false, model: ai.model };
    }
  }
}

const SYSTEM_PROMPT =
  'You are a marketing strategist inside DropTrack, an Australian leaflet-distribution platform. ' +
  'Given a completed campaign, recommend exactly ONE date to re-run it for maximum compound effect. ' +
  'Be specific, never generic. Return ONLY a JSON object.';

function buildPrompt(s: {
  jobTitle: string;
  jobCode: string;
  campaignType: string;
  leafletCount: number;
  totalDrops: number;
  coveragePct: number;
  completedAt: string;
  areaKm2: number | null;
  previousRunsInLast90Days: number;
  mostRecentRunCode?: string;
  sweetSpotDays: number;
}) {
  return [
    'Completed campaign facts:',
    `- Campaign: ${s.jobTitle} (${s.jobCode}, ${s.campaignType.replace('_', ' ')})`,
    `- Leaflets ordered: ${s.leafletCount}`,
    `- Drops landed: ${s.totalDrops}`,
    `- Coverage: ${s.coveragePct.toFixed(1)}%`,
    `- Zone area: ${s.areaKm2 ?? '—'} km²`,
    `- Completed at: ${s.completedAt}`,
    `- Previous repeats by this client in same category in last 90 days: ${s.previousRunsInLast90Days}`,
    `- Industry sweet-spot cadence: ${s.sweetSpotDays} days`,
    '',
    'Return ONLY:',
    '{ "recommendedDate": "YYYY-MM-DD",',
    '  "daysAhead": number,',
    '  "expectedUpliftPct": number,            // 8 to 30',
    '  "reasoning": string (1 sentence, max 180 chars),',
    '  "confidence": "low" | "medium" | "high" }',
  ].join('\n');
}

function stubRecommendation(s: {
  campaignType: string;
  coveragePct: number;
  completedAt: string;
  previousRunsInLast90Days: number;
  sweetSpotDays: number;
}): Omit<RerunRecommendation, 'stubbed' | 'model' | 'basis'> {
  const baseDays = s.sweetSpotDays;
  // If the client just ran another similar campaign recently, push out a bit.
  const daysAhead = baseDays + Math.min(s.previousRunsInLast90Days * 4, 14);

  const completedAt = new Date(s.completedAt);
  const recDate = new Date(completedAt.getTime() + daysAhead * 86400_000);
  const recommendedDate = recDate.toISOString().slice(0, 10);

  // Coverage ≥ 90% → strong base for compound; lower coverage → smaller uplift.
  // AU agent rule-of-thumb: 18–25% on a clean repeat in the same zone.
  const upliftBand =
    s.coveragePct >= 90 ? 22 : s.coveragePct >= 75 ? 18 : s.coveragePct >= 50 ? 12 : 8;

  const reasoning =
    s.coveragePct >= 85
      ? `Strong ${s.coveragePct.toFixed(0)}% coverage on the first run — ${daysAhead} days lands inside the recall window for ${s.campaignType.replace('_', ' ')}.`
      : s.coveragePct >= 60
        ? `Solid ${s.coveragePct.toFixed(0)}% reach. A repeat in ${daysAhead} days helps the audience that didn't engage first time.`
        : `Coverage was light (${s.coveragePct.toFixed(0)}%). A focused repeat in ${daysAhead} days lets you compound while the brand is still warm.`;

  return {
    recommendedDate,
    daysAhead,
    expectedUpliftPct: upliftBand,
    reasoning,
    confidence: 'medium',
  };
}
