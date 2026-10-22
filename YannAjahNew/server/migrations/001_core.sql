-- YannAjahNew — skema inti backend lisensi & dashboard.
-- Dijalankan oleh server/lib/migrate.js di dalam satu transaksi. Jangan ubah file ini setelah
-- diterapkan di production: buat migrasi baru (runner menolak file yang checksum-nya berubah).
--
-- Kebijakan hapus:
--   accounts, bots  : soft-delete (deleted_at). Slot kuota langsung bebas. Hard-delete hanya lewat
--                     CLI `purge` (DEVELOPER) untuk baris yang sudah soft-delete lama.
--   audit_logs      : append-only (trigger menolak UPDATE/DELETE).
--   sesi / attempts : boleh dihapus oleh job pembersihan (data operasional).

CREATE TABLE ranks (
  code               text PRIMARY KEY CHECK (code IN ('MEMBER','RESELLER','PARTNER','OWNER','CEO','DEVELOPER')),
  level              smallint NOT NULL UNIQUE CHECK (level > 0),
  max_numbers        integer CHECK (max_numbers IS NULL OR max_numbers >= 0),        -- NULL = unlimited
  max_managed_users  integer CHECK (max_managed_users IS NULL OR max_managed_users >= 0),
  assignable         boolean NOT NULL DEFAULT true,   -- false = hanya lewat prosedur CLI khusus
  description        text NOT NULL
);

CREATE TABLE permissions (
  code        text PRIMARY KEY CHECK (code ~ '^[a-z]+(\.[a-z_]+)+$'),
  description text NOT NULL
);

CREATE TABLE rank_permissions (
  rank_code       text NOT NULL REFERENCES ranks(code) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (rank_code, permission_code)
);

CREATE TABLE accounts (
  id                 bigserial PRIMARY KEY,
  username           text NOT NULL CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  display_name       text NOT NULL DEFAULT '' CHECK (length(display_name) <= 80),
  email              text CHECK (email IS NULL OR (length(email) <= 254 AND email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+$')),
  email_verified     boolean NOT NULL DEFAULT false,
  google_sub         text CHECK (google_sub IS NULL OR length(google_sub) BETWEEN 1 AND 255),
  phone_number       text CHECK (phone_number IS NULL OR phone_number ~ '^[1-9][0-9]{7,14}$'),
  rank_code          text NOT NULL DEFAULT 'MEMBER' REFERENCES ranks(code),
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','suspended','banned')),
  status_reason      text CHECK (status_reason IS NULL OR length(status_reason) <= 500),
  status_changed_by  bigint REFERENCES accounts(id) ON DELETE SET NULL,
  status_changed_at  timestamptz,
  manager_id         bigint REFERENCES accounts(id) ON DELETE RESTRICT,
  created_by         bigint REFERENCES accounts(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  last_login_at      timestamptz,
  deleted_at         timestamptz,
  deleted_by         bigint REFERENCES accounts(id) ON DELETE SET NULL,
  CHECK (manager_id IS NULL OR manager_id <> id),
  CHECK (status = 'active' OR status_changed_at IS NOT NULL)
);
CREATE UNIQUE INDEX accounts_username_uq ON accounts (username) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX accounts_email_uq    ON accounts (email) WHERE email IS NOT NULL AND deleted_at IS NULL;
-- Identitas Google unik di SEMUA baris (termasuk yang dihapus) agar akun yang dihapus/diban tidak bisa daftar ulang diam-diam.
CREATE UNIQUE INDEX accounts_google_uq   ON accounts (google_sub) WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX accounts_phone_uq    ON accounts (phone_number) WHERE phone_number IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX accounts_manager_idx ON accounts (manager_id) WHERE deleted_at IS NULL;
CREATE INDEX accounts_rank_idx    ON accounts (rank_code) WHERE deleted_at IS NULL;

CREATE TABLE bots (
  id                  bigserial PRIMARY KEY,
  owner_id            bigint NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,   -- kuota nomor dihitung ke akun ini
  user_account_id     bigint REFERENCES accounts(id) ON DELETE SET NULL,            -- akun yang memakai bot (opsional)
  bot_name            text NOT NULL CHECK (length(bot_name) BETWEEN 1 AND 60),
  phone_number        text NOT NULL CHECK (phone_number ~ '^[1-9][0-9]{7,14}$'),
  connection_status   text NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('disconnected','connecting','connected')),
  enabled             boolean NOT NULL DEFAULT true,
  disabled_reason     text CHECK (disabled_reason IS NULL OR length(disabled_reason) <= 500),
  disabled_by         bigint REFERENCES accounts(id) ON DELETE SET NULL,
  disabled_at         timestamptz,
  banned              boolean NOT NULL DEFAULT false,
  ban_reason          text CHECK (ban_reason IS NULL OR length(ban_reason) <= 500),
  banned_by           bigint REFERENCES accounts(id) ON DELETE SET NULL,
  banned_at           timestamptz,
  maintenance_enabled boolean NOT NULL DEFAULT false,
  maintenance_message text CHECK (maintenance_message IS NULL OR length(maintenance_message) <= 500),
  maintenance_by      bigint REFERENCES accounts(id) ON DELETE SET NULL,
  maintenance_at      timestamptz,
  session_ref         uuid NOT NULL DEFAULT gen_random_uuid(),   -- referensi opaque; isi session WhatsApp TIDAK disimpan di sini
  last_seen_at        timestamptz,
  bot_version         text CHECK (bot_version IS NULL OR length(bot_version) <= 40),
  created_by          bigint REFERENCES accounts(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  deleted_by          bigint REFERENCES accounts(id) ON DELETE SET NULL,
  CHECK (NOT banned OR banned_at IS NOT NULL),
  CHECK (enabled OR disabled_at IS NOT NULL)
);
CREATE UNIQUE INDEX bots_phone_uq      ON bots (phone_number) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX bots_session_ref_uq ON bots (session_ref);
CREATE INDEX bots_owner_idx ON bots (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX bots_user_idx  ON bots (user_account_id) WHERE deleted_at IS NULL;

-- Password bot terpisah dari login website (Google). Hanya hash bcrypt.
CREATE TABLE bot_credentials (
  bot_id          bigint PRIMARY KEY REFERENCES bots(id) ON DELETE CASCADE,
  password_hash   text NOT NULL CHECK (password_hash ~ '^\$2[aby]\$[0-9]{2}\$.{53}$'),
  set_by          bigint REFERENCES accounts(id) ON DELETE SET NULL,
  set_via         text NOT NULL DEFAULT 'dashboard' CHECK (set_via IN ('dashboard','cli')),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until    timestamptz
);

-- Token proses bot (yang dipakai bot setelah login nomor + password). Hanya hash SHA-256 disimpan.
CREATE TABLE bot_sessions (
  id             bigserial PRIMARY KEY,
  bot_id         bigint NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  token_hash     text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  instance_id    text NOT NULL CHECK (instance_id ~ '^[A-Za-z0-9_-]{16,64}$'),
  instance_name  text CHECK (instance_name IS NULL OR length(instance_name) <= 48),
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  last_seen_at   timestamptz,
  revoked_at     timestamptz,
  revoked_reason text CHECK (revoked_reason IS NULL OR length(revoked_reason) <= 200),
  revoked_by     bigint REFERENCES accounts(id) ON DELETE SET NULL,
  ip             text CHECK (ip IS NULL OR length(ip) <= 64),
  CHECK (expires_at > created_at)
);
CREATE INDEX bot_sessions_active_idx ON bot_sessions (bot_id) WHERE revoked_at IS NULL;

CREATE TABLE dashboard_sessions (
  id           bigserial PRIMARY KEY,
  account_id   bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  provider     text NOT NULL CHECK (provider IN ('google','login_link')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  last_seen_at timestamptz,
  revoked_at   timestamptz,
  ip           text CHECK (ip IS NULL OR length(ip) <= 64),
  user_agent   text CHECK (user_agent IS NULL OR length(user_agent) <= 300),
  CHECK (expires_at > created_at)
);
CREATE INDEX dashboard_sessions_account_idx ON dashboard_sessions (account_id) WHERE revoked_at IS NULL;

-- Link login sekali pakai yang dibuat lewat CLI di server (bootstrap tanpa Google / darurat).
CREATE TABLE login_links (
  id         bigserial PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  CHECK (expires_at > created_at)
);

CREATE TABLE maintenance_settings (
  id           smallint PRIMARY KEY CHECK (id = 1),
  enabled      boolean NOT NULL DEFAULT false,
  message      text NOT NULL DEFAULT 'Bot sedang maintenance. Coba lagi nanti ya.' CHECK (length(message) BETWEEN 1 AND 500),
  -- Pengecualian administratif eksplisit: bot milik akun dengan rank ini tetap jalan saat maintenance global.
  exempt_ranks text[] NOT NULL DEFAULT ARRAY['DEVELOPER']::text[],
  updated_by   bigint REFERENCES accounts(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
INSERT INTO maintenance_settings (id) VALUES (1);

CREATE TABLE audit_logs (
  id          bigserial PRIMARY KEY,
  actor_type  text NOT NULL CHECK (actor_type IN ('account','bot','system','cli')),
  actor_id    bigint,
  action      text NOT NULL CHECK (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type text CHECK (target_type IS NULL OR target_type ~ '^[a-z_]+$'),
  target_id   bigint,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text CHECK (ip IS NULL OR length(ip) <= 64),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_target_idx  ON audit_logs (target_type, target_id);
CREATE INDEX audit_logs_actor_idx   ON audit_logs (actor_type, actor_id);

CREATE FUNCTION audit_logs_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs bersifat append-only';
END $$;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

-- Percobaan login (brute-force protection). identifier disimpan sebagai hash, bukan nomor/email mentah.
CREATE TABLE login_attempts (
  id              bigserial PRIMARY KEY,
  kind            text NOT NULL CHECK (kind IN ('bot','dashboard')),
  identifier_hash text NOT NULL CHECK (identifier_hash ~ '^[0-9a-f]{64}$'),
  success         boolean NOT NULL,
  reason          text CHECK (reason IS NULL OR reason ~ '^[A-Z_]{2,40}$'),
  ip              text CHECK (ip IS NULL OR length(ip) <= 64),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_ident_idx ON login_attempts (kind, identifier_hash, created_at DESC);
CREATE INDEX login_attempts_ip_idx    ON login_attempts (kind, ip, created_at DESC);
