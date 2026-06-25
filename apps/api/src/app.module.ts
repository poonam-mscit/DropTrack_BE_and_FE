import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module.js';
import { AssignmentsModule } from './assignments/assignments.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EmailModule } from './email/email.module.js';
import { FraudShieldModule } from './fraud/fraud-shield.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';
import { JobsModule } from './jobs/jobs.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    DbModule,
    AuthModule,
    EmailModule,
    RealtimeModule,
    FraudShieldModule,
    AiModule,
    JobsModule,
    PaymentsModule,
    AssignmentsModule,
    SettingsModule,
    UsersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
