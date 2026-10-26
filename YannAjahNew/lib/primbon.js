'use strict';
// Fun & primbon V15: ramalan aura/batere/beban/dompet/profesi/jodoh/masa depan, info planet,
// fakta dunia, tembak & jadian, plus konten islami ringan (niat sholat, quotes, dzikir, hadits).
// Teks diambil dari V15 (data/v15/fun.json, entri vulgar dibuang). Hasil acak memakai crypto.randomInt.
const crypto = require('crypto');
const { feature, textTool } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const { targetJid, mention } = require('../library/targets');
const DATA = require('../data/v15/fun.json');

const F = f => feature({ category: 'fun', limit: 1, ...f });
const pick = list => list[crypto.randomInt(0, list.length)];
const fill = (tpl, name) => String(tpl).replace(/\{name\}/g, name);

const AURA = [
  [0, 4, '👻 *Aura Kelelawar (Hitam Pekat)*\nAuramu aktif saat dunia sedang tidur. Kamu penuh misteri dan pikiranmu sering berkelana di server Discord atau dunia mimpi. Cocok jadi penjaga malam atau admin akun menfess.'],
  [5, 9, '☕ *Aura Kopi Susu (Cokelat Muda)*\nKamu punya energi yang besar di pagi hari, tapi cepat loyo setelah jam makan siang. Penuh semangat dan harapan palsu di awal hari.'],
  [10, 14, '🍛 *Aura Nasi Padang (Kuning Kunyit)*\nAuramu membawa kenyamanan dan rasa kantuk bagi orang sekitar. Kehadiranmu membuat orang lain merasa tenang, kenyang, dan ingin rebahan.'],
  [15, 18, '🌇 *Aura Senja (Oranye Galau)*\nKamu itu estetik tapi rapuh. Auramu cocok untuk jadi latar belakang story Instagram dengan lagu indie. Terlihat indah, padahal lagi mikirin cicilan.'],
  [19, 23, '🧠 *Aura Overthinking (Ungu Gelap)*\nDi jam ini, auramu memancarkan gelombang kecemasan. Kepalamu berisi 100 tab browser yang isinya skenario terburuk dan kenangan memalukan dari 5 tahun lalu.']
];
function cekaura(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new UsageError('❌ Masukkan jam lahirmu dengan format HH:MM.\nContoh: *.cekaura 15:30*');
  const a = AURA.find(([lo, hi]) => Number(m[1]) >= lo && Number(m[1]) <= hi)[2];
  return `✨ *Penerawangan Aura Gaib*\n\n*Jam Lahir:* ${t.trim()}\n\n${a}`;
}
function nasibbatere(t) {
  const p = Number(String(t).trim());
  if (!/^\d{1,3}$/.test(String(t).trim()) || p > 100) throw new UsageError('❌ Masukkan persentase baterai HP kamu (0-100).\nContoh: *.nasibbatere 69*');
  const n = p === 100 ? 'Penuh energi untuk overthinking sepanjang hari. Keuangan aman, tapi hati rawan.'
    : p >= 80 ? 'Hari ini kamu bersinar! Semua rencanamu berjalan lancar, tapi jangan lupa balas chat ibumu.'
      : p >= 60 ? 'Cukup stabil. Kamu akan melalui hari ini tanpa drama besar, paling hanya kesandung kabel charger sendiri.'
        : p >= 40 ? 'Mulai waspada. Ada potensi pengeluaran tak terduga. Jangan buka Shopee hari ini!'
          : p >= 20 ? 'Hidupmu lagi di ujung tanduk, sama seperti baterai HP-mu. Jauhi perdebatan dan orang yang suka minta hotspot.'
            : p > 0 ? 'Kondisi kritis! Keberuntunganmu setipis sisa bateraimu. Segera cari colokan dan pertolongan ilahi.'
              : 'Game over. Hari ini kamu resmi jadi beban peradaban. Semoga ada yang berbaik hati minjemin power bank.';
  return `🔋 *Ramalan Nasib Baterai*\n\n*Sisa Baterai:* ${p}%\n*Prediksi Nasib:* ${n}`;
}
function cekbeban(name, persen = crypto.randomInt(0, 101)) {
  const k = persen > 90 ? `Level Beban: *BEBAN INTERNASIONAL* 🌍\n\nKeberadaan ${name} adalah alasan kenapa orang tuanya sering ikut seminar "sabar itu indah". Kontribusi lo di rumah cuma nambah tagihan listrik sama cucian kotor.`
    : persen > 70 ? `Level Beban: *PENGANGGURAN ESTETIK* 🚬\n\n${name} kerjaannya rebahan, ngeluh, terus minta duit. Lo bukan pengangguran, lo adalah "seniman gaya hidup pasif". Circle lo udah capek dengerin keluhan lo.`
      : persen > 40 ? `Level Beban: *ANGGOTA PASIF* 😴\n\nDi grup, ${name} cuma jadi 'sider'. Diajak nongkrong banyak alasan. Dimintain tolong, read doang. Kontribusi lo setara dengan 'R' di chat grup.`
        : `Level Beban: *ASET BERHARGA* 💪\n\nLuar biasa! ${name} adalah orang yang diandalkan. Lo mandiri, rajin, dan sering jadi tempat curhat. Teruslah menjadi inspirasi!`;
  const bar = '█'.repeat(Math.max(1, Math.round(persen / 10))).padEnd(10, '▒');
  return `BEBAN METER\n${bar}  ${persen}%\n${k}`;
}
function jodohmakanan(t) {
  const q = String(t).toLowerCase();
  const hit = Object.entries(DATA.jodohmakanan).find(([k]) => q.includes(k));
  return `❤️‍🔥 *Ramalan Jodoh dari Makanan Favorit*\n\n*Makananmu:* ${t}\n*Tipe Jodohmu:* ${hit ? hit[1] : 'Jodohmu itu orang yang fleksibel, bisa makan apa aja yang penting gratisan.'}`;
}
function planet(t) {
  const alias = { merkurius: 'mercury', bumi: 'earth', yupiter: 'jupiter', saturnus: 'saturn', neptunus: 'neptune' };
  const k = String(t).toLowerCase().trim(); const p = DATA.planet[alias[k] || k];
  if (!p) throw new UsageError(`❌ Planet "${t}" tidak ditemukan!\n\nPilih: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune`);
  return `🪐 *INFO PLANET: ${p.name}*\n\n📖 Deskripsi: ${p.desc}\n🌍 Radius: ${p.radius}\n☀️ Jarak dari Matahari: ${p.distance}\n⏳ Lama 1 hari: ${p.day}\n🌀 Lama 1 tahun: ${p.year}`;
}
function niatsholat(t) {
  const alias = { shubuh: 'subuh', zuhur: 'dzuhur', duhur: 'dzuhur', isya: 'isha', asar: 'ashar', magrib: 'maghrib' };
  const k = String(t).toLowerCase().trim(); const d = DATA.niatsholat.find(x => x.solat === (alias[k] || k));
  if (!d) throw new UsageError('List sholat 5 waktu:\n• Subuh\n• Dzuhur\n• Ashar\n• Maghrib\n• Isha\n\nContoh: .niatsholat subuh');
  return `_*Niat Sholat ${d.solat}*_\n*Arab :* ${d.arabic}\n*Latin :* ${d.latin}\n*Terjemahan :* ${d.translation_id}`;
}

// ----------------------------------------------------------------- tembak & jadian
const proposals = new Map();   // target -> { from, chat, at }
const coupleOf = (ctx, jid) => (ctx.db.raw().couples || {})[jid] || null;

module.exports = { F, pick, fill, cekaura, nasibbatere, cekbeban, jodohmakanan, planet, niatsholat, proposals, coupleOf };
