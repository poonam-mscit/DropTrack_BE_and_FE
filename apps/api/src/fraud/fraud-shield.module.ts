import { Global, Module } from '@nestjs/common';
import { FraudShieldService } from './fraud-shield.service.js';

@Global()
@Module({
  providers: [FraudShieldService],
  exports: [FraudShieldService],
})
export class FraudShieldModule {}
