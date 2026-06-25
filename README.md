# DropTrack

AI-powered leaflet distribution platform — Australia.

> Real estate agents, clinics, political campaigns, retail. They pay for leaflets to be dropped. We track every drop with GPS, prove coverage, and deliver an AI-generated campaign report.

## Stack

- **Region:** AWS Sydney (`ap-southeast-2`) only — Privacy Act 1988 compliance.
- **Backend:** NestJS · PostgreSQL 16 + PostGIS · Redis · BullMQ · Socket.IO
- **Web (client + admin):** Next.js 15 · React · TypeScript · Tailwind
- **Mobile (dropper):** React Native + Expo
- **Maps:** Mapbox · **Payments:** Stripe Checkout · **AI:** Mistral Small 3 via AWS Bedrock
- **Auth:** AWS Cognito · **Email:** AWS SES · **Push:** Expo Push

See [`memory`](file:///Users/poonam/.claude/projects/-Users-poonam-DropTrack/memory) for locked product + stack decisions.

## Layout

```
droptrack/
├── apps/
│   ├── web/        ← Next.js (client + admin)
│   ├── mobile/     ← Expo (dropper)
│   └── api/        ← NestJS
├── packages/
│   ├── db/         ← Drizzle schema + Postgres client     ← present
│   ├── ui/         ← shared design system                  (later)
│   ├── types/      ← shared Zod schemas                    (later)
│   └── ai/         ← Bedrock client + prompts              (later)
├── wireframes/     ← HTML/CSS clickable wireframes (Phase −1)
└── infra/ec2/      ← EC2 provisioning scripts              (later)
```

## Quickstart (local dev)

```bash
# 1. Tools
brew install pnpm postgresql@16
node --version   # need >=22 (use nvm if not)

# 2. Install
pnpm install

# 3. Bring up Postgres + PostGIS
docker run -d --name droptrack-pg \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=droptrack \
  -p 5432:5432 \
  postgis/postgis:16-3.4

# 4. Env
cp .env.example .env

# 5. Init the database (extensions + schema + spatial indexes)
pnpm db:init

# 6. Seed sample data
pnpm db:seed

# 7. Open the DB browser
pnpm db:studio
```

After step 7 you should see 22 tables with sample data at <http://localhost:4983>.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run all `dev` tasks in parallel (turbo) |
| `pnpm build` | Build everything |
| `pnpm lint` | Biome lint |
| `pnpm format` | Biome format |
| `pnpm typecheck` | TS typecheck across the monorepo |
| `pnpm db:init` | Create DB + extensions + apply schema + spatial indexes |
| `pnpm db:push` | Apply Drizzle schema changes |
| `pnpm db:studio` | Browser DB GUI on `localhost:4983` |
| `pnpm db:seed` | Re-seed local dev data (idempotent) |

## Locked decisions

- Worker model: **employees** (handled by Employment Hero externally).
- GPS data ownership: **DropTrack admin** (in Postgres + S3 backups).
- Drop proof: **GPS pin only** (no photo).
- Cancellation: **Stripe partial refund > 48 hrs · no refund after start.**
- Payments: **Stripe Checkout hosted UI** — zero card data in our DB.

## Development phases

See `memory/project_phases.md` (locked in `/Users/poonam/.claude/projects/-Users-poonam-DropTrack/memory/`).

Currently at end of **Phase 0** (foundation): schema + monorepo done.
Next: provision EC2, set up Cognito + SES.
