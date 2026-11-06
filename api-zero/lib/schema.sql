-- API Zero schema. Dijalankan otomatis saat server pertama kali butuh database (idempotent).
CREATE TABLE IF NOT EXISTS users (
  id              BIGSERIAL PRIMARY KEY,
  public_id       TEXT UNIQUE NOT NULL,
  username        TEXT UNIQUE NOT NULL,
  email           TEXT UNIQUE,
  phone           TEXT,
  password_hash   TEXT,
  google_sub      TEXT UNIQUE,
  avatar          TEXT,
  avatar_v        INT NOT NULL DEFAULT 0,
  tier            TEXT NOT NULL DEFAULT 'free',
  tier_expires_at TIMESTAMPTZ,
  balance         BIGINT NOT NULL DEFAULT 0,
  banned          BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason      TEXT,
  session_version INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS api_keys (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash     TEXT UNIQUE NOT NULL,
  key_enc      TEXT NOT NULL,
  label        TEXT,
  custom       BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys(user_id);
CREATE TABLE IF NOT EXISTS usage_daily (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     DATE NOT NULL,
  count   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS reset_codes (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS blacklist (
  value      TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS endpoint_settings (
  path       TEXT PRIMARY KEY,
  plan       TEXT,
  locked     BOOLEAN NOT NULL DEFAULT FALSE,
  hidden     BOOLEAN NOT NULL DEFAULT FALSE,
  deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS custom_endpoints (
  path       TEXT PRIMARY KEY,
  spec       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS orders (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  tier        TEXT,
  amount      BIGINT NOT NULL,
  method      TEXT,
  sender      TEXT,
  note        TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  admin_note  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status, created_at DESC);
CREATE TABLE IF NOT EXISTS chat_messages (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_created_idx ON chat_messages(id DESC);
