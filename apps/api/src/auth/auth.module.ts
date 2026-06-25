import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { CognitoAuthService } from './cognito-auth.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    CognitoAuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [CognitoAuthService],
})
export class AuthModule {}
