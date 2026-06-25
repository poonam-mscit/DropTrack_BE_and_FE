import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, Roles, type AuthedUser } from '../auth/auth.decorators.js';
import { createJobSchema, estimateZoneSchema, updateJobSchema } from './jobs.dto.js';
import { JobsService } from './jobs.service.js';

@Controller('jobs')
@Roles('client', 'admin')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  async list(@CurrentUser() user: AuthedUser) {
    // Clients see only their own; admin sees all.
    const all = await this.jobsService.list();
    const data = user.role === 'admin' ? all : all.filter((j) => j.clientUserId === user.id);
    return { count: data.length, data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const job = await this.jobsService.findOne(id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return { data: job };
  }

  /** GET /api/jobs/:id/map — GeoJSON zone + sub-zones + drops (lat/lng) for the browser. */
  @Get(':id/map')
  async map(@Param('id') id: string) {
    return this.jobsService.getMapData(id);
  }

  /** POST /api/jobs — create a draft job with zone. */
  @Post()
  async create(@Body() body: unknown, @CurrentUser() user: AuthedUser) {
    const parsed = createJobSchema
      .omit({ clientUserId: true })
      .safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid input',
        issues: parsed.error.issues,
      });
    }
    // Clients can only create for themselves. Admins can pass an explicit clientUserId
    // (not implemented yet — overload later when admin job-creation is needed).
    return this.jobsService.create({ ...parsed.data, clientUserId: user.id });
  }

  /** POST /api/jobs/estimate — Smart Zones preview, no DB writes. */
  @Post('estimate')
  @HttpCode(200)
  async estimate(@Body() body: unknown) {
    const parsed = estimateZoneSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid input',
        issues: parsed.error.issues,
      });
    }
    return this.jobsService.estimate(parsed.data.polygon, parsed.data.leafletCount);
  }

  /** PATCH /api/jobs/:id — partial update; only allowed while status='draft'. */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthedUser,
  ) {
    const parsed = updateJobSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Invalid input', issues: parsed.error.issues });
    }
    // Ownership check: clients can only edit their own drafts.
    const existing = await this.jobsService.findOne(id);
    if (!existing) throw new NotFoundException(`Job ${id} not found`);
    if (user.role !== 'admin' && existing.clientUserId !== user.id) {
      throw new ForbiddenException('Not your campaign');
    }
    return this.jobsService.updateDraft(id, parsed.data);
  }

  /** POST /api/jobs/:id/confirm — locks in price + creates a pending invoice. */
  @Post(':id/confirm')
  @HttpCode(200)
  async confirm(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.jobsService.confirm(id, user.id);
  }

  /** DELETE /api/jobs/:id — only allowed while status='draft'. */
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.jobsService.deleteDraft(id);
  }
}
