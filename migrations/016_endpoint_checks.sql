-- Hasil cek endpoint terakhir (cek otomatis, cek harian, dan self-test dari Developer Panel), dipakai
-- monitor ~/endpoints di halaman utama bareng kode status dari panggilan asli (activity_log).
-- Aman di-run ulang; additive saja.
CREATE TABLE IF NOT EXISTS endpoint_checks (
  path        text PRIMARY KEY,                 -- path endpoint, mis. /api/download/tiktok
  status      integer,                          -- kode HTTP hasil cek: 200 = jalan, selain itu kode error
  ok          boolean NOT NULL DEFAULT false,
  ms          integer,                          -- lama respons
  error       text,                             -- ringkasan error kalau gagal
  kind        text,                             -- 'sample' (dites pakai contoh input) / 'reach' (cek server nyahut)
  checked_at  timestamptz,                      -- NULL = belum pernah selesai dicek
  claimed_at  timestamptz                       -- lagi dicek (biar nggak dicek dobel bareng-bareng)
);
ALTER TABLE endpoint_checks ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE endpoint_checks ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE endpoint_checks ALTER COLUMN checked_at DROP NOT NULL;
ALTER TABLE endpoint_checks ALTER COLUMN checked_at DROP DEFAULT;
ALTER TABLE endpoint_checks ALTER COLUMN ok SET DEFAULT false;
