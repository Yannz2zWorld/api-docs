# Rank, permission, ownership & kuota

Lima rank website (`server/migrations/006_king_ceo.sql`):
`RESELLER` → `SUKI` → `KING` → `CEO` → `DEVELOPER`.

**MEMBER bukan akun website.** Pembeli bot tidak punya akun; ia hanya memberi nomor ke penjual, lalu penjual menambahkan nomor itu.

Sumber kebenaran: tabel `ranks`, `permissions`, `rank_permissions`. Backend memeriksa **permission eksplisit** pada setiap aksi
(`server/services/accessControl.js`); level rank hanya dipakai untuk aturan hierarki "tidak boleh mengelola rank yang sama atau lebih tinggi".
Tombol di dashboard hanya muncul untuk aksi yang boleh dilakukan, tapi server tetap yang memutuskan.

## Tampilan website tiap role

| Role | Maks nomor | Yang bisa dilakukan di website |
|---|---:|---|
| RESELLER | 10 | tambah nomor (diawali kode negara) + hapus nomor |
| SUKI | 50 | tambah/hapus nomor · tambah/hapus **reseller** (username & password) |
| KING | 100 | tambah/hapus nomor · tambah/hapus **reseller, suki** |
| CEO | 1000 | tambah/hapus nomor · tambah/hapus **reseller, suki, king** |
| DEVELOPER | ∞ | **semua** (rank DEVELOPER hanya lewat CLI) |

- **Hanya DEVELOPER**: password bot (membuat & mengganti — tidak ada password otomatis), nyalakan/matikan bot, ganti nama, cabut sesi, ban/unban, maintenance per bot & global, reset password / ubah / ban akun, ganti rank, audit, riwayat login, kesehatan sistem, backup, melihat semua bot & aktivitas.
- Nomor wajib ditulis **diawali kode negara** (`6281234567890`, boleh `+62…`). Awalan `0` ditolak (`PHONE_COUNTRY_CODE`) supaya nomor luar negeri tidak salah ditebak jadi +62.
- Nomor yang didaftarkan penjual belum punya password, jadi bot belum bisa login sampai DEVELOPER menetapkannya.

## Alur jual script

1. Pembeli membeli script bot.
2. DEVELOPER (atau atasan sesuai rank) membuat akun penjual di website: **username + password** (+ rank).
3. Penjual masuk website (username atau email + password), **Tambah nomor**: nomor WhatsApp pembeli, diawali kode negara.
4. **DEVELOPER menetapkan password bot** untuk nomor itu, lalu **script + nomor + password bot** diberikan ke pembeli.
5. Pembeli menjalankan script → bot meminta nomor + password → pilih QR / kode pairing → bot jalan.

## Kuota

- **Kuota nomor** = jumlah baris `bots` aktif dengan `owner_id` = akun: RESELLER 10, SUKI 50, KING 100, CEO 1000, DEVELOPER ∞.
- **Kuota sub-akun**: RESELLER 0 (tidak mengelola akun); SUKI/KING/CEO tanpa batas jumlah sub-akun.
- **Aman dari request bersamaan**: penambahan dalam transaksi yang mengunci baris pemilik kuota (`SELECT … FOR UPDATE`). Teruji: 25 request paralel untuk reseller kosong → tepat 10 berhasil.
- Ditolak `409 QUOTA_EXCEEDED` (berisi `used`/`limit`): reseller nomor ke-11, suki ke-51, king ke-101, ceo ke-1001.
- Hapus (soft-delete) membebaskan slot. Turun rank (oleh DEVELOPER): data tidak dihapus, penambahan diblokir sampai di bawah batas baru (`over_quota: true`).

## Ownership & cakupan ("tempat masing-masing")

- Setiap akun punya `manager_id` (atasan). **Cakupan** = semua akun di bawahnya secara rekursif.
- **Setiap penjual punya tempatnya sendiri**: nomor milik Budi (RESELLER) terpisah dari Agus (RESELLER). Satu reseller tidak bisa melihat, menghapus, atau menumpang kuota nomor reseller lain. Teruji.
- Atasan melihat & mengelola cakupan bawahannya saja. SUKI/KING/CEO tidak bisa menyentuh akun milik SUKI/KING/CEO lain (`403 OUT_OF_SCOPE`).
- DEVELOPER punya `scope.global`: melihat SEMUA bot (lewat nomor yang ditambahkan siapa pun) dan semua aktivitas.

## Aturan rank

- Membuat akun rank X butuh izin tambah X (`reseller.create`, `suki.create`, `king.create`, `ceo.create`); X lebih rendah dari rank aktor.
- Menghapus akun rank X butuh izin hapus X (`reseller.delete`, `suki.delete`, `king.delete`, `ceo.delete`). Akun yang masih punya nomor/sub-akun tidak bisa dihapus (`HAS_DEPENDENTS`).
- Mengubah rank (`role.assign`) hanya DEVELOPER. Tidak ada yang bisa mengubah rank sendiri atau mengelola rank sama/lebih tinggi (`RANK_HIERARCHY`).
- **DEVELOPER** tidak bisa didapat lewat website (`RANK_NOT_ASSIGNABLE`). Hanya lewat CLI, tercatat di audit:
  `node server/cli.js bootstrap-developer`, `grant-developer --username X --confirm X`, `revoke-developer --username X --to CEO --confirm X`.

## Login website

- Masuk dengan **username (atau email) + password** yang dibuat atasan. Google OAuth opsional dan hanya **menautkan** ke akun yang email-nya sudah dibuat.
- Semua orang bisa ganti password sendiri. Reset password akun lain hanya DEVELOPER (sesi lama dicabut). Password bot (berbeda dari password login website) hanya DEVELOPER.

## Migrasi dari rank lama

- `003_ranks_v2.sql`: `PARTNER → SUKI`, `OWNER → RAJA`, `CEO → DEWA`.
- `005_roles_final.sql`: MEMBER dihapus sebagai akun; operasi bot hanya DEVELOPER.
- `006_king_ceo.sql`: `RAJA → KING`, `DEWA → CEO`; izin per role disamakan dengan tampilan website di atas (akun & nomor lama dipindah utuh). Teruji di `tests/server/rank-quota.test.js`.

## Matriks permission (dari database)

| Permission | RESELLER | SUKI | KING | CEO | DEVELOPER |
|---|:-:|:-:|:-:|:-:|:-:|
| `audit.view` | — | — | — | — | ✓ |
| `audit.view_all` | — | — | — | — | ✓ |
| `backup.manage` | — | — | — | — | ✓ |
| `bot.ban` | — | — | — | — | ✓ |
| `bot.credential.reset` | — | — | — | — | ✓ |
| `bot.maintenance` | — | — | — | — | ✓ |
| `bot.manage` | — | — | — | — | ✓ |
| `bot.session.revoke` | — | — | — | — | ✓ |
| `bot.unban` | — | — | — | — | ✓ |
| `bot.view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `bot.view_all` | — | — | — | — | ✓ |
| `ceo.create` | — | — | — | — | ✓ |
| `ceo.delete` | — | — | — | — | ✓ |
| `king.create` | — | — | — | ✓ | ✓ |
| `king.delete` | — | — | — | ✓ | ✓ |
| `maintenance.manage` | — | — | — | — | ✓ |
| `number.create` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `number.delete` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `reseller.create` | — | ✓ | ✓ | ✓ | ✓ |
| `reseller.delete` | — | ✓ | ✓ | ✓ | ✓ |
| `role.assign` | — | — | — | — | ✓ |
| `scope.global` | — | — | — | — | ✓ |
| `security.view` | — | — | — | — | ✓ |
| `suki.create` | — | — | ✓ | ✓ | ✓ |
| `suki.delete` | — | — | ✓ | ✓ | ✓ |
| `system.view` | — | — | — | — | ✓ |
| `user.ban` | — | — | — | — | ✓ |
| `user.create` | — | — | — | — | ✓ |
| `user.delete` | — | — | — | — | ✓ |
| `user.unban` | — | — | — | — | ✓ |
| `user.update` | — | — | — | — | ✓ |
| `user.view` | — | ✓ | ✓ | ✓ | ✓ |
| `user.view_all` | — | — | — | — | ✓ |
