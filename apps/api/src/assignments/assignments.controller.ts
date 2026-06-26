import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser, Roles, type AuthedUser } from '../auth/auth.decorators.js';
import { createAssignmentsSchema, markDropSchema, markLocationSchema } from './assignments.dto.js';
import { AssignmentsService } from './assignments.service.js';

/* ─────────────── admin: create + list per job ─────────────── */

@Controller('jobs/:jobId/assignments')
@Roles('admin')
export class JobAssignmentsController {
  constructor(private readonly svc: AssignmentsService) {}

  @Get()
  list(@Param('jobId') jobId: string) {
    return this.svc.listForJob(jobId);
  }

  /** GET /api/jobs/:jobId/assignments/live — current dropper positions for the client tracking page. */
  @Get('live')
  @Roles('admin', 'client')
  live(@Param('jobId') jobId: string) {
    return this.svc.liveState(jobId);
  }

  @Post()
  create(@Param('jobId') jobId: string, @Body() body: unknown, @CurrentUser() user: AuthedUser) {
    const parsed = createAssignmentsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Invalid input', issues: parsed.error.issues });
    }
    return this.svc.createAssignments(jobId, parsed.data, user.id);
  }
}

/* ─────────────── dropper: my queue + lifecycle + drops ─────────────── */

@Controller('me')
@Roles('dropper')
export class MyAssignmentsController {
  constructor(private readonly svc: AssignmentsService) {}

  @Get('assignments')
  myAssignments(@CurrentUser() user: AuthedUser) {
    return this.svc.listForDropper(user.id);
  }

  /** GET /api/me/assignments/:id — single row in the same shape as the list. */
  @Get('assignments/:id')
  async myAssignment(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    const rows = await this.svc.listForDropper(user.id);
    const row = rows.find((r) => r.assignment.id === id);
    if (!row) throw new BadRequestException(`Assignment ${id} not found for this dropper.`);
    return row;
  }

  @Post('assignments/:id/start')
  @HttpCode(200)
  start(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.svc.start(id, user.id);
  }

  @Post('assignments/:id/pause')
  @HttpCode(200)
  pause(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.svc.pause(id, user.id);
  }

  @Post('assignments/:id/resume')
  @HttpCode(200)
  resume(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.svc.resume(id, user.id);
  }

  @Post('assignments/:id/complete')
  @HttpCode(200)
  complete(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.svc.complete(id, user.id);
  }

  @Post('drops')
  drop(@Body() body: unknown, @CurrentUser() user: AuthedUser) {
    const parsed = markDropSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Invalid input', issues: parsed.error.issues });
    }
    return this.svc.markDrop(parsed.data, user.id);
  }

  /** POST /api/me/locations — dropper GPS ping (~every 5s while assignment is started). */
  @Post('locations')
  location(@Body() body: unknown, @CurrentUser() user: AuthedUser) {
    const parsed = markLocationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Invalid input', issues: parsed.error.issues });
    }
    return this.svc.recordLocation(parsed.data, user.id);
  }
}
