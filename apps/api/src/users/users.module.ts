import { Module } from '@nestjs/common';
import { DroppersController } from './droppers.controller.js';
import { MeProfileController } from './me-profile.controller.js';
import { UsersAdminController } from './users-admin.controller.js';

@Module({
  controllers: [DroppersController, MeProfileController, UsersAdminController],
})
export class UsersModule {}
