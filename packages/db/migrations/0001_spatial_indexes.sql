-- Spatial + time-series indexes that Drizzle can't yet express in TS.
-- Run AFTER drizzle-kit has applied the table definitions.

-- Polygon containment (drop-in-zone, coverage %, multi-job overlay).
CREATE INDEX IF NOT EXISTS zones_polygon_gist        ON zones        USING GIST (polygon);
CREATE INDEX IF NOT EXISTS sub_zones_polygon_gist    ON sub_zones    USING GIST (polygon);

-- "Drops near this point" / heatmap queries.
CREATE INDEX IF NOT EXISTS drops_location_gist       ON drops        USING GIST (location);

-- Live dropper pings — GIST for proximity, BRIN for time-range scans.
CREATE INDEX IF NOT EXISTS dropper_locations_loc_gist
  ON dropper_locations USING GIST (location);
CREATE INDEX IF NOT EXISTS dropper_locations_recorded_brin
  ON dropper_locations USING BRIN (recorded_at);

-- Trigger: keep drops.inside_zone in sync with sub_zone polygon.
-- (Optional — can be done in app code if you prefer.)
CREATE OR REPLACE FUNCTION drops_set_inside_zone()
RETURNS TRIGGER AS $$
DECLARE
  poly geography;
BEGIN
  SELECT sz.polygon INTO poly
  FROM assignments a
  JOIN sub_zones sz ON sz.id = a.sub_zone_id
  WHERE a.id = NEW.assignment_id;

  IF poly IS NOT NULL THEN
    NEW.inside_zone := ST_Contains(poly::geometry, NEW.location::geometry);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS drops_inside_zone_trg ON drops;
CREATE TRIGGER drops_inside_zone_trg
  BEFORE INSERT ON drops
  FOR EACH ROW
  EXECUTE FUNCTION drops_set_inside_zone();
