DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transport_mode') THEN
    CREATE TYPE transport_mode AS ENUM ('walking', 'bicycle', 'e_scooter');
  END IF;
END $$;

ALTER TABLE dropper_profiles
  ADD COLUMN IF NOT EXISTS preferred_transport transport_mode NOT NULL DEFAULT 'walking';
