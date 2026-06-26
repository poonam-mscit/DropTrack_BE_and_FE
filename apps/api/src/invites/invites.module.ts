import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InvitesController } from './invites.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [InvitesController],
})
export class InvitesModule {}
