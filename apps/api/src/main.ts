import 'reflect-metadata';
import { Logger, type RawBodyRequest } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

/**
 * Allowed origins for the HTTP API and the socket.io gateway.
 *
 * In production we accept only droptrack-owned origins. CORS_ORIGIN can extend
 * this list for staging / preview environments — comma-separated.
 */
function allowedOrigins(): string[] {
  const explicit = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (explicit.length) return explicit;

  if (process.env.NODE_ENV === 'production') {
    return [
      'https://portal.droptrack.com.au',
      'https://droptrack.com.au',
      'https://www.droptrack.com.au',
    ];
  }
  // Dev / local — Next.js webapp + LAN access for mobile dev (Expo / phones).
  return [
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    /^http:\/\/192\.168\.\d+\.\d+:3002$/.source,
  ];
}

async function bootstrap() {
  const origins = allowedOrigins();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      // Each origin can be a literal string or a regex. Express CORS will
      // call back into us with the request origin so we can decide.
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // server-to-server / curl
        const ok = origins.some((o) => {
          if (o.startsWith('/') || o.includes('\\')) {
            try {
              return new RegExp(o).test(origin);
            } catch {
              return false;
            }
          }
          return o === origin;
        });
        cb(ok ? null : new Error(`Origin ${origin} not allowed by CORS`), ok);
      },
      credentials: true,
    },
    // Nest 10 built-in: keeps the raw body on req.rawBody for signature verification.
    rawBody: true,
  });
  app.setGlobalPrefix('api', { exclude: ['health'] });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  Logger.log(`DropTrack API listening on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`CORS allowed: ${origins.join(', ')}`, 'Bootstrap');
}

// Re-export for controllers that need it
export type { RawBodyRequest };

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
