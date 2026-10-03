-- Yannz API platform schema expansion. Safe to re-run; no destructive operations.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_usage integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_usage_reset date NOT NULL DEFAULT (timezone('UTC', now())::date);
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_uidx ON users(google_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uidx ON users(lower(email));
CREATE TABLE IF NOT EXISTS api_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name text NOT NULL, key_hash text NOT NULL UNIQUE, key_prefix text NOT NULL, idempotency_key text,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
 last_used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_idempotency_uidx ON api_keys(user_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS endpoints (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, path text NOT NULL UNIQUE,
 description text NOT NULL DEFAULT '', method text NOT NULL DEFAULT 'GET', status text NOT NULL DEFAULT 'active',
 locked boolean NOT NULL DEFAULT false, minimum_tier text NOT NULL DEFAULT 'FREE', plugin text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS plugin text;
CREATE TABLE IF NOT EXISTS daily_quota_counters (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, usage_date date NOT NULL, request_count integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,usage_date));
CREATE TABLE IF NOT EXISTS api_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL, endpoint_id uuid REFERENCES endpoints(id) ON DELETE SET NULL,
 usage_date date NOT NULL, request_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, endpoint_id, usage_date)
);
CREATE TABLE IF NOT EXISTS orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 order_code text NOT NULL UNIQUE, tier text NOT NULL CHECK(tier IN ('SULTAN','SEPUH','DEWA')),
 amount integer NOT NULL CHECK(amount > 0), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','rejected','cancelled','expired')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz, expires_at timestamptz
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_uidx ON orders(user_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE TABLE IF NOT EXISTS payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider text NOT NULL,
 payment_method text NOT NULL, transaction_id text, provider_reference text, amount integer NOT NULL,
 proof_url text, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','rejected','expired')),
 verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_url text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_reference text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS payments_transaction_uidx ON payments(provider, transaction_id) WHERE transaction_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL, target_type text, target_id text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 ip_address inet, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS server_settings (
 id integer PRIMARY KEY DEFAULT 1 CHECK(id=1), maintenance_enabled boolean NOT NULL DEFAULT false,
 maintenance_message text NOT NULL DEFAULT 'Yannz API sedang dalam maintenance.', updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO server_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
