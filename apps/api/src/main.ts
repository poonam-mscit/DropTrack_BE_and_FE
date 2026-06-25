import 'reflect-metadata';
import { Logger, type RawBodyRequest } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
    // Nest 10 built-in: keeps the raw body on req.rawBody for signature verification.
    rawBody: true,
  });
  app.setGlobalPrefix('api', { exclude: ['health', 'webhooks/stripe'] });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  Logger.log(`DropTrack API listening on http://localhost:${port}`, 'Bootstrap');
}

// Re-export for controllers that need it
export type { RawBodyRequest };

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
