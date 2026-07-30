-- Job lock: admin can freeze a draft so the client can't tweak scope while
-- work is being organised. Paid jobs are auto-locked (in the app layer) and
-- can never be unlocked.
ALTER TABLE jobs ADD COLUMN locked_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN locked_by UUID REFERENCES users(id);

-- Backfill: already-paid jobs are conceptually locked from the moment they
-- were paid. Use client_user_id as a placeholder locked_by for historical
-- rows since we don't have the original admin id.
UPDATE jobs
  SET locked_at = paid_at, locked_by = client_user_id
  WHERE paid_at IS NOT NULL AND locked_at IS NULL;

CREATE INDEX jobs_locked_idx ON jobs (locked_at) WHERE locked_at IS NOT NULL;
