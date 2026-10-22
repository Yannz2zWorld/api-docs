-- Seed enam rank resmi, daftar permission eksplisit, dan relasi rank -> permission.
-- Authorization di backend SELALU memeriksa permission (bukan hanya level rank).
-- Level hanya dipakai untuk aturan hierarki "tidak boleh mengelola rank yang sama/lebih tinggi".

INSERT INTO ranks (code, level, max_numbers, max_managed_users, assignable, description) VALUES
  ('MEMBER',    10, 0,    0,    true,  'Pengguna biasa. Tidak bisa menambah nomor atau user.'),
  ('RESELLER',  20, 10,   10,   true,  'Maks 10 nomor dan 10 user dalam cakupannya.'),
  ('PARTNER',   30, 50,   50,   true,  'Maks 50 nomor dan 50 user; boleh membuat/menghapus reseller dalam cakupannya.'),
  ('OWNER',     40, NULL, NULL, true,  'Kuota unlimited; mengelola resource sesuai permission owner.'),
  ('CEO',       50, NULL, NULL, true,  'Kuota unlimited; mengelola resource sesuai permission CEO.'),
  ('DEVELOPER', 60, NULL, NULL, false, 'Rank khusus, tidak dijual dan tidak bisa didapat lewat registrasi. Hanya lewat prosedur CLI.');

INSERT INTO permissions (code, description) VALUES
  ('bot.view',             'Melihat bot milik sendiri / yang dipakai / dalam cakupan'),
  ('bot.view_all',         'Melihat semua bot'),
  ('number.create',        'Menambah nomor/instance bot (memakai kuota nomor)'),
  ('number.delete',        'Menghapus nomor/instance bot dalam cakupan'),
  ('bot.manage',           'Mengubah nama, pemakai, enable/disable bot dalam cakupan'),
  ('bot.credential.reset', 'Mengatur/reset password bot dalam cakupan'),
  ('bot.session.revoke',   'Mencabut sesi proses bot dalam cakupan'),
  ('bot.maintenance',      'Maintenance per bot dalam cakupan'),
  ('bot.ban',              'Ban bot'),
  ('bot.unban',            'Unban bot'),
  ('user.view',            'Melihat user dalam cakupan'),
  ('user.view_all',        'Melihat semua user'),
  ('user.create',          'Membuat user MEMBER (memakai kuota user)'),
  ('user.update',          'Mengubah profil user dalam cakupan'),
  ('user.delete',          'Menghapus user MEMBER dalam cakupan'),
  ('user.ban',             'Ban / suspend / disable user'),
  ('user.unban',           'Mengaktifkan kembali user'),
  ('reseller.create',      'Membuat reseller / menaikkan user menjadi reseller'),
  ('reseller.delete',      'Menghapus reseller / menurunkan reseller'),
  ('partner.create',       'Membuat partner'),
  ('partner.delete',       'Menghapus / menurunkan partner'),
  ('owner.create',         'Membuat owner'),
  ('owner.delete',         'Menghapus / menurunkan owner'),
  ('ceo.create',           'Membuat CEO'),
  ('ceo.delete',           'Menghapus / menurunkan CEO'),
  ('role.assign',          'Mengubah rank user dalam cakupan (tetap butuh permission rank asal & tujuan)'),
  ('scope.global',         'Mengelola resource di luar pohon delegasi sendiri (tetap hanya rank lebih rendah)'),
  ('maintenance.manage',   'Mengatur maintenance global'),
  ('audit.view',           'Melihat audit log dalam cakupan'),
  ('audit.view_all',       'Melihat semua audit log'),
  ('security.view',        'Melihat riwayat percobaan login'),
  ('system.view',          'Melihat kesehatan sistem'),
  ('backup.manage',        'Backup / restore database');

-- MEMBER
INSERT INTO rank_permissions (rank_code, permission_code) VALUES ('MEMBER', 'bot.view');

-- RESELLER
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'RESELLER', unnest(ARRAY['bot.view','number.create','number.delete','bot.manage','bot.credential.reset','bot.session.revoke',
  'bot.maintenance','user.view','user.create','user.update','user.delete','audit.view']);

-- PARTNER = RESELLER + kelola reseller
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'PARTNER', permission_code FROM rank_permissions WHERE rank_code = 'RESELLER'
UNION SELECT 'PARTNER', unnest(ARRAY['reseller.create','reseller.delete','role.assign']);

-- OWNER = PARTNER + kelola partner, lingkup global, ban/unban, audit semua
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'OWNER', permission_code FROM rank_permissions WHERE rank_code = 'PARTNER'
UNION SELECT 'OWNER', unnest(ARRAY['partner.create','partner.delete','scope.global','user.view_all','bot.view_all','user.ban','user.unban',
  'bot.ban','bot.unban','audit.view_all','security.view','system.view']);

-- CEO = OWNER + kelola owner + maintenance global
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'CEO', permission_code FROM rank_permissions WHERE rank_code = 'OWNER'
UNION SELECT 'CEO', unnest(ARRAY['owner.create','owner.delete','maintenance.manage']);

-- DEVELOPER = CEO + kelola CEO + backup. Rank DEVELOPER sendiri hanya bisa diberikan lewat CLI.
INSERT INTO rank_permissions (rank_code, permission_code)
SELECT 'DEVELOPER', permission_code FROM rank_permissions WHERE rank_code = 'CEO'
UNION SELECT 'DEVELOPER', unnest(ARRAY['ceo.create','ceo.delete','backup.manage']);
