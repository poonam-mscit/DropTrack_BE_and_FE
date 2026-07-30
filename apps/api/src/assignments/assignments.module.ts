import { Module } from '@nestjs/common';
import {
  AdminAssignmentsController,
  JobAssignmentsController,
  MyAssignmentsController,
} from './assignments.controller.js';
import { AssignmentsService } from './assignments.service.js';

@Module({
  controllers: [AdminAssignmentsController, JobAssignmentsController, MyAssignmentsController],
  providers: [AssignmentsService],
})
export class AssignmentsModule {}
