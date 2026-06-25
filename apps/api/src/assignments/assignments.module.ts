import { Module } from '@nestjs/common';
import {
  JobAssignmentsController,
  MyAssignmentsController,
} from './assignments.controller.js';
import { AssignmentsService } from './assignments.service.js';

@Module({
  controllers: [JobAssignmentsController, MyAssignmentsController],
  providers: [AssignmentsService],
})
export class AssignmentsModule {}
