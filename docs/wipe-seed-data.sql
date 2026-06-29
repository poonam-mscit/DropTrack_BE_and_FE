-- Pre-launch seed-data wipe.
-- Run on the production DB immediately after `drizzle-kit migrate` and
-- before any real invites are issued.
--
--   psql "$DATABASE_URL" -f docs/wipe-seed-data.sql
--
-- Idempotent — safe to re-run.

BEGIN;

-- Seeded demo accounts that ship with the dev seed script and ended up in
-- this DB during development. Real droppers/clients won't share these emails.
WITH doomed AS (
  SELECT id FROM users
  WHERE email IN (
    'james@droptrack.au',
    'maya@droptrack.au',
    'sarah@belleproperty.com.au',
    'ops@droptrack.au'                  -- ops console demo admin
  )
)
DELETE FROM users WHERE id IN (SELECT id FROM doomed);

-- Throwaway invite emails used during smoke tests (anything starting with
-- "test.invite+" or "newdropper.demo" or "droptrackdemo+").
DELETE FROM users
WHERE email LIKE 'test.invite+%@thelinetech.uk'
   OR email LIKE 'newdropper.demo%@thelinetech.uk'
   OR email LIKE 'droptrackdemo+%@gmail.com';

-- Drop campaigns that were created against those users (cascade by job id).
DELETE FROM jobs
WHERE client_user_id NOT IN (SELECT id FROM users);

-- Anything left orphaned in invites.
DELETE FROM invites WHERE invited_by_user_id NOT IN (SELECT id FROM users)
                       OR accepted_user_id NOT IN (SELECT id FROM users WHERE id = accepted_user_id);

-- Quick sanity check.
SELECT 'users'      AS table_name, count(*) FROM users
UNION ALL
SELECT 'jobs',                          count(*) FROM jobs
UNION ALL
SELECT 'assignments',                   count(*) FROM assignments
UNION ALL
SELECT 'invites',                       count(*) FROM invites;

COMMIT;
