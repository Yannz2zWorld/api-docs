# Rank, permission, ownership & kuota

Enam rank resmi (master prompt menyebut "lima" tetapi mencantumkan enam nama — keenamnya diimplementasikan):
`MEMBER`, `RESELLER`, `PARTNER`, `OWNER`, `CEO`, `DEVELOPER`.

Sumber kebenaran: tabel `ranks`, `permissions`, `rank_permissions` (seed di `server/migrations/002_ranks_permissions.sql`).
Backend memeriksa **permission eksplisit** pada setiap aksi (`server/services/accessControl.js`); level rank hanya dipakai untuk aturan
hierarki "tidak boleh mengelola rank yang sama atau lebih tinggi". Tombol di dashboard disembunyikan hanya demi kenyamanan.

## Kuota

| Rank | Maks nomor (bot) | Maks user dikelola | Bisa diberikan lewat dashboard |
|---|---:|---:|:-:|
| MEMBER | 0 | 0 | ✅ |
| RESELLER | 10 | 10 | ✅ |
| PARTNER | 50 | 50 | ✅ |
| OWNER | ∞ | ∞ | ✅ |
| CEO | ∞ | ∞ | ✅ |
| DEVELOPER | ∞ | ∞ | ❌ hanya CLI di server |

- **Dua kuota berbeda, tidak dihitung ganda**: kuota *nomor* = jumlah baris `bots` aktif dengan `owner_id` = akun; kuota *user* = jumlah `accounts` aktif dengan `manager_id` = akun.
- **Concurrency-safe**: penambahan dilakukan dalam transaksi yang mengunci baris akun pemilik kuota (`SELECT … FOR UPDATE`) lalu menghitung. Teruji: 25 request paralel untuk reseller kosong → tepat 10 berhasil.
- Reseller ditolak pada resource ke-11, partner pada ke-51 (`409 QUOTA_EXCEEDED` berisi `used`/`limit`). Member tidak bisa menambah apa pun.
- Hapus (soft-delete) langsung membebaskan slot.
- Perubahan rank langsung mengubah kuota efektif. Jika rank turun dan pemakaian melebihi batas baru, **data tidak dihapus**; penambahan diblokir sampai pemakaian di bawah batas (respons `over_quota: true`).
- Kuota divalidasi di semua jalur yang membuat resource: API dashboard (`accountService.create`, `botService.create`, re-parent saat `changeRank`). CLI hanya membuat akun DEVELOPER awal.
- Dashboard menampilkan pemakaian sebagai `7/10`, `32/50`, atau `5/∞`.

## Ownership & cakupan

- Setiap akun punya `manager_id` (atasan). **Cakupan** aktor = semua akun di bawahnya secara rekursif (pohon delegasi).
- Bot dimiliki `owner_id` (kuota nomor dihitung ke akun ini) dan boleh punya `user_account_id` (akun yang memakai bot).
- Aktor boleh mengelola akun target jika: target **bukan dirinya**, rank target **lebih rendah**, dan target berada di cakupannya — atau aktor punya `scope.global` (OWNER/CEO/DEVELOPER; tetap hanya rank lebih rendah).
- Akses lintas pemilik ditolak `403 OUT_OF_SCOPE` (teruji untuk ubah/hapus/reset password/cabut sesi antar reseller).

## Aturan rank

- Membuat akun rank X butuh `<x>.create` (MEMBER → `user.create`, RESELLER → `reseller.create`, …) dan X lebih rendah dari rank aktor.
- Mengubah rank butuh `role.assign` + `<rank tujuan>.create` (naik) atau `<rank asal>.delete` (turun).
- Tidak ada yang bisa mengubah rank dirinya sendiri (`SELF_MANAGEMENT`).
- Reseller tidak bisa membuat/menghapus reseller lain (tidak punya `reseller.create/delete`); partner bisa untuk reseller dalam cakupannya, tidak bisa membuat owner/CEO/developer.
- CEO tidak bisa mengubah/menurunkan DEVELOPER (hierarki level).
- Jika akun dinaikkan setara/lebih tinggi dari manager lamanya, akun dipindah ke bawah aktor (kuota user aktor dicek).
- **DEVELOPER** tidak bisa didapat lewat registrasi atau API (`RANK_NOT_ASSIGNABLE`). Pemberian/pencabutan hanya lewat CLI di server (butuh akses shell) dan tercatat di audit:
  `node server/cli.js bootstrap-developer` (hanya jika belum ada developer), `grant-developer --username X --confirm X`, `revoke-developer --username X --to CEO --confirm X` (developer terakhir tidak bisa dicabut).
- Akun Google baru selalu **MEMBER** (rank paling aman).

## Matriks permission (dari database)

| Permission | MEMBER | RESELLER | PARTNER | OWNER | CEO | DEVELOPER |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `audit.view` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `audit.view_all` | — | — | — | ✅ | ✅ | ✅ |
| `backup.manage` | — | — | — | — | — | ✅ |
| `bot.ban` | — | — | — | ✅ | ✅ | ✅ |
| `bot.credential.reset` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bot.maintenance` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bot.manage` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bot.session.revoke` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bot.unban` | — | — | — | ✅ | ✅ | ✅ |
| `bot.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bot.view_all` | — | — | — | ✅ | ✅ | ✅ |
| `ceo.create` | — | — | — | — | — | ✅ |
| `ceo.delete` | — | — | — | — | — | ✅ |
| `maintenance.manage` | — | — | — | — | ✅ | ✅ |
| `number.create` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `number.delete` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `owner.create` | — | — | — | — | ✅ | ✅ |
| `owner.delete` | — | — | — | — | ✅ | ✅ |
| `partner.create` | — | — | — | ✅ | ✅ | ✅ |
| `partner.delete` | — | — | — | ✅ | ✅ | ✅ |
| `reseller.create` | — | — | ✅ | ✅ | ✅ | ✅ |
| `reseller.delete` | — | — | ✅ | ✅ | ✅ | ✅ |
| `role.assign` | — | — | ✅ | ✅ | ✅ | ✅ |
| `scope.global` | — | — | — | ✅ | ✅ | ✅ |
| `security.view` | — | — | — | ✅ | ✅ | ✅ |
| `system.view` | — | — | — | ✅ | ✅ | ✅ |
| `user.ban` | — | — | — | ✅ | ✅ | ✅ |
| `user.create` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `user.delete` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `user.unban` | — | — | — | ✅ | ✅ | ✅ |
| `user.update` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `user.view` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `user.view_all` | — | — | — | ✅ | ✅ | ✅ |

Catatan kebijakan yang bisa diubah lewat migrasi baru: OWNER tidak punya `maintenance.manage` (maintenance global hanya CEO & DEVELOPER); backup hanya DEVELOPER.

## Status akun & bot

| Akun (`accounts.status`) | Efek |
|---|---|
| `active` | normal |
| `disabled` / `suspended` / `banned` | sesi dashboard dicabut, tidak bisa login, semua bot yang dimiliki/dipakai akun ini ditolak login & sesi bot dicabut |

Status bot dipisah menjadi tiga kolom: `connection_status` (disconnected/connecting/connected, dilaporkan proses bot), `enabled` (+alasan, pelaku, waktu), `banned` (+alasan, pelaku, waktu). Status efektif: banned > disabled > koneksi.
