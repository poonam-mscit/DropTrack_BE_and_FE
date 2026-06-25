import { createReadStream, existsSync } from 'node:fs';
import { Controller, Get, NotFoundException, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Roles, type AuthedUser } from '../auth/auth.decorators.js';
import { CampaignReportService } from './campaign-report.service.js';

@Controller('jobs/:jobId/report')
@Roles('client', 'admin')
export class CampaignReportController {
  constructor(private readonly reports: CampaignReportService) {}

  /** GET /api/jobs/:jobId/report — fetch the AI report metadata. */
  @Get()
  async get(@Param('jobId') jobId: string, @CurrentUser() _user: AuthedUser) {
    return this.reports.findByJob(jobId);
  }

  /** GET /api/jobs/:jobId/report/pdf — stream the PDF. */
  @Get('pdf')
  async pdf(@Param('jobId') jobId: string, @Res() res: Response) {
    const r = await this.reports.findByJob(jobId);
    if (!r.pdfS3Key) throw new NotFoundException('Report PDF missing');
    const path = this.reports.pdfPath(r.pdfS3Key);
    if (!existsSync(path)) throw new NotFoundException('Report PDF file not found on disk');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${r.pdfS3Key}"`);
    createReadStream(path).pipe(res);
  }

  /**
   * POST /api/jobs/:jobId/report — manually trigger generation (idempotent).
   * Useful for re-running after edits or for jobs that completed before the
   * AI module existed.
   */
  @Post()
  @Roles('admin')
  async generate(@Param('jobId') jobId: string) {
    return this.reports.generateForJob(jobId);
  }
}
