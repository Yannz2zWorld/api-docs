'use strict';
// Fitur islami dari dataset lokal V15 (data/islamic): Asmaul Husna, daftar & info surah (+ audio murottal
// Mishary dari quranicaudio.com sesuai dataset), kisah nabi. Jadwal sholat & doa lain lewat APIZ2Z.
const path = require('path');
const crypto = require('crypto');
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');

const DIR = path.join(__dirname, '..', 'data', 'islamic');
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

module.exports = { DIR, ASMA, QURAN, NABI, I, findSurah, fmtAsma };
