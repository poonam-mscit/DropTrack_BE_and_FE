/**
 * AI Dashboard Insight — one-line personalised tip surfaced on the agent's
 * dashboard each visit. Lightweight: aggregates recent campaign stats and
 * picks the most useful nudge.
 *
 * Examples it can produce:
 *   "Your Bondi campaign hit 96% — your best yet. Consider a re-run in 3 weeks."
 *   "Your last 3 campaigns trended down. Adding a 2nd dropper usually lifts coverage 10-15%."
 *   "No active campaigns this week — quiet patches often miss the listings rush."
 */
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { aiReports, jobs, payments } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { chat } from './bedrock.client.js';

export interface DashboardInsight {
  headline: string;
  body: string;
  link?: { href: string; label: string };
  generatedAt: string;
  stubbed: boolean;
  model: string;
}

@Injectable()
export class InsightService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async forClient(clientUserId: string): Promise<DashboardInsight> {
    const stats = await this.gatherClientStats(clientUserId);

    const ai = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: this.buildPrompt(stats) },
      ],
      { temperature: 0.4, maxTokens: 220 },
    );

    if (ai.stubbed) {
      const stub = stubInsight(stats);
      return { ...stub, generatedAt: new Date().toISOString(), stubbed: true, model: 'stub' };
    }

    // Parse the model output as JSON; fall back to stub on malformed output.
    const match = ai.text.match(/\{[\s\S]*\}/);
    if (!match) {
      const stub = stubInsight(stats);
      return { ...stub, generatedAt: new Date().toISOString(), stubbed: false, model: ai.model };
    }
    try {
      const j = JSON.parse(match[0]) as Partial<DashboardInsight>;
      const stub = stubInsight(stats);
      return {
        headline: j.headline || stub.headline,
        body: j.body || stub.body,
        link: j.link ?? stub.link,
        generatedAt: new Date().toISOString(),
        stubbed: false,
        model: ai.model,
      };
    } catch {
      const stub = stubInsight(stats);
      return { ...stub, generatedAt: new Date().toISOString(), stubbed: false, model: ai.model };
    }
  }

  private async gatherClientStats(clientUserId: string) {
    const recent = await this.db
      .select({
        id: jobs.id,
        code: jobs.jobCode,
        title: jobs.title,
        status: jobs.status,
        leafletCount: jobs.leafletCount,
        createdAt: jobs.createdAt,
        completedAt: jobs.actualCompletedAt,
      })
      .from(jobs)
      .where(eq(jobs.clientUserId, clientUserId))
      .orderBy(desc(jobs.createdAt))
      .limit(10);

    const totalSpentCents = await this.db
      .select({ sum: sql<number>`COALESCE(SUM(${payments.amountTotalCents}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.clientUserId, clientUserId), eq(payments.status, 'succeeded')));

    // Most recent report → use the narrative's first sentence for context.
    const lastReports = await this.db
      .select({ jobId: aiReports.jobId, narrative: aiReports.narrative, generatedAt: aiReports.generatedAt })
      .from(aiReports)
      .innerJoin(jobs, eq(jobs.id, aiReports.jobId))
      .where(and(eq(jobs.clientUserId, clientUserId), isNotNull(aiReports.narrative)))
      .orderBy(desc(aiReports.generatedAt))
      .limit(1);

    return {
      totalJobs: recent.length,
      activeJobs: recent.filter((j) => j.status === 'active' || j.status === 'assigned').length,
      completedJobs: recent.filter((j) => j.status === 'completed').length,
      draftJobs: recent.filter((j) => j.status === 'draft' || j.status === 'paid_unassigned').length,
      mostRecentTitle: recent[0]?.title,
      mostRecentCode: recent[0]?.code,
      mostRecentStatus: recent[0]?.status,
      totalSpentCents: totalSpentCents[0]?.sum ?? 0,
      latestReportSnippet: lastReports[0]?.narrative?.split('\n\n')[0]?.slice(0, 240),
    };
  }

  private buildPrompt(s: Awaited<ReturnType<InsightService['gatherClientStats']>>) {
    return [
      'Write a one-line tip the agent will see on their DropTrack dashboard right now.',
      '',
      'Their current state:',
      `- Total recent campaigns: ${s.totalJobs}`,
      `- Active right now: ${s.activeJobs}`,
      `- Completed: ${s.completedJobs}`,
      `- Draft/awaiting assignment: ${s.draftJobs}`,
      `- Most recent: ${s.mostRecentTitle ?? '—'} (${s.mostRecentStatus ?? '—'})`,
      `- Total spent (succeeded): $${(s.totalSpentCents / 100).toFixed(2)} AUD`,
      `- Latest report excerpt: ${s.latestReportSnippet ?? '—'}`,
      '',
      'Return ONLY a JSON object:',
      '{ "headline": string (max 70 chars), "body": string (max 220 chars),',
      '  "link"?: { "href": string, "label": string } }',
      '',
      'Tone: warm, specific, never generic. If a stat suggests a clear action, suggest it.',
    ].join('\n');
  }
}

const SYSTEM_PROMPT =
  'You are a marketing-savvy AI assistant inside DropTrack, an Australian leaflet-distribution platform. ' +
  'You write personalised dashboard insights for paying agents. Keep them short, useful, and Australian-flavoured.';

// ─────────────────────── stub fallback ───────────────────────

function stubInsight(s: {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  draftJobs: number;
  mostRecentTitle?: string;
  mostRecentStatus?: string;
  totalSpentCents: number;
  latestReportSnippet?: string;
}): Pick<DashboardInsight, 'headline' | 'body' | 'link'> {
  if (s.draftJobs > 0) {
    return {
      headline: 'You have an unpaid draft.',
      body: `Drafts expire after 48 hrs. Open ${s.mostRecentTitle ?? 'the draft'} and complete payment to roster a dropper.`,
      link: { href: '/dashboard', label: 'Open drafts' },
    };
  }
  if (s.activeJobs > 0 && s.mostRecentStatus === 'active') {
    return {
      headline: `${s.mostRecentTitle ?? 'Your campaign'} is live now.`,
      body: 'Watch drops land in real time and download the AI report the moment it completes.',
      link: { href: '/dashboard', label: 'See live' },
    };
  }
  if (s.completedJobs > 0) {
    return {
      headline: 'Compound your last win.',
      body:
        s.latestReportSnippet ??
        `Your last campaign completed. Agents who re-run the same zone within 3 weeks see ~20% uplift.`,
      link: { href: '/create/details', label: 'Schedule a re-run' },
    };
  }
  return {
    headline: 'Start your first DropTrack campaign.',
    body:
      'Draw a zone, AI Smart Zones estimates your letterbox count and price in seconds. Most agents launch in under 5 minutes.',
    link: { href: '/create/details', label: 'Create campaign' },
  };
}
