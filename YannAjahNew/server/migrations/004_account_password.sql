-- Login website dengan email + password (akun dibuat developer/atasan untuk pembeli).
-- Password hanya disimpan sebagai hash bcrypt. Akses website: rank RESELLER ke atas
-- (diperiksa di server/services/passwordAuthService.js, bukan di sini).

ALTER TABLE accounts
  ADD COLUMN password_hash       text CHECK (password_hash IS NULL OR password_hash ~ '^\$2[aby]\$\d{2}\$.{53}$'),
  ADD COLUMN password_changed_at timestamptz,
  ADD COLUMN failed_logins       integer NOT NULL DEFAULT 0 CHECK (failed_logins >= 0),
  ADD COLUMN locked_until        timestamptz;

ALTER TABLE dashboard_sessions DROP CONSTRAINT dashboard_sessions_provider_check;
ALTER TABLE dashboard_sessions ADD CONSTRAINT dashboard_sessions_provider_check CHECK (provider IN ('google', 'login_link', 'password'));
