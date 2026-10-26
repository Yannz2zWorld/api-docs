-- Maintenance WEB DATABASE (khusus DEVELOPER). Saat aktif:
--   - website hanya bisa dipakai DEVELOPER (akun lain ditolak login & semua API-nya),
--   - semua bot berhenti total (tidak membalas, hook & jadwal berhenti) sampai maintenance dimatikan.
-- Terpisah dari maintenance global bot (kolom enabled/message) yang tetap seperti sebelumnya.
ALTER TABLE maintenance_settings
  ADD COLUMN web_enabled    boolean NOT NULL DEFAULT false,
  ADD COLUMN web_message    text NOT NULL DEFAULT 'Web database sedang maintenance. Coba lagi nanti ya.'
                            CHECK (length(web_message) BETWEEN 1 AND 500),
  ADD COLUMN web_updated_by bigint REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN web_updated_at timestamptz;
