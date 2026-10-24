-- Rank v2 (sesuai permintaan pemilik): MEMBER, RESELLER, SUKI, RAJA, DEWA, DEVELOPER.
-- PARTNER -> SUKI, OWNER -> RAJA, CEO -> DEWA. Akun lama ikut dipindah; tidak ada data yang dihapus.
-- Kalau pemakaian akun melebihi kuota baru (mis. OWNER unlimited -> RAJA 100), data lama tetap,
-- hanya penambahan baru yang diblokir (aturan kuota yang sama seperti turun rank).
--
--   rank       kuota nomor   boleh menambah            boleh menghapus akun
--   MEMBER     0             -                         -
--   RESELLER   10            nomor, member             member
--   SUKI       50            + reseller                member
--   RAJA       100           + suki                    member, reseller
--   DEWA       1000          + raja                    member, reseller, suki, raja
--   DEVELOPER  tanpa batas   semua                     semua (rank DEVELOPER hanya lewat CLI)
-- Semua rank di bawah DEVELOPER hanya mengelola akun & bot di bawahnya sendiri (pohon delegasi).

-- 1. Rank baru. Level lama digeser dulu karena level unik.
ALTER TABLE ranks DROP CONSTRAINT ranks_code_check;
UPDATE ranks SET level = level + 100 WHERE code IN ('PARTNER', 'OWNER', 'CEO');
INSERT INTO ranks (code, level, max_numbers, max_managed_users, assignable, description) VALUES
  ('SUKI', 30, 50,   50,   true, 'Maks 50 nomor. Boleh menambah reseller, nomor, dan member di bawahnya.'),
  ('RAJA', 40, 100,  100,  true, 'Maks 100 nomor. Boleh menambah suki & reseller, menghapus reseller.'),
  ('DEWA', 50, 1000, 1000, true, 'Maks 1000 nomor. Boleh menambah raja, suki & reseller, menghapus raja, suki & reseller.');
UPDATE ranks SET description = 'Pengguna biasa. Diatur oleh reseller ke atas; tidak bisa menambah nomor.' WHERE code = 'MEMBER';
UPDATE ranks SET description = 'Maks 10 nomor. Boleh menambah & menghapus nomor serta member di bawahnya.' WHERE code = 'RESELLER';
UPDATE ranks SET description = 'Developer only. Akses penuh; hanya bisa diberikan lewat prosedur CLI.' WHERE code = 'DEVELOPER';

-- 2. Pindahkan akun & pengecualian maintenance, lalu hapus rank lama.
UPDATE accounts SET rank_code = 'SUKI' WHERE rank_code = 'PARTNER';
UPDATE accounts SET rank_code = 'RAJA' WHERE rank_code = 'OWNER';
UPDATE accounts SET rank_code = 'DEWA' WHERE rank_code = 'CEO';
UPDATE maintenance_settings SET exempt_ranks = COALESCE((
  SELECT array_agg(CASE r WHEN 'PARTNER' THEN 'SUKI' WHEN 'OWNER' THEN 'RAJA' WHEN 'CEO' THEN 'DEWA' ELSE r END)
  FROM unnest(exempt_ranks) AS r), '{}'::text[]);
DELETE FROM ranks WHERE code IN ('PARTNER', 'OWNER', 'CEO');
ALTER TABLE ranks ADD CONSTRAINT ranks_code_check CHECK (code IN ('MEMBER', 'RESELLER', 'SUKI', 'RAJA', 'DEWA', 'DEVELOPER'));

-- 3. Permission tambah/hapus per rank baru.
INSERT INTO permissions (code, description) VALUES
  ('suki.create', 'Membuat suki / menaikkan akun menjadi suki'),
  ('suki.delete', 'Menghapus suki / menurunkan suki'),
  ('raja.create', 'Membuat raja / menaikkan akun menjadi raja'),
  ('raja.delete', 'Menghapus raja / menurunkan raja'),
  ('dewa.create', 'Membuat dewa / menaikkan akun menjadi dewa'),
  ('dewa.delete', 'Menghapus dewa / menurunkan dewa');
DELETE FROM permissions WHERE code IN ('partner.create', 'partner.delete', 'owner.create', 'owner.delete', 'ceo.create', 'ceo.delete');

-- 4. Susun ulang relasi rank -> permission.
DELETE FROM rank_permissions;

INSERT INTO rank_permissions (rank_code, permission_code) VALUES ('MEMBER', 'bot.view');

INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'RESELLER', unnest(ARRAY['bot.view', 'number.create', 'number.delete', 'bot.manage', 'bot.credential.reset', 'bot.session.revoke',
  'bot.maintenance', 'user.view', 'user.create', 'user.update', 'user.delete', 'audit.view']);

-- SUKI = RESELLER + tambah reseller
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'SUKI', permission_code FROM rank_permissions WHERE rank_code = 'RESELLER'
UNION SELECT 'SUKI', unnest(ARRAY['reseller.create', 'role.assign']);

-- RAJA = SUKI + tambah suki + hapus reseller
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'RAJA', permission_code FROM rank_permissions WHERE rank_code = 'SUKI'
UNION SELECT 'RAJA', unnest(ARRAY['suki.create', 'reseller.delete']);

-- DEWA = RAJA + tambah raja + hapus suki & raja
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'DEWA', permission_code FROM rank_permissions WHERE rank_code = 'RAJA'
UNION SELECT 'DEWA', unnest(ARRAY['raja.create', 'suki.delete', 'raja.delete']);

-- DEVELOPER = semua permission (termasuk lingkup global, ban, maintenance global, backup).
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'DEVELOPER', code FROM permissions;
