import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { InvitesController } from './invites.controller.js';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [InvitesController],
})
export class InvitesModule {}
