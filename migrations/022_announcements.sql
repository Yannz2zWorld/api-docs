-- Pengumuman: jam mulai maintenance (ditampilin di kartu pengumuman maintenance) dan "Pengumuman Dev"
-- dari Developer panel (pesan, pesan 2, tombol + URL-nya) yang muncul di halaman login dan Home.
-- Aman di-run ulang.
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS maintenance_since timestamptz;
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS announce_message text;
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS announce_message2 text;
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS announce_button_label text;
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS announce_button_url text;
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS announce_at timestamptz;
