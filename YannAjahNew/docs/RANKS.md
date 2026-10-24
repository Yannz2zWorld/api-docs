# Rank, permission, ownership & kuota

Lima rank website (`server/migrations/005_roles_final.sql`):
`RESELLER` → `SUKI` → `RAJA` → `DEWA` → `DEVELOPER`.

**MEMBER bukan akun website.** Pembeli bot tidak punya akun; ia hanya memberi nomor ke reseller, lalu reseller menambahkan nomor itu.

Sumber kebenaran: tabel `ranks`, `permissions`, `rank_permissions`. Backend memeriksa **permission eksplisit** pada setiap aksi
(`server/services/accessControl.js`); level rank hanya dipakai untuk aturan hierarki "tidak boleh mengelola rank yang sama atau lebih tinggi".
Tombol di dashboard hanya muncul untuk aksi yang boleh dilakukan, tapi server tetap yang memutuskan.

## Ringkasan

| Rank | Maks nomor | Boleh membuat | Boleh menghapus akun | Didapat lewat |
|---|---:|---|---|---|
| RESELLER | 10 | — | — | dibuat atasan |
| SUKI | 50 | reseller | — | dibuat atasan |
| RAJA | 100 | reseller, suki | reseller | dibuat atasan |
| DEWA | 1000 | reseller, suki, raja | reseller, suki, raja | dibuat atasan |
| DEVELOPER | ∞ | semua | semua | **hanya CLI di server** |

- **RESELLER/SUKI/RAJA/DEWA tugasnya hanya: tambah & hapus NOMOR (dalam kuota) + buat/hapus role di bawahnya.**
- **Operasi bot hanya DEVELOPER**: ganti/reset password bot, nyalakan/matikan, ganti nama, cabut sesi, maintenance per bot, ban/unban bot.
- **Password bot HANYA DEVELOPER yang bisa membuat/mengganti** — tidak ada password otomatis. Nomor yang didaftarkan reseller/dst. belum punya password, jadi bot belum bisa jalan sampai DEVELOPER menetapkannya.
- Aksi admin global hanya **DEVELOPER**: lihat semua akun & bot, maintenance global, riwayat login, kesehatan sistem, backup/restore, melihat semua aktivitas.

## Alur jual script

1. Pembeli membeli script bot.
2. DEVELOPER (atau atasan sesuai rank) membuat akun penjual di website: email + password + rank.
3. Penjual (reseller ke atas) masuk website, **Tambah nomor**: masukkan nomor WhatsApp dari pembeli (tanpa password).
4. **DEVELOPER menetapkan password bot** untuk nomor itu, lalu memberikan **script + nomor + password bot** ke pembeli (lewat penjual). Selama password belum diset DEVELOPER, bot belum bisa login.
5. Pembeli menjalankan script → bot meminta nomor + password → pilih QR / kode pairing → bot jalan.

## Kuota

- **Kuota nomor** = jumlah baris `bots` aktif dengan `owner_id` = akun: RESELLER 10, SUKI 50, RAJA 100, DEWA 1000, DEVELOPER ∞.
- **Kuota sub-akun**: RESELLER 0 (tidak mengelola akun); SUKI/RAJA/DEWA tanpa batas jumlah sub-akun.
- **Aman dari request bersamaan**: penambahan dalam transaksi yang mengunci baris pemilik kuota (`SELECT … FOR UPDATE`). Teruji: 25 request paralel untuk reseller kosong → tepat 10 berhasil.
- Ditolak `409 QUOTA_EXCEEDED` (berisi `used`/`limit`): reseller nomor ke-11, suki ke-51, raja ke-101, dewa ke-1001.
- Hapus (soft-delete) membebaskan slot. Turun rank: data tidak dihapus, penambahan diblokir sampai di bawah batas baru (`over_quota: true`). Naik rank langsung menambah kuota.

## Ownership & cakupan ("tempat masing-masing")

- Setiap akun punya `manager_id` (atasan). **Cakupan** = semua akun di bawahnya secara rekursif.
- **Setiap penjual punya tempatnya sendiri**: nomor & sub-akun milik Budi (RESELLER) terpisah dari Agus (RESELLER). Satu reseller tidak bisa melihat, mengubah, atau menghapus nomor reseller lain, dan tidak bisa menumpang kuotanya. Teruji.
- Atasan melihat & mengelola cakupan bawahannya. DEWA tidak bisa menyentuh akun di bawah DEWA lain (`403 OUT_OF_SCOPE`).
- DEVELOPER punya `scope.global`: melihat SEMUA bot (lewat nomor yang ditambahkan siapa pun) dan semua aktivitas.

## Aturan rank

- Membuat akun rank X butuh izin tambah X (`reseller.create`, `suki.create`, `raja.create`); X lebih rendah dari rank aktor.
- Menghapus akun rank X butuh izin hapus X (`reseller.delete`, `suki.delete`, `raja.delete`).
- Mengubah rank butuh `role.assign` + izin tambah rank tujuan (naik) / izin hapus rank asal (turun). Contoh: SUKI menaikkan sub-akun jadi reseller, tapi tidak bisa menurunkan reseller (butuh izin hapus reseller = RAJA ke atas).
- Tidak ada yang bisa mengubah rank sendiri (`SELF_MANAGEMENT`) atau mengelola rank sama/lebih tinggi (`RANK_HIERARCHY`).
- **DEVELOPER** tidak bisa didapat lewat website (`RANK_NOT_ASSIGNABLE`). Hanya lewat CLI, tercatat di audit:
  `node server/cli.js bootstrap-developer`, `grant-developer --username X --confirm X`, `revoke-developer --username X --to DEWA --confirm X`.

## Login website

- Masuk dengan **email + password** yang dibuat developer/atasan. Google OAuth opsional dan hanya **menautkan** ke akun yang email-nya sudah dibuat — Google tidak membuat akun baru.
- Semua orang bisa ganti password sendiri; atasan bisa reset password sub-akunnya (sesi lama dicabut). Password bot (berbeda dari password login website) hanya DEVELOPER yang bisa ganti.

## Migrasi dari rank lama

- `003_ranks_v2.sql`: `PARTNER → SUKI`, `OWNER → RAJA`, `CEO → DEWA` (akun lama dipindah, data utuh).
- `005_roles_final.sql`: **MEMBER dihapus** sebagai akun; izin operasi bot dicabut dari reseller/suki/raja/dewa (jadi hanya DEVELOPER). Teruji di `tests/server/rank-quota.test.js`.

## Matriks permission (dari database)

| Permission | RESELLER | SUKI | RAJA | DEWA | DEVELOPER |
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
| `dewa.create` | — | — | — | — | ✓ |
| `dewa.delete` | — | — | — | — | ✓ |
| `maintenance.manage` | — | — | — | — | ✓ |
| `number.create` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `number.delete` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `raja.create` | — | — | — | ✓ | ✓ |
| `raja.delete` | — | — | — | ✓ | ✓ |
| `reseller.create` | — | ✓ | ✓ | ✓ | ✓ |
| `reseller.delete` | — | — | ✓ | ✓ | ✓ |
| `role.assign` | — | ✓ | ✓ | ✓ | ✓ |
| `scope.global` | — | — | — | — | ✓ |
| `security.view` | — | — | — | — | ✓ |
| `suki.create` | — | — | ✓ | ✓ | ✓ |
| `suki.delete` | — | — | — | ✓ | ✓ |
| `system.view` | — | — | — | — | ✓ |
| `user.ban` | — | — | — | — | ✓ |
| `user.create` | — | — | — | — | ✓ |
| `user.delete` | — | — | — | — | ✓ |
| `user.unban` | — | — | — | — | ✓ |
| `user.update` | — | ✓ | ✓ | ✓ | ✓ |
| `user.view` | — | ✓ | ✓ | ✓ | ✓ |
| `user.view_all` | — | — | — | — | ✓ |

## Status akun & bot

| Akun (`accounts.status`) | Efek |
|---|---|
| `active` | normal |
| `disabled` / `suspended` / `banned` | sesi dashboard dicabut, tidak bisa login, semua bot yang dimiliki/dipakai akun ini ditolak login & sesi bot dicabut |

Status bot dipisah menjadi tiga kolom: `connection_status` (disconnected/connecting/connected, dilaporkan proses bot), `enabled` (+alasan, pelaku, waktu), `banned` (+alasan, pelaku, waktu). Status efektif: banned > disabled > koneksi.
