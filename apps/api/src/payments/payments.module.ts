import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { stripeProvider } from './stripe.provider.js';

@Module({
  imports: [JobsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, stripeProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
