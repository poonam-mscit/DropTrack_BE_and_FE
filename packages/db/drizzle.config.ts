import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. See .env.example at the repo root.');
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  // Skip the extension types — they're created by 0000_init.sql.
  extensionsFilters: ['postgis'],
  verbose: true,
  strict: true,
});
