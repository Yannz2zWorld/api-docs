'use strict';
// Membuat DAFTAR-API.txt: semua API yang dipakai bot, mana yang butuh key, dan tempat mengisinya.
//   node tools/api-list.js
const fs = require('fs');
const path = require('path');
const { Registry } = require('../library/registry');

const ROOT = path.join(__dirname, '..');
const r = new Registry({ db: () => ({ features: {} }) });
r.loadDir(path.join(ROOT, 'plugins'));
const by = {};
for (const f of r.features.values()) {
  if (f.category === 'backlog' || !(f.dependencies?.apiz2z || f.source === 'apiz2z')) continue;
  (by[f.category] = by[f.category] || []).push(f.name);
}
const total = Object.values(by).reduce((a, l) => a + l.length, 0);
const wrap = (list, w = 90) => { const out = []; let line = '   '; for (const n of list.sort()) { if (line.length + n.length + 2 > w) { out.push(line.trimEnd()); line = '   '; } line += n + ', '; } out.push(line.replace(/, $/, '')); return out.join('\n'); };

const txt = `YANNAJAH AI - DAFTAR API
========================
Dibuat otomatis dari kode bot (node tools/api-list.js). Total command yang memakai API key: ${total}.


1. APIZ2Z  (API UTAMA, PAKAI KEY)
   Alamat : https://apiz2z.web.id
   Key    : buat di https://apiz2z.web.id -> menu API key
   Tempat : settingsbot.js, baris:
              global.apikeyapiz2z = "isi_key_kamu"
            (atau file .env: APIZ2Z_API_KEY=isi_key_kamu, kalau diisi .env yang dipakai)
   Kalau kosong: bot tetap jalan, tapi command di bawah membalas "Fitur ini butuh API key APIZ2Z".
   Command yang memakai APIZ2Z (${total}), per kategori:

${Object.entries(by).sort().map(([c, l]) => `   [${c}] ${l.length} command\n${wrap(l)}`).join('\n\n')}


2. API TANPA KEY (sudah jalan, tidak perlu diisi)
   https://catbox.moe        upload file      (.tourl, .catbox)
   https://uguu.se           upload file      (.tourl cadangan, .uguu)
   https://api.jikan.moe     info anime       (.charinfo / .searchchar)
   https://pastebin.com      ambil teks       (.pastebin)
   WhatsApp                  koneksi bot (Baileys)
   Web database YannAjah     login bot, ban, maintenance (alamat tertanam di yannajah.js)


3. API LAMA DARI YANN AI V15 (ADA DI settingsbot.js, BELUM DIPAKAI FITUR MANA PUN)
   Variabelnya tetap ada di settingsbot.js di tempat aslinya, key-nya dikosongkan.
   Kalau kamu isi, bilang ke saya fitur mana yang mau memakainya, nanti saya sambungkan.

   Variabel di settingsbot.js        Alamat / keterangan                 Pakai key?
   global.apialip / apikeyalip       https://api.clutch.web.id           ya (apikeyalip)
   global.btc / apibotcahx           https://api.botcahx.eu.org          ya (apibotcahx)
   global.dongtubeapi / apikeydongtube  https://api.dongtube.id          ya (apikeydongtube)
   global.termai / apitermai         https://api.termai.cc               ya (apitermai)
   global.apiPitu / PituKey          https://api.pitucode.com            ya (PituKey)
   global.Theresav / TheresaApi      https://api.theresav.eu             ya (TheresaApi)
   global.ramsapikey                 API rams                             ya
   global.pakasir.project / apiKey   payment gateway Pakasir             ya
   global.premku                     apikey premku (apk prem)             ya
   global.amPremApikey               https://alipshop.clutch.web.id      ya
   global.cloudflareZoneId / ApiToken / Domain   Cloudflare (subdomain)  ya
   global.egg / nestid / loc / domain / apikey / capikey   panel Pterodactyl   ya (ptla/ptlc)


4. YANG TIDAK PAKAI API (LOKAL)
   Game, efek teks, sertifikat, stiker, efek audio/video (ffmpeg), edit gambar lokal, menu, grup,
   owner, toko/list, ekonomi, ramalan, dll. Tidak butuh key apa pun.
`;
fs.writeFileSync(path.join(ROOT, 'DAFTAR-API.txt'), txt);
console.log(`DAFTAR-API.txt dibuat (${total} command APIZ2Z)`);
