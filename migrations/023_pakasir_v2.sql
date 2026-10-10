-- Pakasir API v2: total yang dibayar pembeli (nominal + biaya gateway), ditampilkan lagi waktu
-- pembeli buka QR / nomor VA yang sama. Aman di-run ulang.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_total integer;
