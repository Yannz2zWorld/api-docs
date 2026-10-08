-- CDN files stored in Cloudflare R2 (large uploads, up to 200 MB) next to the small ones kept in
-- Postgres. Safe to re-run; additive only. Run after 012_cdn_files.sql.
--   storage : 'db' (bytes in the data column, as before) or 'r2' (bytes in the R2 bucket, key = id)
--   ready   : false while a browser upload to R2 is still in progress
ALTER TABLE cdn_files ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE cdn_files ADD COLUMN IF NOT EXISTS storage text NOT NULL DEFAULT 'db';
ALTER TABLE cdn_files ADD COLUMN IF NOT EXISTS ready boolean NOT NULL DEFAULT true;
ALTER TABLE cdn_files ALTER COLUMN data DROP NOT NULL;
ALTER TABLE cdn_files ALTER COLUMN size TYPE bigint;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cdn_files_storage_chk' AND conrelid = 'cdn_files'::regclass) THEN
    ALTER TABLE cdn_files ADD CONSTRAINT cdn_files_storage_chk CHECK (storage IN ('db', 'r2'));
  END IF;
END $$;
