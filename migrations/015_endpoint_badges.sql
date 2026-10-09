-- Small label the developer can put on an endpoint in the catalog: new (green), hot (red),
-- recommend (yellow), or none (NULL). Safe to re-run; additive only.
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS badge text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'endpoints_badge_chk' AND conrelid = 'endpoints'::regclass) THEN
    ALTER TABLE endpoints ADD CONSTRAINT endpoints_badge_chk CHECK (badge IS NULL OR badge IN ('new', 'hot', 'recommend'));
  END IF;
END $$;
