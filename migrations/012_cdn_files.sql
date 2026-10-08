-- CDN: tempat menyimpan file yang diunggah (foto, video, audio, dokumen, file apa saja),
-- dilayani lewat URL publik /cdn/<id>.<ext>. Juga dipakai endpoint yang hanya menerima URL gambar.
-- Aman di-run ulang; additive saja.
--
-- File disimpan sebagai base64 di kolom text (bukan bytea) supaya aman lewat driver
-- HTTP Neon. Ukuran maksimal diatur aplikasi (services/cdnService.js), bukan di sini.
CREATE TABLE IF NOT EXISTS cdn_files (
  id          text PRIMARY KEY,                       -- "<hex>.<ext>", juga jadi nama di URL
  name        text,                                    -- nama asli file (untuk nama unduhan)
  mime        text NOT NULL,                           -- image/png, video/mp4, application/pdf, ...
  data        text NOT NULL,                           -- isi file (base64)
  size        integer NOT NULL,                        -- ukuran asli dalam byte
  owner_id    uuid,                                    -- akun pengunggah (opsional)
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz                              -- NULL = permanen; diisi untuk file sementara
);

CREATE INDEX IF NOT EXISTS cdn_files_expires_idx ON cdn_files(expires_at);
CREATE INDEX IF NOT EXISTS cdn_files_owner_idx ON cdn_files(owner_id);

-- Untuk database yang sudah menjalankan versi awal file ini (sebelum kolom name ada).
ALTER TABLE cdn_files ADD COLUMN IF NOT EXISTS name text;
