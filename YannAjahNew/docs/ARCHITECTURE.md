# Arsitektur YannAjahNew

```
                         ┌──────────────────────────── server/ (backend pusat) ─────────────────────────────┐
  Browser admin ──HTTPS──▶ routes/auth.js (Google OIDC, link CLI)      services/accessControl (rank+permission+cakupan)
                          routes/dashboardApi.js (CSRF+Origin)  ──▶  services/account|bot|quota|maintenance|audit
                          routes/botApi.js (Bearer token bot)   ──▶  services/botAuthService (login/verify/heartbeat)
                                                                       │
                                                                       ▼
                                                               PostgreSQL (akun, rank, bot, kredensial, sesi, audit)
                         └────────────────────────────────────────────────────────────────────────────────────┘
                                         ▲ HTTPS: login nomor+password bot, verify, heartbeat (tiap N menit)
                                         │
  ┌──────────────────────────────────── proses bot (satu proses = satu nomor WhatsApp) ───────────────────────────┐
  │ index.js ── library/license.js (yannajah.auth) ── fail-closed, token 0600, lease instance                       │
  │    │        library/connection.js (Baileys 7: QR / pairing code, lock session, reconnect terkendali)            │
  │    │        myfunct/message.js (serializer, LID→nomor) → command.js (router) → plugins/** (feature registry)    │
  │    │        yannajah.js (namespace + facade database lokal) ── source/database.js (JSON atomik)                │
  │    └──────  library/apiz2z.js (yannajah.api) ──HTTPS(Bearer)──▶ apiz2z.web.id (hanya endpoint terverifikasi)   │
  └────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Pemisahan tanggung jawab

| Lapisan | File |
|---|---|
| Konfigurasi | `settingsbot.js`, `library/config-loader.js`, `server/config.js` |
| Core engine & koneksi WhatsApp | `index.js`, `library/connection.js` |
| Autentikasi & pairing | `library/license.js` (bot), `server/services/botAuthService.js`, `server/routes/auth.js` |
| Router command, event | `command.js`, `myfunct/message.js`, `myfunct/handler.js` |
| Plugin manager & feature registry | `library/registry.js`, `library/plugin-kit.js`, `plugins/**` |
| Database adapter | `yannajah.js` (facade), `source/database.js`; pusat: `server/lib/db.js` |
| API integration | `library/apiz2z.js`, `library/apiz2z-render.js`, `library/catalog/*.json` |
| Media | `library/media.js` (ffmpeg spawn, stiker+exif) |
| Permission | bot: `command.js`; pusat: `server/services/accessControl.js` |
| Logger & error | `library/logger.js` (redaksi otomatis), `library/errors.js`, `server/lib/errors.js` |
| Validasi | `server/lib/validate.js`, `library/apiz2z.js#validateParams` |
| Session | `library/connection.js` (lock + persist), `server/services/sessionService.js` |
| Dashboard | `server/public/*` |
| Health & background | `GET /health`, `GET /health/ready`, heartbeat lisensi, pengingat (`plugins/productivity`), auto-save DB |

## Alur penting

**Start bot.** Banner → validasi config → `license.verifyStored()` (token lama) atau login nomor + password → DB lokal → registry plugin → `wa.start()` (session lama, atau QR / pairing code untuk nomor bot terdaftar) → heartbeat.

**Ban / disable / sesi dicabut di dashboard.** Transaksi: ubah status + cabut `bot_sessions` + audit → heartbeat bot berikutnya dapat `401 SESSION_REVOKED` → `license` membuang token dan memancarkan `locked` → `wa.stop()`; `handleClose` tidak reconnect selama lisensi terkunci → router tidak menjalankan fitur apa pun. Login ulang ditolak `BOT_BANNED` sampai di-unban. Bila server lisensi tidak terjangkau lebih lama dari `offlineGraceMinutes` (default 0) bot juga terkunci (tidak ada akses penuh secara default).

**Maintenance.** Global (CEO/DEVELOPER) atau per bot. Bot tetap terhubung; non-owner dibalas pesan maintenance. Bot milik rank di `exempt_ranks` tidak terkena maintenance global.

**Satu session = satu proses.** Lokal: lock file di folder session (pid hidup → tolak). Pusat: lease `instance_id` — login proses lain ditolak `409 INSTANCE_ACTIVE` selama proses lama masih heartbeat (< 3 menit), kecuali `force` (proses lama otomatis terkunci). Nomor WhatsApp yang dipairing wajib sama dengan nomor bot di dashboard; jika berbeda session dilepas.

**Graceful shutdown.** SIGINT/SIGTERM → stop heartbeat → tutup socket (tunggu creds tersimpan, session TIDAK dihapus) → simpan DB → laporkan `disconnected`.

## Namespace `yannajah`

```js
yannajah.sendmessage(jid, 'teks' | {image|video|audio|sticker|document|...}, opts)   // antrian per chat + retry
yannajah.reply(m, konten)            yannajah.react(m, '✅')
yannajah.sendFile(jid, buffer | 'https://…' | {buffer, mime}, { caption, ptt, asDocument })  // tipe dari isi file
yannajah.database.get(['users', jid, 'money'])   yannajah.database.set('settings.public', true)
yannajah.database.user(jid)  yannajah.database.group(jid)  yannajah.database.save()
yannajah.api.get('/api/search/google', { q })  yannajah.api.post(path, params, {buffer, mime})
yannajah.api.getEndpoints({ category })  yannajah.api.getStatus()
yannajah.auth.isActive()  yannajah.auth.status()  yannajah.auth.maintenance()  yannajah.auth.verify()
yannajah.plugins.register(feature)  .list()  .get('menu')  .enable(id)  .disable(id)
```
Path database berupa string bertitik atau **array** (wajib array bila kunci mengandung titik, seperti JID). `__proto__`/`constructor`/`prototype` ditolak.

## Menulis plugin

```js
// plugins/contoh/halo.js
const { feature, textTool } = require('../../library/plugin-kit');
module.exports = [
  textTool({ id: 'contoh.balik', name: 'balikteks', category: 'text', description: 'Membalik teks',
    fn: t => [...t].reverse().join(''), tests: [{ input: 'abc', expect: 'cba' }] }),
  feature({ id: 'contoh.halo', name: 'halo', category: 'fun', description: 'Menyapa', permission: 'user', scope: 'all',
    async run(ctx) { await ctx.reply(`Halo ${ctx.m.pushName}!`); } })
];
```
Metadata wajib: `id` unik, `name`, `category`, `description`, `aliases`, `permission` (user/premium/admin/owner), `scope` (all/group/private), `status`, `params`, `dependencies`. Nama/alias yang bentrok ditolak saat load (lihat `npm run features:report`). Plugin format lama (`handler.command = [...]`) tetap didukung lewat adapter.
**Plugin tidak tepercaya**: Node.js tidak menyediakan sandbox yang aman, jadi file di `plugins/external/` **tidak dimuat** kecuali SHA-256-nya didaftarkan di `settingsbot.js → plugin.trustedExternal`.
