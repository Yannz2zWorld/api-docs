-- Error endpoint untuk tab "Error" di Developer Panel, dan endpoint yang disembunyikan otomatis
-- (mis. server sumbernya bilang limit plan / kuota habis / key ditolak). Endpoint yang disembunyikan
-- otomatis tetap dicek; begitu jalan lagi (200 OK) langsung muncul lagi. Aman di-run ulang.
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS auto_disabled boolean NOT NULL DEFAULT false;
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS disabled_reason text;
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE TABLE IF NOT EXISTS endpoint_errors (
  id           bigserial PRIMARY KEY,
  path         text NOT NULL,
  fingerprint  text NOT NULL,                -- error yang sama dikumpulin jadi satu baris
  status       integer,                      -- kode HTTP
  code         text,                         -- kode error (mis. UPSTREAM_FAILED)
  message      text,                         -- pesan error asli
  source       text,                         -- 'live' (request asli) / 'check' (cek otomatis)
  hidden       boolean NOT NULL DEFAULT false, -- bikin endpoint-nya disembunyikan otomatis
  count        integer NOT NULL DEFAULT 1,
  first_seen   timestamptz NOT NULL DEFAULT now(),
  last_seen    timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,                  -- endpoint-nya udah jalan lagi
  UNIQUE (path, fingerprint)
);
CREATE INDEX IF NOT EXISTS endpoint_errors_last_seen_idx ON endpoint_errors (last_seen DESC);
