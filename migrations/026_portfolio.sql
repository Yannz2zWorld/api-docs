-- Portfolio (/portfolio): semua isi halaman portfolio yang diatur dari Diriku Panel (/portfolio/panel),
-- disimpan sebagai satu dokumen JSON. Kosong (NULL) = halaman pakai contoh bawaan.
-- Aman di-run ulang.
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS portfolio jsonb;
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS portfolio_updated_at timestamptz;
