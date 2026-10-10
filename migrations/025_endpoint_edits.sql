-- Developer panel → Endpoints → "Edit": name, path, description and category as shown on the site.
-- Empty = what the endpoint's code says. A changed path only changes the address callers use: the
-- row (tier, quota, checks, errors, backups) stays the same endpoint. Aman di-run ulang.
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS custom_name text;
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS custom_description text;
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS custom_path text;
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS custom_category text;
CREATE UNIQUE INDEX IF NOT EXISTS endpoints_custom_path_key ON endpoints (custom_path) WHERE custom_path IS NOT NULL;
