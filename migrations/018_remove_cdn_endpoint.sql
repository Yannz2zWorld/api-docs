-- CDN itu fitur upload di menu (dan dikelola di Developer Panel → CDN), bukan endpoint API.
-- Hapus baris bekas plugin lama /api/tools/upload dari daftar endpoint. Aman di-run ulang.
DELETE FROM endpoints WHERE path = '/api/tools/upload';
