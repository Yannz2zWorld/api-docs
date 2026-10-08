-- CDN: tempat menyimpan gambar yang diunggah, dilayani lewat URL publik /cdn/<id>.
-- Dipakai endpoint yang hanya menerima URL gambar (bukan upload file).
-- Aman di-run ulang; additive saja.
--
-- File disimpan sebagai base64 di kolom text (bukan bytea) supaya aman lewat driver
-- HTTP Neon. Ukuran maksimal diatur aplikasi (services/cdnService.js), bukan di sini.
CREATE TABLE IF NOT EXISTS cdn_files (
  id          text PRIMARY KEY,                       -- "<hex>.<ext>", juga jadi nama di URL
  mime        text NOT NULL,                           -- image/png, image/jpeg, ...
  data        text NOT NULL,                           -- isi file (base64)
  size        integer NOT NULL,                        -- ukuran asli dalam byte
  owner_id    uuid,                                    -- akun pengunggah (opsional)
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz                              -- NULL = permanen; diisi untuk file sementara
);

CREATE INDEX IF NOT EXISTS cdn_files_expires_idx ON cdn_files(expires_at);
CREATE INDEX IF NOT EXISTS cdn_files_owner_idx ON cdn_files(owner_id);
