-- Add notification_prefs JSONB column to users (in-app + email preferences).
-- Added live during dev via raw ALTER TABLE; this migration formalises it so
-- fresh deployments include the column.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB;
