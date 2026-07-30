import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile('../../.env');
  } catch {
    try {
      process.loadEnvFile('.env');
    } catch {}
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required.');
  process.exit(1);
}

console.log(`Using DATABASE_URL from environment.`);

async function run() {
  const sql = postgres(databaseUrl!, { max: 1 });

  try {
    // 1. Apply migrations/0000_init.sql
    const initSqlUrl = new URL('../migrations/0000_init.sql', import.meta.url);
    console.log(`Reading initial migration from: ${initSqlUrl.toString()}`);
    const initSql = fs.readFileSync(initSqlUrl, 'utf8');
    console.log('Applying extensions (postgis, citext, uuid-ossp)...');
    await sql.unsafe(initSql);
    console.log('Extensions applied successfully.');

    // 2. Run drizzle-kit generate to create migration files
    console.log('Generating Drizzle schemas...');
    execSync('npx drizzle-kit generate', {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      stdio: 'inherit',
    });

    // 3. Run fix-geo.js to clean up double quotes on geography columns
    console.log('Cleaning up geography column constraints for Postgres...');
    execSync('node fix-geo.js', {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      stdio: 'inherit',
    });

    // 4. Apply the generated drizzle/0000_plain_exodus.sql schema migration
    const drizzleSqlUrl = new URL('../drizzle/0000_plain_exodus.sql', import.meta.url);
    console.log(`Reading schema migration from: ${drizzleSqlUrl.toString()}`);
    const drizzleSql = fs.readFileSync(drizzleSqlUrl, 'utf8');
    console.log('Applying Drizzle schemas...');
    await sql.unsafe(drizzleSql);
    console.log('Drizzle schemas applied successfully.');

    // 5. Apply migrations/0001_spatial_indexes.sql
    const spatialSqlUrl = new URL('../migrations/0001_spatial_indexes.sql', import.meta.url);
    console.log(`Reading spatial indexes / triggers from: ${spatialSqlUrl.toString()}`);
    const spatialSql = fs.readFileSync(spatialSqlUrl, 'utf8');
    console.log('Applying spatial indexes and triggers...');
    await sql.unsafe(spatialSql);
    console.log('Spatial indexes and triggers applied successfully.');

    // 6. Apply migrations/0008_suburbs_osm_fields.sql
    const osmFieldsSqlUrl = new URL('../migrations/0008_suburbs_osm_fields.sql', import.meta.url);
    console.log(`Reading OSM suburb fields migration from: ${osmFieldsSqlUrl.toString()}`);
    const osmFieldsSql = fs.readFileSync(osmFieldsSqlUrl, 'utf8');
    console.log('Applying OSM suburb fields migration...');
    await sql.unsafe(osmFieldsSql);
    console.log('OSM suburb fields migration applied successfully.');

    console.log('Database initialization complete!');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
