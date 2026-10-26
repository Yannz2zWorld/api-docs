'use strict';
// Pengingat waktu sholat otomatis per grup (V15: .autosholat on <kota> / off).
// Jadwal harian diambil dari APIZ2Z (jadwal-sholat, cadangan v2) sekali per kota per hari, lalu
// grup diberi pengingat tepat di waktu subuh, dzuhur, ashar, maghrib, isya (zona waktu bot).
const scheduler = require('../library/scheduler');
const { dataOf } = require('./apiz2z-kit');

const PRAYERS = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
const KEYS = { subuh: /^(subuh|shubuh|fajr)$/i, dzuhur: /^(dzuhur|zuhur|dhuhr|dzuhr)$/i, ashar: /^(ashar|asar|asr)$/i, maghrib: /^(maghrib|magrib)$/i, isya: /^(isya|isha|isyak)$/i };
const cache = new Map();   // `${kota}|${date}` -> { subuh: '04:30', ... }

// Cari jam sholat (HH:MM) di respons berbentuk apa pun; utamakan entri tanggal hari ini kalau bulanan.
function extractTimes(data, date) {
  const out = {};
  const day = Number(String(date).slice(8, 10));
  const visit = (v, depth) => {
    if (!v || typeof v !== 'object' || depth > 6 || PRAYERS.every(p => out[p])) return;
    if (Array.isArray(v)) {
      const today = v.find(x => x && typeof x === 'object' && (String(x.tanggal || x.date || '').includes(date) || Number(x.tanggal) === day || new RegExp(`(^|\\D)0?${day}(\\D|$)`).test(String(x.tanggal || x.date || ''))));
      return visit(today || v[0], depth + 1);
    }
    for (const [k, x] of Object.entries(v)) {
      const p = PRAYERS.find(n => KEYS[n].test(k));
      const t = typeof x === 'string' && /(\d{1,2})[:.](\d{2})/.exec(x);
      if (p && t && !out[p]) out[p] = `${t[1].padStart(2, '0')}:${t[2]}`;
      else if (x && typeof x === 'object') visit(x, depth + 1);
    }
  };
  visit(data, 0);
  return PRAYERS.every(p => out[p]) ? out : null;
}

async function timesFor(api, kota, date) {
  const key = `${kota.toLowerCase()}|${date}`;
  if (cache.has(key)) return cache.get(key);
  let times = null;
  for (const path of ['/api/info/jadwal-sholat', '/api/info/jadwal-sholat-v2']) {
    try { times = extractTimes(dataOf(await api.get(path, { kota })), date); } catch { /* coba cadangan */ }
    if (times) break;
  }
  if (cache.size > 200) cache.clear();
  if (times) cache.set(key, times);
  return times;
}

scheduler.register('autosholat', async (y, now) => {
  for (const [jid, g] of Object.entries(y.database.raw().groups)) {
    const a = g.autoSholat;
    if (!a?.enabled || !a.kota) continue;
    const times = await timesFor(y.api, a.kota, now.date);
    const p = times && PRAYERS.find(n => times[n] === now.hhmm);
    if (!p || a.last === `${now.date}|${p}`) continue;
    a.last = `${now.date}|${p}`; y.database.touch();
    await y.sendmessage(jid, { text: `🕌 *Waktunya sholat ${p.charAt(0).toUpperCase() + p.slice(1)}* (${times[p]} — ${a.kota})\nYuk tinggalkan sejenak aktivitasnya dan tunaikan sholat. 🤲` }).catch(() => {});
  }
});

module.exports = { PRAYERS, extractTimes, timesFor };
