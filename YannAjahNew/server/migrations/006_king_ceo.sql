-- Role final v4 (permintaan pemilik): RAJA -> KING, DEWA -> CEO, dan izin per role persis
-- seperti tampilan website masing-masing. Akun lama ikut dipindah; tidak ada data yang dihapus.
--
--   role       kuota nomor   website bisa
--   RESELLER   10            tambah nomor (diawali kode negara) + hapus nomor
--   SUKI       50            nomor + tambah/hapus reseller (username & password)
--   KING       100           nomor + tambah/hapus reseller & suki
--   CEO        1000          nomor + tambah/hapus reseller, suki & king
--   DEVELOPER  tanpa batas   semua (rank DEVELOPER hanya lewat CLI)
-- Operasi bot (password bot, nyalakan/matikan, ganti nama, cabut sesi, ban, maintenance),
-- reset password/ubah/ban akun, dan ganti rank: hanya DEVELOPER.

-- 1. Rank baru. Level lama digeser dulu karena level unik.
ALTER TABLE ranks DROP CONSTRAINT ranks_code_check;
UPDATE ranks SET level = level + 100 WHERE code IN ('RAJA', 'DEWA');
INSERT INTO ranks (code, level, max_numbers, max_managed_users, assignable, description)
SELECT 'KING', level - 100, max_numbers, max_managed_users, assignable,
  'Maks 100 nomor. Nomor + menambah & menghapus reseller dan suki.' FROM ranks WHERE code = 'RAJA';
INSERT INTO ranks (code, level, max_numbers, max_managed_users, assignable, description)
SELECT 'CEO', level - 100, max_numbers, max_managed_users, assignable,
  'Maks 1000 nomor. Nomor + menambah & menghapus reseller, suki, dan king.' FROM ranks WHERE code = 'DEWA';
UPDATE ranks SET description = 'Maks 10 nomor. Hanya menambah & menghapus nomor.' WHERE code = 'RESELLER';
UPDATE ranks SET description = 'Maks 50 nomor. Nomor + menambah & menghapus reseller.' WHERE code = 'SUKI';

-- 2. Pindahkan akun & pengecualian maintenance, lalu hapus rank lama.
UPDATE accounts SET rank_code = 'KING' WHERE rank_code = 'RAJA';
UPDATE accounts SET rank_code = 'CEO' WHERE rank_code = 'DEWA';
UPDATE maintenance_settings SET exempt_ranks = COALESCE((
  SELECT array_agg(CASE r WHEN 'RAJA' THEN 'KING' WHEN 'DEWA' THEN 'CEO' ELSE r END)
  FROM unnest(exempt_ranks) AS r), '{}'::text[]);
DELETE FROM rank_permissions WHERE rank_code IN ('RAJA', 'DEWA');
DELETE FROM ranks WHERE code IN ('RAJA', 'DEWA');
ALTER TABLE ranks ADD CONSTRAINT ranks_code_check CHECK (code IN ('RESELLER', 'SUKI', 'KING', 'CEO', 'DEVELOPER'));

-- 3. Permission tambah/hapus per rank baru.
INSERT INTO permissions (code, description) VALUES
  ('king.create', 'Membuat king / menaikkan akun menjadi king'),
  ('king.delete', 'Menghapus king / menurunkan king'),
  ('ceo.create', 'Membuat ceo / menaikkan akun menjadi ceo'),
  ('ceo.delete', 'Menghapus ceo / menurunkan ceo')
ON CONFLICT (code) DO NOTHING;
DELETE FROM permissions WHERE code IN ('raja.create', 'raja.delete', 'dewa.create', 'dewa.delete');

-- 4. Susun ulang relasi rank -> permission.
DELETE FROM rank_permissions;

-- RESELLER: lihat, tambah & hapus nomor. Itu saja.
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'RESELLER', unnest(ARRAY['bot.view', 'number.create', 'number.delete']);

-- SUKI: RESELLER + lihat akun bawahan + tambah & hapus reseller.
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'SUKI', unnest(ARRAY['bot.view', 'number.create', 'number.delete', 'user.view', 'reseller.create', 'reseller.delete']);

-- KING: SUKI + tambah & hapus suki.
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'KING', permission_code FROM rank_permissions WHERE rank_code = 'SUKI'
UNION SELECT 'KING', unnest(ARRAY['suki.create', 'suki.delete']);

-- CEO: KING + tambah & hapus king.
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'CEO', permission_code FROM rank_permissions WHERE rank_code = 'KING'
UNION SELECT 'CEO', unnest(ARRAY['king.create', 'king.delete']);

-- DEVELOPER: semua permission.
INSERT INTO rank_permissions (rank_code, permission_code) SELECT 'DEVELOPER', code FROM permissions;
