-- Owner-issued API keys with their own tier and lifetime, account display names, the live
-- chat room and the activity log. Safe to re-run; additive only. Existing keys keep their
-- meaning: tier NULL = the key follows its owner's account tier, expires_at NULL = no expiry.

-- A key with its own tier (FREE/SULTAN/SEPUH/DEWA) is limited to that tier and has its own
-- daily quota (key_quota_counters), whatever the account's tier is.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS tier text;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS issued_by uuid REFERENCES users(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_tier_check' AND conrelid = 'api_keys'::regclass) THEN
    ALTER TABLE api_keys ADD CONSTRAINT api_keys_tier_check CHECK (tier IS NULL OR tier IN ('FREE', 'SULTAN', 'SEPUH', 'DEWA')) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS key_quota_counters (
 api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
 usage_date date NOT NULL,
 request_count integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (api_key_id, usage_date)
);

-- Account name shown in the live chat and profile (NULL = derived from the email address).
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Live chat room (one public room for signed-in users; the email is never shown).
CREATE TABLE IF NOT EXISTS chat_messages (
 id bigserial PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
 created_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 deleted_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON chat_messages (user_id, created_at DESC);

-- Activity on the site for the owner panel: API calls (kind 'api') and page visits ('page').
-- Account events (logins, key changes, payments, ...) stay in audit_logs.
CREATE TABLE IF NOT EXISTS activity_log (
 id bigserial PRIMARY KEY,
 user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
 kind text NOT NULL CHECK (kind IN ('api', 'page')),
 path text NOT NULL,
 status integer,
 duration_ms integer,
 ip_address text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_log_created_idx ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_user_idx ON activity_log (user_id, created_at DESC);
