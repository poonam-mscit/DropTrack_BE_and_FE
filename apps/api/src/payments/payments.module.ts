import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module.js';
import { PaymentsController } from './payments.controller.js';

/**
 * Payments module — invoice listing only. We dropped Stripe in favour of
 * admin-marked bank-transfer invoices, so this module just exposes the
 * read endpoints. Payment-state transitions live in JobsService.adminMarkPaid().
 */
@Module({
  imports: [JobsModule],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
