-- Role final (permintaan pemilik):
--   - MEMBER DIHAPUS sebagai akun website. Pembeli bukan akun; ia hanya memberi nomor ke reseller.
--   - RESELLER/SUKI/RAJA/DEWA tugasnya HANYA: tambah & hapus nomor (dalam kuota) + buat/hapus role
--     di bawahnya. TIDAK ada operasi bot (ganti password bot, nyalakan/matikan, ganti nama,
--     cabut sesi, maintenance).
--   - DEVELOPER: semua operasi bot + lihat semua bot & aktivitas. Password bot HANYA DEVELOPER
--     yang bisa membuat/mengganti — tidak ada password otomatis. Nomor yang didaftarkan
--     reseller/dst. belum punya password; bot baru bisa jalan setelah developer menetapkannya.
--
--   role       kuota nomor   boleh membuat            boleh menghapus akun
--   RESELLER   10            -                        -
--   SUKI       50            reseller                 -
--   RAJA       100           reseller, suki           reseller
--   DEWA       1000          reseller, suki, raja     reseller, suki, raja
--   DEVELOPER  tanpa batas   semua                    semua (hanya lewat CLI)

-- 1. Hapus MEMBER. Tidak ada akun seller ber-rank MEMBER di produksi; kalau ada sisa, dibuang.
DELETE FROM accounts WHERE rank_code = 'MEMBER';
ALTER TABLE accounts ALTER COLUMN rank_code DROP DEFAULT;
ALTER TABLE accounts ALTER COLUMN rank_code SET DEFAULT 'RESELLER';
DELETE FROM rank_permissions WHERE rank_code = 'MEMBER';
DELETE FROM ranks WHERE code = 'MEMBER';
ALTER TABLE ranks DROP CONSTRAINT ranks_code_check;
ALTER TABLE ranks ADD CONSTRAINT ranks_code_check CHECK (code IN ('RESELLER', 'SUKI', 'RAJA', 'DEWA', 'DEVELOPER'));

-- 2. Kuota user (sub-akun): reseller tidak mengelola akun; suki/raja/dewa tanpa batas sub-akun.
UPDATE ranks SET max_managed_users = 0    WHERE code = 'RESELLER';
UPDATE ranks SET max_managed_users = NULL WHERE code IN ('SUKI', 'RAJA', 'DEWA', 'DEVELOPER');
UPDATE ranks SET description = 'Maks 10 nomor. Hanya menambah & menghapus nomor (kelola pembeli lewat nomor).' WHERE code = 'RESELLER';
UPDATE ranks SET description = 'Maks 50 nomor. Menambah & menghapus nomor; membuat reseller.' WHERE code = 'SUKI';
UPDATE ranks SET description = 'Maks 100 nomor. Nomor + membuat reseller/suki, menghapus reseller.' WHERE code = 'RAJA';
UPDATE ranks SET description = 'Maks 1000 nomor. Nomor + membuat reseller/suki/raja, menghapus reseller/suki/raja.' WHERE code = 'DEWA';

-- 3. Permission operasi bot & pengelolaan: hanya DEVELOPER (sisanya hanya nomor + sub-role).
DELETE FROM rank_permissions WHERE rank_code <> 'DEVELOPER';

-- RESELLER: lihat & kelola NOMOR saja.
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'RESELLER', unnest(ARRAY['bot.view', 'number.create', 'number.delete']);

-- SUKI: nomor + lihat akun bawahan + buat reseller (reset password/ubah profil akun bawahan).
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'SUKI', unnest(ARRAY['bot.view', 'number.create', 'number.delete', 'user.view', 'user.update', 'reseller.create', 'role.assign']);

-- RAJA: SUKI + buat suki + hapus reseller.
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'RAJA', permission_code FROM rank_permissions WHERE rank_code = 'SUKI'
UNION SELECT 'RAJA', unnest(ARRAY['suki.create', 'reseller.delete']);

-- DEWA: RAJA + buat raja + hapus suki & raja.
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'DEWA', permission_code FROM rank_permissions WHERE rank_code = 'RAJA'
UNION SELECT 'DEWA', unnest(ARRAY['raja.create', 'suki.delete', 'raja.delete']);

-- DEVELOPER: semua permission (termasuk operasi bot, ban, maintenance global, backup, lihat semua).
DELETE FROM rank_permissions WHERE rank_code = 'DEVELOPER';
INSERT INTO rank_permissions (rank_code, permission_code) SELECT 'DEVELOPER', code FROM permissions;
