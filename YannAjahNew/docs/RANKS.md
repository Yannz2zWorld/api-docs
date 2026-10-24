# Rank, permission, ownership & kuota

Enam rank (rank v2, `server/migrations/003_ranks_v2.sql`):
`MEMBER` → `RESELLER` → `SUKI` → `RAJA` → `DEWA` → `DEVELOPER`.

Sumber kebenaran: tabel `ranks`, `permissions`, `rank_permissions`. Backend memeriksa **permission eksplisit** pada setiap aksi
(`server/services/accessControl.js`); level rank hanya dipakai untuk aturan hierarki "tidak boleh mengelola rank yang sama atau lebih tinggi".
Tombol di dashboard hanya muncul untuk aksi yang boleh dilakukan, tapi server tetap yang memutuskan.

## Ringkasan

| Rank | Maks nomor | Boleh menambah | Boleh menghapus akun | Didapat lewat |
|---|---:|---|---|---|
| MEMBER | 0 | — | — | otomatis (akun Google baru) / dibuat atasan |
| RESELLER | 10 | nomor, member | member | dashboard |
| SUKI | 50 | nomor, member, reseller | member | dashboard |
| RAJA | 100 | nomor, member, reseller, suki | member, reseller | dashboard |
| DEWA | 1000 | nomor, member, reseller, suki, raja | member, reseller, suki, raja | dashboard |
| DEVELOPER | ∞ | semua (termasuk dewa) | semua | **hanya CLI di server** |

- Semua rank yang bisa menambah nomor juga bisa **menghapus nomor**, ganti password bot, cabut sesi, dan maintenance per bot di cakupannya.
- Member diatur oleh reseller ke atas (dibuat, diubah, dihapus oleh atasannya).
- Aksi admin global hanya **DEVELOPER**: lihat semua akun/bot, ban/unban akun & bot, maintenance global, riwayat login, kesehatan sistem, backup/restore.
- Kuota user (akun yang dikelola) sama dengan kuota nomor: 0 / 10 / 50 / 100 / 1000 / ∞.

## Kuota

- **Dua kuota terpisah**: kuota *nomor* = jumlah baris `bots` aktif dengan `owner_id` = akun; kuota *user* = jumlah `accounts` aktif dengan `manager_id` = akun.
- **Aman dari request bersamaan**: penambahan dalam transaksi yang mengunci baris pemilik kuota (`SELECT … FOR UPDATE`). Teruji: 25 request paralel untuk reseller kosong → tepat 10 berhasil.
- Ditolak dengan `409 QUOTA_EXCEEDED` (berisi `used`/`limit`): reseller pada nomor ke-11, suki ke-51, raja ke-101, dewa ke-1001.
- Hapus (soft-delete) langsung membebaskan slot.
- Turun rank: **data tidak dihapus**, penambahan diblokir sampai pemakaian di bawah batas baru (`over_quota: true`). Naik rank langsung menambah kuota.
- Dashboard menampilkan pemakaian sebagai `7/10`, `32/50`, atau `5/∞`.

## Ownership & cakupan

- Setiap akun punya `manager_id` (atasan). **Cakupan** = semua akun di bawahnya secara rekursif (pohon delegasi).
- Rank MEMBER sampai DEWA hanya mengelola akun & bot **di bawahnya sendiri**. DEWA tidak bisa menyentuh akun di bawah DEWA lain (`403 OUT_OF_SCOPE`).
- DEVELOPER punya `scope.global` (semua akun & bot, tetap hanya rank lebih rendah).
- Bot dimiliki `owner_id` (kuota nomor dihitung ke akun ini) dan boleh punya `user_account_id` (akun yang memakai bot).

## Aturan rank

- Membuat akun rank X butuh izin tambah X (`user.create`, `reseller.create`, `suki.create`, `raja.create`, `dewa.create`) dan X lebih rendah dari rank aktor.
- Menghapus akun rank X butuh izin hapus X (`user.delete`, `reseller.delete`, `suki.delete`, `raja.delete`, `dewa.delete`).
- Mengubah rank butuh `role.assign` + izin tambah rank tujuan (naik) atau izin hapus rank asal (turun). Contoh: SUKI bisa menaikkan member jadi reseller, tapi tidak bisa menurunkan reseller.
- Tidak ada yang bisa mengubah rank dirinya sendiri (`SELF_MANAGEMENT`) atau mengelola rank yang sama/lebih tinggi (`RANK_HIERARCHY`).
- **DEVELOPER** tidak bisa didapat lewat registrasi atau dashboard (`RANK_NOT_ASSIGNABLE`). Hanya lewat CLI di server, tercatat di audit:
  `node server/cli.js bootstrap-developer` (hanya jika belum ada developer), `grant-developer --username X --confirm X`, `revoke-developer --username X --to DEWA --confirm X` (developer terakhir tidak bisa dicabut).
- Akun Google baru selalu **MEMBER**.

## Migrasi dari rank lama

`003_ranks_v2.sql` memindahkan akun lama otomatis: `PARTNER → SUKI`, `OWNER → RAJA`, `CEO → DEWA` (juga daftar pengecualian maintenance). Tidak ada akun atau bot yang dihapus; akun yang pemakaiannya melebihi kuota baru (mis. OWNER unlimited → RAJA 100) tetap menyimpan datanya, hanya penambahan baru yang diblokir. Teruji di `tests/server/rank-quota.test.js`.

## Matriks permission (dari database)

| Permission | MEMBER | RESELLER | SUKI | RAJA | DEWA | DEVELOPER |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `audit.view` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `audit.view_all` | — | — | — | — | — | ✓ |
| `backup.manage` | — | — | — | — | — | ✓ |
| `bot.ban` | — | — | — | — | — | ✓ |
| `bot.credential.reset` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `bot.maintenance` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `bot.manage` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `bot.session.revoke` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `bot.unban` | — | — | — | — | — | ✓ |
| `bot.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `bot.view_all` | — | — | — | — | — | ✓ |
| `dewa.create` | — | — | — | — | — | ✓ |
| `dewa.delete` | — | — | — | — | — | ✓ |
| `maintenance.manage` | — | — | — | — | — | ✓ |
| `number.create` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `number.delete` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `raja.create` | — | — | — | — | ✓ | ✓ |
| `raja.delete` | — | — | — | — | ✓ | ✓ |
| `reseller.create` | — | — | ✓ | ✓ | ✓ | ✓ |
| `reseller.delete` | — | — | — | ✓ | ✓ | ✓ |
| `role.assign` | — | — | ✓ | ✓ | ✓ | ✓ |
| `scope.global` | — | — | — | — | — | ✓ |
| `security.view` | — | — | — | — | — | ✓ |
| `suki.create` | — | — | — | ✓ | ✓ | ✓ |
| `suki.delete` | — | — | — | — | ✓ | ✓ |
| `system.view` | — | — | — | — | — | ✓ |
| `user.ban` | — | — | — | — | — | ✓ |
| `user.create` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user.delete` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user.unban` | — | — | — | — | — | ✓ |
| `user.update` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user.view` | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user.view_all` | — | — | — | — | — | ✓ |

## Status akun & bot

| Akun (`accounts.status`) | Efek |
|---|---|
| `active` | normal |
| `disabled` / `suspended` / `banned` | sesi dashboard dicabut, tidak bisa login, semua bot yang dimiliki/dipakai akun ini ditolak login & sesi bot dicabut |

Status bot dipisah menjadi tiga kolom: `connection_status` (disconnected/connecting/connected, dilaporkan proses bot), `enabled` (+alasan, pelaku, waktu), `banned` (+alasan, pelaku, waktu). Status efektif: banned > disabled > koneksi.
