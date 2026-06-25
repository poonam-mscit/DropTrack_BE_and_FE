import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import PDFDocument from 'pdfkit';
import type { Database } from '@droptrack/db';
import { aiReports, assignments, businessProfiles, drops, jobs, users, zones } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { EmailService } from '../email/email.service.js';
import { chat, type ChatMessage } from './bedrock.client.js';

const REPORT_DIR = process.env.REPORT_DIR ?? '/tmp/droptrack-reports';

@Injectable()
export class CampaignReportService {
  private readonly logger = new Logger(CampaignReportService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly email: EmailService,
  ) {
    if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });
  }

  /** Idempotent — generates only once per job. Returns existing report if one exists. */
  async generateForJob(jobId: string) {
    const [existing] = await this.db
      .select()
      .from(aiReports)
      .where(eq(aiReports.jobId, jobId))
      .limit(1);
    if (existing) return existing;

    const stats = await this.gatherStats(jobId);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You write friendly, concrete one-page summaries of leaflet-distribution campaigns for Australian agents. Keep it under 200 words. Plain English. End with one suggestion for next time.',
      },
      { role: 'user', content: this.buildPrompt(stats) },
    ];

    const ai = await chat(messages, { temperature: 0.5, maxTokens: 800 });
    const narrative = ai.stubbed ? this.stubNarrative(stats) : ai.text.trim();

    const pdfS3Key = await this.renderPdf({ stats, narrative });

    const [report] = await this.db
      .insert(aiReports)
      .values({
        jobId,
        narrative,
        pdfS3Key,
        tokensInput: ai.tokensInput,
        tokensOutput: ai.tokensOutput,
        modelName: ai.model,
      })
      .returning();

    this.logger.log(
      `AI Report generated for ${stats.jobCode} · ${ai.stubbed ? 'STUB' : ai.model} · tokens ${ai.tokensInput}/${ai.tokensOutput}`,
    );

    // Fire-and-forget email — never blocks the report row creation.
    this.email
      .sendCampaignReport({
        to: stats.clientEmail,
        clientName: stats.clientName,
        jobCode: stats.jobCode,
        jobTitle: stats.title,
        narrative,
        pdfPath: this.pdfPath(pdfS3Key),
        pdfFilename: pdfS3Key,
      })
      .then((r) =>
        this.logger.log(
          `Campaign report ${r.stubbed ? 'stub-written' : 'emailed'} for ${stats.jobCode} → ${stats.clientEmail}`,
        ),
      )
      .catch((err) => this.logger.error(`Email send failed: ${(err as Error).message}`));

    return report;
  }

  async findByJob(jobId: string) {
    const [r] = await this.db
      .select()
      .from(aiReports)
      .where(eq(aiReports.jobId, jobId))
      .limit(1);
    if (!r) throw new NotFoundException('No report for this job yet');
    return r;
  }

  pdfPath(s3Key: string): string {
    return join(REPORT_DIR, s3Key);
  }

  // ─────────────────── stats gather ───────────────────

  private async gatherStats(jobId: string) {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    const [client] = await this.db
      .select({ name: businessProfiles.businessName })
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, job.clientUserId))
      .limit(1);

    const [clientUser] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, job.clientUserId))
      .limit(1);

    const [{ totalDrops, insideZone, distanceWalkedM }] = await this.db.execute<{
      totalDrops: number;
      insideZone: number;
      distanceWalkedM: number;
    }>(sql`
      SELECT
        COUNT(*)::int                                            AS "totalDrops",
        SUM(CASE WHEN inside_zone THEN 1 ELSE 0 END)::int        AS "insideZone",
        COALESCE((SELECT SUM(distance_walked_m) FROM ${assignments}
                  WHERE job_id = ${jobId}), 0)::int              AS "distanceWalkedM"
      FROM ${drops}
      WHERE assignment_id IN (
        SELECT id FROM ${assignments} WHERE job_id = ${jobId}
      );
    `);

    const dropperRows = await this.db
      .select({
        email: users.email,
        dropsCompleted: assignments.dropsCompleted,
        status: assignments.status,
        startedAt: assignments.startedAt,
        completedAt: assignments.completedAt,
      })
      .from(assignments)
      .where(eq(assignments.jobId, jobId))
      .innerJoin(users, eq(users.id, assignments.dropperUserId));

    const [zone] = await this.db.select().from(zones).where(eq(zones.jobId, jobId)).limit(1);

    const coveragePct = job.leafletCount > 0 ? (totalDrops / job.leafletCount) * 100 : 0;

    return {
      jobId,
      jobCode: job.jobCode,
      title: job.title,
      campaignType: job.campaignType,
      clientName: client?.name ?? 'Client',
      clientEmail: clientUser?.email ?? '',
      leafletCount: job.leafletCount,
      startDate: job.startDate ?? '—',
      deadline: job.deadline ?? '—',
      actualCompletedAt: job.actualCompletedAt,
      totalDrops,
      insideZone,
      outsideZone: totalDrops - insideZone,
      coveragePct: Math.round(coveragePct * 10) / 10,
      distanceKm: Math.round((distanceWalkedM / 1000) * 10) / 10,
      droppers: dropperRows.map((d) => ({
        name: d.email.split('@')[0],
        drops: d.dropsCompleted,
        status: d.status,
      })),
      zoneAreaKm2: zone?.areaSqm ? Math.round((Number(zone.areaSqm) / 1_000_000) * 100) / 100 : null,
      estimatedHouses: zone?.estimatedHouses ?? null,
      estimatedApartments: zone?.estimatedApartments ?? null,
    };
  }

  // ─────────────────── prompt + stub ───────────────────

  private buildPrompt(s: Awaited<ReturnType<CampaignReportService['gatherStats']>>) {
    return [
      `Write a 150-200 word campaign summary for the client (${s.clientName}).`,
      '',
      'Job facts (do not invent any others):',
      `- Campaign: ${s.title} (${s.jobCode}, ${s.campaignType.replace('_', ' ')})`,
      `- Leaflets ordered: ${s.leafletCount}`,
      `- Drops completed: ${s.totalDrops}`,
      `- Inside zone: ${s.insideZone} (${s.outsideZone} fell outside)`,
      `- Coverage: ${s.coveragePct}%`,
      `- Distance walked: ${s.distanceKm} km`,
      `- Zone area: ${s.zoneAreaKm2 ?? '—'} km²`,
      `- Droppers: ${s.droppers.map((d) => `${d.name} (${d.drops})`).join(', ')}`,
      '',
      'Open with a single-sentence hook. End with one concrete suggestion for next time.',
    ].join('\n');
  }

  private stubNarrative(s: Awaited<ReturnType<CampaignReportService['gatherStats']>>) {
    return [
      `Your ${s.campaignType.replace('_', ' ')} campaign "${s.title}" landed ${s.totalDrops} of ${s.leafletCount} leaflets across ${s.zoneAreaKm2 ?? 'the selected'} km² — ${s.coveragePct}% coverage.`,
      ``,
      `${s.droppers.map((d) => `${d.name} delivered ${d.drops} drops`).join('; ')}. ${s.insideZone} drops fell inside the zone polygon${s.outsideZone > 0 ? `; ${s.outsideZone} fell outside (likely apartment overhangs or street boundaries)` : ''}. Total distance covered was ${s.distanceKm} km.`,
      ``,
      `Suggestion for next time: schedule a repeat in 3 weeks to compound recall — Australian agents see ~20% uplift on the second drop in the same zone.`,
    ].join('\n');
  }

  // ─────────────────── PDF render ───────────────────

  private async renderPdf({
    stats,
    narrative,
  }: {
    stats: Awaited<ReturnType<CampaignReportService['gatherStats']>>;
    narrative: string;
  }): Promise<string> {
    const filename = `report-${stats.jobCode}-${Date.now()}.pdf`;
    const path = join(REPORT_DIR, filename);

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const stream = createWriteStream(path);
      stream.on('finish', resolve);
      stream.on('error', reject);
      doc.pipe(stream);

      // ── header (indigo bar) ──
      doc.rect(0, 0, doc.page.width, 90).fill('#1A1B36');
      doc.fillColor('#A3E635').font('Helvetica-Bold').fontSize(10).text('DROPTRACK', 48, 32);
      doc
        .fillColor('white')
        .font('Helvetica-Bold')
        .fontSize(18)
        .text('AI Campaign Report', 48, 50);
      doc
        .fillColor('#a3a3b8')
        .font('Helvetica')
        .fontSize(10)
        .text(`Generated ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`, 48, 72);

      doc.moveDown(2);

      // ── title block ──
      doc.fillColor('#0B0D12').font('Helvetica-Bold').fontSize(24).text(stats.title, 48, 120);
      doc
        .fillColor('#4B5161')
        .font('Helvetica')
        .fontSize(11)
        .text(
          `${stats.jobCode} · ${stats.campaignType.replace('_', ' ')} · ${stats.clientName}`,
          48,
        );
      doc.moveDown(1.5);

      // ── KPI row ──
      const kpiTop = doc.y;
      const kpis: Array<[string, string]> = [
        ['Drops', String(stats.totalDrops)],
        ['Coverage', `${stats.coveragePct}%`],
        ['Distance', `${stats.distanceKm} km`],
        ['Droppers', String(stats.droppers.length)],
      ];
      const col = (doc.page.width - 96) / kpis.length;
      kpis.forEach(([label, value], i) => {
        const x = 48 + col * i;
        doc.fillColor('#8B92A4').font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), x, kpiTop, { width: col });
        doc.fillColor('#0B0D12').font('Helvetica-Bold').fontSize(22).text(value, x, kpiTop + 14, { width: col });
      });
      doc.y = kpiTop + 60;
      doc.moveDown(0.5);

      // ── divider ──
      doc.strokeColor('#EDEEF1').lineWidth(1).moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).stroke();
      doc.moveDown(1);

      // ── narrative ──
      doc.fillColor('#8B92A4').font('Helvetica-Bold').fontSize(8).text('AI INSIGHT', 48, doc.y);
      doc.moveDown(0.3);
      doc.fillColor('#0B0D12').font('Helvetica').fontSize(11).text(narrative, 48, doc.y, {
        width: doc.page.width - 96,
        align: 'left',
        lineGap: 4,
      });
      doc.moveDown(1.5);

      // ── dropper breakdown ──
      doc.fillColor('#8B92A4').font('Helvetica-Bold').fontSize(8).text('DROPPER BREAKDOWN', 48, doc.y);
      doc.moveDown(0.3);
      stats.droppers.forEach((d) => {
        doc
          .fillColor('#0B0D12')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(d.name, 48, doc.y, { continued: true })
          .fillColor('#4B5161')
          .font('Helvetica')
          .text(`  ${d.drops} drops · ${d.status}`);
      });
      doc.moveDown(1);

      // ── footer ──
      const footerY = doc.page.height - 60;
      doc
        .fillColor('#8B92A4')
        .font('Helvetica')
        .fontSize(8)
        .text(
          'DropTrack · AI-powered leaflet distribution · droptrack.au · Privacy Act 1988 compliant',
          48,
          footerY,
          { width: doc.page.width - 96, align: 'center' },
        );

      doc.end();
    });

    // For now we store the PDF locally; in prod swap this for an S3 putObject.
    return filename;
  }
}
