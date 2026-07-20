ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS target_leaflets integer;

-- Backfill: if a sub_zone exists, copy its target; otherwise evenly divide the
-- parent job's leaflet_count across all assignments on that job.
UPDATE assignments a
SET target_leaflets = sz.target_leaflets
FROM sub_zones sz
WHERE a.sub_zone_id = sz.id AND a.target_leaflets IS NULL;

UPDATE assignments a
SET target_leaflets = CEIL(j.leaflet_count::numeric / GREATEST(1, cnt.n))
FROM jobs j,
     (SELECT job_id, COUNT(*) AS n FROM assignments GROUP BY job_id) cnt
WHERE a.job_id = j.id
  AND a.job_id = cnt.job_id
  AND a.target_leaflets IS NULL;
