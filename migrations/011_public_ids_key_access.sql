-- Numeric user IDs, Public / Private / Owner API keys and disabled keys.
-- Safe to re-run; additive only (the one replaced CHECK constraint only gains a value).
-- Before it runs everything keeps working: profiles show the internal ID, and the new key
-- features answer MIGRATION_REQUIRED.

-- 1. Numeric user ID shown on the profile and in the owner panel (the uuid stays the primary
--    key). Each account gets a random unique number in 10100000..12345678 when it is created;
--    the owner (OWNER_EMAIL) is always shown as 10000000 by the application.
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id bigint;
CREATE UNIQUE INDEX IF NOT EXISTS users_public_id_uidx ON users(public_id);

CREATE OR REPLACE FUNCTION yannz_random_public_id() RETURNS bigint
LANGUAGE plpgsql VOLATILE AS $$
DECLARE v bigint;
BEGIN
  LOOP
    v := 10100000 + floor(random() * (12345678 - 10100000 + 1))::bigint;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE public_id = v);
  END LOOP;
  RETURN v;
END $$;

ALTER TABLE users ALTER COLUMN public_id SET DEFAULT yannz_random_public_id();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM users WHERE public_id IS NULL ORDER BY created_at LOOP
    UPDATE users SET public_id = yannz_random_public_id() WHERE id = r.id;
  END LOOP;
END $$;

-- 2. Key kinds for owner-made keys. NULL = a personal key (made by a user, or assigned by the
--    owner before this migration): it keeps working exactly as before.
--    public  = anyone holding the key may use it;
--    private = only the accounts in api_key_access may use it;
--    owner   = only the owner (OWNER_EMAIL) may use it (the "Yannz2z" key). At most one.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS visibility text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_visibility_chk' AND conrelid = 'api_keys'::regclass) THEN
    ALTER TABLE api_keys ADD CONSTRAINT api_keys_visibility_chk CHECK (visibility IS NULL OR visibility IN ('public', 'private', 'owner'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_one_owner_key_uidx ON api_keys((visibility)) WHERE visibility = 'owner';

-- 3. Keys can be switched off and on again ("disabled") besides being revoked. Every
--    single-column CHECK on api_keys.status that does not allow 'disabled' (the inline one from
--    002, api_keys_status_chk from 005) is replaced by one that does; nothing else changes.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
     WHERE con.conrelid = 'api_keys'::regclass AND con.contype = 'c'
       AND array_length(con.conkey, 1) = 1 AND att.attname = 'status'
       AND pg_get_constraintdef(con.oid) NOT LIKE '%disabled%'
  LOOP
    EXECUTE format('ALTER TABLE api_keys DROP CONSTRAINT %I', c.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_status_chk' AND conrelid = 'api_keys'::regclass) THEN
    ALTER TABLE api_keys ADD CONSTRAINT api_keys_status_chk CHECK (status IN ('active', 'revoked', 'disabled')) NOT VALID;
  END IF;
END $$;

-- 4. Who may use a private key.
CREATE TABLE IF NOT EXISTS api_key_access (
 api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 added_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (api_key_id, user_id)
);
CREATE INDEX IF NOT EXISTS api_key_access_user_idx ON api_key_access(user_id);
