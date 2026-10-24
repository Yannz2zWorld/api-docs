#!/usr/bin/env node
'use strict';
// Rapikan library/catalog/v15-backlog.json setelah audit ulang source V15:
//  - hapus "nama" yang ternyata bukan command (label case di switch bagian dalam: pilihan warna
//    .yannqc dan status progres voicecover) -> dicatat di notCommands;
//  - tandai command yang tidak akan dibuat (status disabled + alasan).
// Aman diulang: hasil sama untuk input yang sama.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'library', 'catalog', 'v15-backlog.json');

const NOT_COMMANDS = {
  reason: 'Bukan command V15: label case di switch bagian dalam (warna .yannqc / status progres voicecover).',
  names: ['pink', 'biru', 'merah', 'hijau', 'kuning', 'ungu', 'birutua', 'birumuda', 'abu', 'orange', 'hitam', 'putih', 'teal', 'merahmuda', 'cokelat', 'salmon', 'magenta', 'tan', 'wheat', 'deeppink', 'api', 'birulangit', 'jingga', 'birulangitcerah', 'hotpink', 'birumudalangit', 'hijaulaut', 'merahtua', 'oranyemerah', 'cyan', 'ungutua', 'hijaulumut', 'hijaugelap', 'birulaut', 'oranyetua', 'ungukehitaman', 'fuchsia', 'magentagelap', 'abu-abutua', 'peachpuff', 'hijautua', 'merahgelap', 'goldenrod', 'ungugelap', 'emas', 'perak',
    'success', 'failed', 'searching', 'separating', 'starting', 'processing', 'mixing']
};

const R = {
  sexual: 'Konten seksual / eksploitasi — tidak akan diimplementasikan.',
  viewonce: 'Membuka ulang pesan sekali lihat (view once) melanggar privasi pengirim.',
  realPeople: 'Foto/video acak orang sungguhan (bukan publik figur) tanpa persetujuan; sebagian menyasar anak — tidak diimplementasikan.',
  panel: 'Panel Pterodactyl (jual/kelola server) — di luar cakupan bot dan dilarang aturan VPS.',
  osint: 'Pencarian data pribadi pemilik nomor (OSINT/NIK) — melanggar privasi.',
  spam: 'Kirim pesan massal / anonim ke nomor sembarang — rawan spam & pelecehan.',
  source: 'Mengirim source code/session bot ke chat — risiko kebocoran kredensial.',
  obf: 'Obfuscator kode pihak ketiga dari chat — di luar cakupan; pakai build:dist bawaan untuk melindungi kode bot.'
};
const DISABLE = {
  'ah-ah-ah': R.sexual, bzirrt: R.sexual, cekfemboy: 'Konten seksual tentang orang yang disebut namanya — tidak diimplementasikan.',
  ehbtw: R.viewonce, rvo: R.viewonce, rvo2: R.viewonce,
  confes: R.spam, broadcast: R.spam,
  getsc: R.source,
  ceknomor: R.osint, ceknohp: R.osint, ceknim: R.osint, nomorinfo: R.osint, sidompul: R.osint,
  'menu-nsfw': R.sexual, 'menu-panel': R.panel, 'menu-asupan': R.realPeople, 'menu-cecan': R.realPeople,
  configurewings: R.panel, startwings: R.panel, cadp: R.panel, createadp: R.panel, delpanel: R.panel, deletepanel: R.panel,
  delsrv: R.panel, deluser: R.panel, listpanel: R.panel, listuser: R.panel, mypanel: R.panel, notif: R.panel, renew: R.panel, renewserver: R.panel, unli: R.panel,
  cogan: R.realPeople, randomcecan: R.realPeople, randomcogan: R.realPeople
};
const DISABLE_RE = [[/^(\d+gb)$/, R.panel], [/^cecan/, R.realPeople], [/^asupan/, R.realPeople], [/(enc|encrypt).*(custom|invis|siu|strong|ultra)|(custom|invis|siu|strong|ultra).*(enc|encrypt)|^(enc|encrypt)(custom|invis|siu|strong|ultra)|js(custom|invis|siu|strong|ultra)enc|^en?c(custom|invis|siu|strong|ultra)/, R.obf]];

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const notCmd = new Set(NOT_COMMANDS.names);
const before = data.items.length;
data.items = data.items.filter(it => !notCmd.has(it.name));
let disabled = 0;
for (const it of data.items) {
  const reason = DISABLE[it.name] || DISABLE_RE.find(([re]) => re.test(it.name))?.[1];
  if (reason && it.status !== 'disabled') { it.status = 'disabled'; it.reason = reason; disabled++; }
}
data.notCommands = { reason: NOT_COMMANDS.reason, names: [...notCmd].sort() };
data.v15NamesRaw = data.v15NamesRaw || data.v15Names;
data.v15Names = data.v15NamesRaw - notCmd.size;
data.curatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
console.log(`Backlog: ${before} -> ${data.items.length} item (${before - data.items.length} bukan command), ${disabled} baru ditandai disabled.`);
