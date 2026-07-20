-- Runtime-tunable settings (basePerLeafletCents, gstPct, etc.) read by the
-- AI Smart Zones estimator + admin pricing page.
--
-- Added live during dev via raw CREATE TABLE; this migration formalises it.

CREATE TABLE IF NOT EXISTS app_settings (
  key                  TEXT      PRIMARY KEY,
  value                JSONB     NOT NULL,
  description          TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_user_id   UUID      REFERENCES users(id) ON DELETE SET NULL
);
