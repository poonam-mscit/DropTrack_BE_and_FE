ALTER TABLE "suburbs" ADD COLUMN IF NOT EXISTS "osm_id" text;
ALTER TABLE "suburbs" ADD COLUMN IF NOT EXISTS "osm_type" text;
ALTER TABLE "suburbs" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "suburb_pricing_suburb_id_idx" ON "suburb_pricing" ("suburb_id");
CREATE INDEX IF NOT EXISTS "suburbs_osm_idx" ON "suburbs" ("osm_id", "osm_type");
