-- Mobile number captured at signup, stored on business_profiles for the
-- profile editor. Added live during dev; this migration formalises it.

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS mobile TEXT;
