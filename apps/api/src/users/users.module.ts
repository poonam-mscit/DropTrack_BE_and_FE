import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller.js';
import { DroppersController } from './droppers.controller.js';
import { MeProfileController } from './me-profile.controller.js';
import { UsersAdminController } from './users-admin.controller.js';

@Module({
  controllers: [ClientsController, DroppersController, MeProfileController, UsersAdminController],
})
export class UsersModule {}
