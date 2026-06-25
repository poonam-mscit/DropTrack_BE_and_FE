import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthedUser } from '../auth/auth.decorators.js';
import { InsightService } from './insight.service.js';
import { JobCreatorService } from './job-creator.service.js';
import { RerunRecommenderService } from './rerun-recommender.service.js';

const promptSchema = z.object({
  prompt: z.string().min(3).max(2000),
  /** Optional prior conversation turns so a follow-up refines instead of replaces. */
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(2000),
      }),
    )
    .max(20)
    .optional(),
  /** Optional prior extracted fields — gives the model a starting point to merge against. */
  previousResult: z.record(z.string(), z.unknown()).optional(),
});

@Controller('ai')
@Roles('client', 'admin')
export class AiController {
  constructor(
    private readonly jobCreatorSvc: JobCreatorService,
    private readonly insightSvc: InsightService,
    private readonly rerunSvc: RerunRecommenderService,
  ) {}

  /** POST /api/ai/job-creator — NL brief → prefilled form fields. */
  @Post('job-creator')
  async runJobCreator(@Body() body: unknown) {
    const parsed = promptSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Invalid input', issues: parsed.error.issues });
    }
    return this.jobCreatorSvc.parse({
      prompt: parsed.data.prompt,
      history: parsed.data.history,
      previousResult: parsed.data.previousResult,
    });
  }

  /** GET /api/ai/dashboard-insight — one-line nudge for the agent. */
  @Get('dashboard-insight')
  async dashboardInsight(@CurrentUser() user: AuthedUser) {
    return this.insightSvc.forClient(user.id);
  }

  /** GET /api/ai/jobs/:id/rerun-recommendation — post-completion repeat advice. */
  @Get('jobs/:id/rerun-recommendation')
  async rerunRecommendation(@Param('id') id: string) {
    return this.rerunSvc.recommendForJob(id);
  }
}
