'use strict';
// Fitur islami dari dataset lokal V15 (data/islamic): Asmaul Husna, daftar & info surah (+ audio murottal
// Mishary dari quranicaudio.com sesuai dataset), kisah nabi. Jadwal sholat & doa lain lewat APIZ2Z.
const path = require('path');
const crypto = require('crypto');
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

const DIR = path.join(__dirname, '..', '..', 'data', 'islamic');
const ASMA = require(path.join(DIR, 'asmaul_husna.json'));
const QURAN = require(path.join(DIR, 'quran.json'));
const NABI = ['adam', 'idris', 'nuh', 'hud', 'sholeh', 'ibrahim', 'luth', 'ismail', 'ishaq', 'yaqub', 'yusuf', 'ayyub', 'syuaib', 'musa', 'harun', 'dzulkifli', 'daud', 'sulaiman', 'ilyas', 'ilyasa', 'yunus', 'zakariya', 'yahya', 'isa', 'muhammad'];
const I = f => feature({ category: 'islamic', ...f });

function findSurah(q) {
  const s = String(q || '').trim().toLowerCase();
  if (/^\d{1,3}$/.test(s)) return QURAN.find(x => x.number_of_surah === Number(s)) || null;
  const norm = x => x.toLowerCase().replace(/[^a-z]/g, '');
  return QURAN.find(x => norm(x.name) === norm(s) || norm(x.name_translations.id) === norm(s)) || QURAN.find(x => norm(x.name).includes(norm(s))) || null;
}
const fmtAsma = a => `${a.number}. *${a.latin}* — ${a.arab}\n   ${a.translate_id}`;

module.exports = [
  I({ id: 'islamic.asmaulhusna', name: 'asmaulhusna', category: 'islamic', description: '99 Asmaul Husna: .asmaulhusna [nomor | acak | semua]', usage: '[nomor|semua]',
    pure: t => { const s = String(t || '').trim().toLowerCase(); if (s === 'semua' || s === 'all') return ASMA.map(fmtAsma).join('\n'); if (/^\d{1,2}$/.test(s)) { const a = ASMA[Number(s) - 1]; if (!a) throw new UsageError('Nomor 1-99.'); return fmtAsma(a); } return fmtAsma(ASMA[crypto.randomInt(0, ASMA.length)]); },
    tests: [{ input: '1', expect: '1. *Ar Rahman* — الرَّحْمَنُ\n   Yang Memiliki Mutlak sifat Pemurah' }, { input: 'semua', expect: o => o.split('\n').length === 198 }],
    async run(ctx) { await ctx.reply(this.pure(ctx.text)); } }),
  I({ id: 'islamic.listsurah', name: 'listsurah', aliases: ['daftarsurah'], category: 'islamic', description: 'Daftar 114 surah Al-Quran',
    pure: () => QURAN.map(s => `${s.number_of_surah}. ${s.name} (${s.name_translations.id}) — ${s.number_of_ayah} ayat`).join('\n'),
    tests: [{ input: '', expect: o => o.split('\n').length === 114 && o.startsWith('1. Al-Fatiha (Pembukaan) — 7 ayat') }],
    async run(ctx) { await ctx.reply(this.pure()); } }),
  I({ id: 'islamic.surahinfo', name: 'surahinfo', aliases: ['infosurah'], category: 'islamic', description: 'Info surah: nama, arti, jumlah ayat, golongan', usage: '<nomor|nama>',
    pure: t => { const s = findSurah(t); if (!s) throw new UsageError('Surah tidak ditemukan. Contoh: .surahinfo 36 atau .surahinfo yasin'); return `📖 *${s.number_of_surah}. ${s.name}* (${s.name_translations.ar})\nArti: ${s.name_translations.id}\nJumlah ayat: ${s.number_of_ayah}\nGolongan: ${s.type} (${s.place === 'Mecca' ? 'Makkah' : 'Madinah'})`; },
    tests: [{ input: '36', expect: o => o.includes('36. Yasin') && o.includes('Jumlah ayat: 83') }, { input: 'al-ikhlas', expect: /112\./ }],
    async run(ctx) { await ctx.reply(this.pure(ctx.text)); } }),
  I({ id: 'islamic.murottal', name: 'murottal', aliases: ['audiosurah', 'audiosurat'], category: 'islamic', description: 'Audio murottal satu surah (Mishary Rashid Alafasy)', usage: '<nomor|nama>', cooldown: 15, limit: 1,
    async run(ctx) { const s = findSurah(ctx.requireText()); if (!s) throw new UsageError('Surah tidak ditemukan.'); await ctx.reply(`🎧 ${s.number_of_surah}. ${s.name} — mengirim audio...`); await ctx.sendFile(s.recitation, { fileName: `${s.name}.mp3` }); } }),
  I({ id: 'islamic.kisahnabi', name: 'kisahnabi', category: 'islamic', description: 'Kisah 25 nabi: .kisahnabi <nama>', usage: '<nama nabi>', cooldown: 5,
    async run(ctx) {
      const n = ctx.text.toLowerCase().replace(/^nabi\s+/, '').replace(/[^a-z]/g, '');
      if (!NABI.includes(n)) return ctx.reply(`Nama nabi: ${NABI.join(', ')}`);
      const d = require(path.join(DIR, 'kisah_nabi', `${n}.json`));
      const x = Array.isArray(d) ? d[0] : d;
      await ctx.reply(`📜 *${x.name}*\nTahun lahir (menurut dataset): ${x.thn_kelahiran} · Usia: ${x.usia} tahun · Tempat: ${x.tmp || '-'}\n\n${String(x.description).slice(0, 6000)}`);
    } }),
  I({ id: 'islamic.listnabi', name: 'listnabi', category: 'islamic', description: 'Daftar 25 nabi dan rasul', pure: () => NABI.map((n, i) => `${i + 1}. Nabi ${n.charAt(0).toUpperCase() + n.slice(1)}`).join('\n'), tests: [{ input: '', expect: o => o.split('\n').length === 25 }], async run(ctx) { await ctx.reply(this.pure()); } })
];
