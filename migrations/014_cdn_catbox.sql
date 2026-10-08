-- CDN files hosted on catbox.moe (large uploads, up to 200 MB, when Cloudflare R2 is not set up).
-- Safe to re-run; additive only. Run after 013_cdn_r2.sql.
--   storage 'catbox' : bytes on catbox.moe
--   url              : the files.catbox.moe link /cdn/<id> redirects to
ALTER TABLE cdn_files ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE cdn_files DROP CONSTRAINT IF EXISTS cdn_files_storage_chk;
ALTER TABLE cdn_files ADD CONSTRAINT cdn_files_storage_chk CHECK (storage IN ('db', 'r2', 'catbox'));
