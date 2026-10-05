-- Completes tables that already existed (in an older shape) before 002_platform.sql ran.
-- CREATE TABLE IF NOT EXISTS skips existing tables, so their newer columns were never added.
-- Safe to re-run; additive only. New columns are nullable or have defaults so existing rows are kept.
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'GET';
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS minimum_tier text NOT NULL DEFAULT 'FREE';
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS endpoints_path_uidx ON endpoints(path);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_code text;
UPDATE orders SET order_code = 'LEGACY-' || id::text WHERE order_code IS NULL;
ALTER TABLE orders ALTER COLUMN order_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_code_uidx ON orders(order_code);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'unknown';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_id text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

ALTER TABLE daily_quota_counters ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS api_key_id uuid;
ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS api_usage_user_endpoint_date_uidx ON api_usage(user_id, endpoint_id, usage_date);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_type text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address inet;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS maintenance_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS maintenance_message text NOT NULL DEFAULT 'Yannz API sedang dalam maintenance.';
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS updated_by uuid;
INSERT INTO server_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
