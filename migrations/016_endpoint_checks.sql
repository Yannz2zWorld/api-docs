-- Hasil cek endpoint terakhir (self-test dari Developer Panel dan cek otomatis harian), dipakai
-- monitor ~/endpoints di halaman utama bareng kode status dari panggilan asli (activity_log).
-- Aman di-run ulang; additive saja.
CREATE TABLE IF NOT EXISTS endpoint_checks (
  path        text PRIMARY KEY,                 -- path endpoint, mis. /api/download/tiktok
  status      integer,                          -- kode HTTP dari upstream (NULL = nggak bisa dihubungi)
  ok          boolean NOT NULL,
  ms          integer,                          -- lama respons
  error       text,                             -- ringkasan error kalau gagal
  checked_at  timestamptz NOT NULL DEFAULT now()
);
