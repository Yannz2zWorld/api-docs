# Migrasi Lena AI v15 → YannAjah AI

Dokumen ini mencatat hasil audit **seluruh** command Lena AI v15 (`lena-cmd.js` ~1.300 case + 130 plugin)
dan statusnya di YannAjah AI. Non-destruktif: tidak ada fitur yang bekerja dihapus; yang belum dipindah
dicatat sebagai `planned`, yang dilarang kebijakan dicatat `disabled` beserta alasannya.

## Ringkasan

| | Jumlah |
|---|---:|
| Command unik Lena v15 (case + plugin) | 1561 |
| Sudah berfungsi di YannAjah (working) | 1234 |
| Planned (belum dipindah / alias satu sama lain) | 52 |
| Disabled (kebijakan keamanan/konten) | 220 |
| Label case palsu (bukan command, mis. warna `.alipqc`, status `voicecover`) | diabaikan |

Angka ini dihitung oleh skrip audit internal; sumber kebenaran adalah `npm run features:report`
(docs/FEATURES.md) untuk daftar fitur YannAjah, dan `library/catalog/v15-backlog.json` untuk backlog.

## Prinsip pemetaan

1. **APIZ2Z dulu.** Command media/AI/download/search Lena diarahkan ke endpoint APIZ2Z yang setara
   lewat generator `plugins/apiz2z/apiz2z.js` (nama + alias V15). Contoh: `country`→`/api/tools/countryinfo`,
   `bmkg`→`/api/info/gempa`, `th`→`/api/download/threads`, `lenaedit/alipedit`→`/api/ai/nano-banana`,
   `lenadl/alipdl`→`/api/download/aio`, `bratgambar`→`/api/maker/brat`, `stikermeme`→`/api/maker/smeme`.
2. **Fitur lokal** (ffmpeg/canvas/jimp) diport jadi plugin baru tanpa API: `tempo`, `hdvideo`,
   `img2video/luma`, `emojiwa`, game `tebakinggris`/`tebakkalimat`/`sambungkata`.
3. **API non-APIZ2Z** yang memang perlu (tidak ada padanannya di APIZ2Z) tetap diimplementasikan dan
   dicatat di `DAFTAR-API.txt` beserta nama variabel key-nya — **tidak dihapus**.
4. **Adapter plugin legациy.** Format Lena `let handler = async (m,{sock,text,command,Reply,isCreator})=>{}`
   + `handler.command=[...]` tetap jalan lewat `Registry.adaptLegacy` (lihat `library/registry.js`):
   context lama disediakan (`conn/sock/lena/alip/clutch`, `Reply`, `isCreator`, `isPrem`, `checkLimit`,
   `addLimit`, dll. di `yannai-cmd.js` `legacyContext()`).

## Command yang diimplementasikan pada migrasi ini (contoh)

| Command V15 | Status di YannAjah | Catatan |
|---|---|---|
| tahukahkamu, country, bmkg, th, freestalk, bratgambar, bratgambarhd, stikermeme, bintang, lenaedit, alipedit, lenadl, alipdl | alias → APIZ2Z | satu command per endpoint |
| aigambar, amprem, amverify | APIZ2Z (`/api/ai/gambar`, `/api/premium/alightmotion-*`) | amprem/amverify = premium |
| tebakinggris, tebakkalimat, sambungkata | game lokal (dataset v15) | dataset disalin ke `data/game/` |
| tebakjkt | game (API siputzx) | soal live |
| airealtime, ttsbrando, pakustad, ngl | AI (API faa/taka, tanpa key) | |
| logicbell, copilotvoice | AI (Termai/Alip, **butuh key** → NOT TESTED tanpa key) | |
| zrooart, aivideo (sora/veo3/ailabs) | AI provider pihak ketiga | **IMPLEMENTED — NOT TESTED** |
| tempo, hdvideo, img2video/luma | media ffmpeg lokal | |
| bratgambar3, tvstiker+dll, emojiwa | stiker (nekorinn / BotcahX / emoji Apple) | BotcahX butuh key |
| toproblox, get/g/fetch, gtmp3, quax, top4top, web2apk | tools | `get` owner-only; web2apk premium NOT TESTED |
| sdm, sharkstudio+batalkostum | edit foto AI (APIZ2Z nano-banana) | sharkstudio 2 langkah |
| playch, stikercmd/delstikercmd, autocorrect, swgc(ada), amai, developer, listgrup, upch2, sound/sad | owner/menu/media | sound1..250 & sad1..55 jadi alias `sound`/`sad` |

## Disabled (kebijakan) — tidak diimplementasikan, tercatat dengan alasan

- **Panel Pterodactyl** (`setpanel`, `installpanel`, `1gb`..`10gb`, `suspend`, `delusr`, `listpanel`,
  `manage*`, `notifmode`, `setsmtp`, dst.) — di luar cakupan bot & dilarang requirement (PROMPT-BOT-DB).
- **Spam / broadcast massal** (`jpm`, `jpm2`, `pushkontak`, `swgc_process`, `sendtesti`, `bom`, `nglspam`).
- **Pemalsuan** (`fakedana`, `fakeff`, `fakeffduo`, `fakereply`, `struk`, `fitnah`, `fakewa`).
- **Konten seksual / foto orang nyata tanpa izin** (`nsfw*`, `cecan*`, `asupan*`, `tebakjorok`, dll.).
- **Obfuscator kode dari chat** (`customjsen`, `enc*`) — pakai `build:dist` bawaan.
- **View-once reopen** (`rvo`, `readviewonce`), **OSINT nomor** (`sidompul`, `ceknohp`), **getsc/getsession**.

## Planned (belum dipindah, aman menyusul)

`alipqc` (quote-chat warna), `hiitwixtor/twixtor` (scrape situs), sub-command tictactoe alternatif
(`tttplay/tttmove/...` — game tictactoe sudah ada dengan input angka), dan beberapa varian alias.
Daftar lengkap: `library/catalog/v15-backlog.json` (status `planned`).

## Data & aset yang ikut dipindah

`data/game/tebakinggris.json`, `tebakkalimat.json`, `sambungkata.json`, dan font `assets/fonts/Epep.ttf`.
Dataset yang tidak dipindah: set vulgar/foto orang nyata (kebijakan) — lihat daftar disabled di atas.
