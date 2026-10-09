-- Nama penyedia API nggak boleh kelihatan di path endpoint. Cadangan Dongtube pindah dari
-- /api/dongtube/... ke /api/alt/..., dan TikTok (Termai) jadi /api/download/tiktok-v2.
-- Hapus baris path lama (baris baru dibuat otomatis waktu web jalan). Aman di-run ulang.
DELETE FROM endpoint_checks WHERE path LIKE '/api/dongtube/%' OR path = '/api/download/tiktok-termai';
DELETE FROM endpoint_errors WHERE path LIKE '/api/dongtube/%' OR path = '/api/download/tiktok-termai';
DELETE FROM endpoints WHERE path LIKE '/api/dongtube/%' OR path = '/api/download/tiktok-termai';
