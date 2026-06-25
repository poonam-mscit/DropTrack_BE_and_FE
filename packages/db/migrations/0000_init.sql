-- DropTrack — initial migration prelude.
-- Run BEFORE applying the generated Drizzle migration so that
-- citext / postgis types are available and GIST/BRIN indexes can be created.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- After `drizzle-kit push` has created the tables, run:
--    psql ... -f 0001_spatial_indexes.sql
