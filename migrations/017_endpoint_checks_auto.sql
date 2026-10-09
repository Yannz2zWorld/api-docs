-- Cek endpoint otomatis (services/endpointCheckService.js): jenis cek, penanda "lagi dicek", dan
-- baris yang belum pernah selesai dicek (checked_at NULL). Aman di-run ulang; additive saja.
ALTER TABLE endpoint_checks ADD COLUMN IF NOT EXISTS kind text;          -- 'sample' / 'reach'
ALTER TABLE endpoint_checks ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE endpoint_checks ALTER COLUMN checked_at DROP NOT NULL;
ALTER TABLE endpoint_checks ALTER COLUMN checked_at DROP DEFAULT;
ALTER TABLE endpoint_checks ALTER COLUMN ok SET DEFAULT false;
-- Kode yang disimpan sekarang: 200 = jalan, selain itu kode error.
UPDATE endpoint_checks SET status = 200 WHERE ok AND (status IS NULL OR status <> 200);
