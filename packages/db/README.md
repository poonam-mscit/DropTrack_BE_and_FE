# `@droptrack/db`

PostgreSQL 16 + PostGIS schema for DropTrack, defined with Drizzle ORM.

## First-time setup

```bash
# 1. From the repo root, install everything
pnpm install

# 2. Bring up Postgres + PostGIS via Docker
docker run -d --name droptrack-pg \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=droptrack \
  -p 5432:5432 \
  postgis/postgis:16-3.4

# 3. Copy env template
cp .env.example .env

# 4. One-shot init: extensions → schema → spatial indexes
pnpm db:init

# 5. Seed dev data (1 admin, 1 client, 2 droppers, 1 paid job)
pnpm db:seed

# 6. Confirm
psql -h localhost -U postgres -d droptrack -c "SELECT PostGIS_Version();"
```

## Day-to-day

```bash
pnpm db:push       # apply schema changes
pnpm db:studio     # browser GUI on localhost:4983
pnpm db:seed       # idempotent — re-run safely
```

## Layout

```
packages/db/
├── src/
│   ├── schema.ts      ← 22-table Drizzle schema
│   ├── index.ts       ← db client + re-exports
│   └── seed.ts        ← idempotent dev seed
├── migrations/
│   ├── 0000_init.sql           ← extensions (postgis, citext, uuid-ossp)
│   └── 0001_spatial_indexes.sql ← GIST/BRIN + drops.inside_zone trigger
├── drizzle.config.ts
└── package.json
```

## Conventions

- **Money:** integer cents, never floats.
- **Locations:** `geography(*, 4326)` — PostGIS returns metres natively.
- **PII:** `tfn_encrypted`, `bank_account_encrypted` are KMS-encrypted in app code.
- **Time-series:** `dropper_locations` partitioned by month in prod; archive >90 days.
- **Audit:** every state change goes through `events`.
- **Idempotency:** Stripe webhook IDs land in `webhook_events` to dedupe retries.

## Importing

```ts
import { db, jobs, users } from '@droptrack/db';

const myJobs = await db.select().from(jobs).where(eq(jobs.status, 'active'));
```
