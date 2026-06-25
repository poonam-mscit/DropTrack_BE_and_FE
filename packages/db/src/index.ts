/**
 * @droptrack/db
 *
 * The DB client + schema + types. Import like:
 *   import { db, schema } from '@droptrack/db';
 *   import { jobs, users } from '@droptrack/db/schema';
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export * from './schema.js';
export { schema };

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required (see .env.example).');
}

/**
 * Singleton postgres connection. NestJS/Next.js share the same pool via
 * the `db` export below.
 */
const client = postgres(databaseUrl, {
  max: 10,
  idle_timeout: 20,
  prepare: false, // PostGIS sometimes confuses prepared-statement caches
});

export const db = drizzle(client, { schema, logger: process.env.DB_LOG === '1' });

export type Database = typeof db;
