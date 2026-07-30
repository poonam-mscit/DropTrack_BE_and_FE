-- Suburb pricing feature — creates the reference tables the app expects and
-- adds OSM linkage columns. Idempotent so it can be re-applied safely.

CREATE TABLE IF NOT EXISTS "suburbs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "state" text NOT NULL,
  "postcode" text NOT NULL,
  "polygon" geography(MultiPolygon, 4326) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "suburb_pricing" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "suburb_id" uuid NOT NULL REFERENCES "suburbs"("id") ON DELETE CASCADE,
  "rate_per_leaflet_cents" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "suburbs" ADD COLUMN IF NOT EXISTS "osm_id" text;
ALTER TABLE "suburbs" ADD COLUMN IF NOT EXISTS "osm_type" text;
ALTER TABLE "suburbs" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "suburb_pricing_suburb_id_idx" ON "suburb_pricing" ("suburb_id");
CREATE INDEX IF NOT EXISTS "suburbs_osm_idx" ON "suburbs" ("osm_id", "osm_type");
CREATE INDEX IF NOT EXISTS "suburbs_name_postcode_idx" ON "suburbs" ("name", "postcode");
