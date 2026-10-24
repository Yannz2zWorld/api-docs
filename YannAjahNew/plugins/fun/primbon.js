'use strict';
// Fun & primbon V15: ramalan aura/batere/beban/dompet/profesi/jodoh/masa depan, info planet,
// fakta dunia, tembak & jadian, plus konten islami ringan (niat sholat, quotes, dzikir, hadits).
// Teks diambil dari V15 (data/v15/fun.json, entri vulgar dibuang). Hasil acak memakai crypto.randomInt.
const crypto = require('crypto');
const { feature, textTool } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { targetJid, mention } = require('../../library/targets');
const DATA = require('../../data/v15/fun.json');

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

module.exports = [
  textTool({ id: 'fun.cekaura', name: 'cekaura', category: 'fun', limit: 1, usage: 'HH:MM', description: 'Penerawangan aura dari jam lahir', fn: cekaura,
    tests: [{ input: '15:30', expect: /Aura Senja/ }, { input: '03:00', expect: /Kelelawar/ }] }),
  textTool({ id: 'fun.nasibbatere', name: 'nasibbatere', category: 'fun', limit: 1, usage: '<0-100>', description: 'Ramalan nasib dari persen baterai HP', fn: nasibbatere,
    tests: [{ input: '100', expect: /overthinking/ }, { input: '50', expect: /Shopee/ }, { input: '0', expect: /Game over/ }] }),
  textTool({ id: 'fun.cekbeban', name: 'cekbeban', category: 'fun', limit: 1, usage: '<nama>', description: 'Ukur level beban seseorang (acak)', fn: t => cekbeban(t),
    tests: [{ input: 'Budi', expect: /BEBAN METER[\s\S]*Budi/ }] }),
  F({ id: 'fun.isidompet', name: 'isidompet', usage: '[nama]', description: 'Terawang isi dompet gaib',
    async run(ctx) { await ctx.reply(`💸 *Hasil Terawangan Dompet Gaib*\n\n*Nama Target:* ${ctx.text || ctx.m.pushName}\n*Isi Dompet:* ${pick(DATA.isidompet)}`); } }),
  F({ id: 'fun.profesiku', name: 'profesiku', usage: '[nama]', description: 'Ramalan profesi masa depan',
    async run(ctx) { await ctx.reply(`💼 *Ramalan Profesi Masa Depan*\n\n*Nama:* ${ctx.text || ctx.m.pushName}\n*Prediksi Profesi Anda:* *${pick(DATA.profesiku)}*\n\n_Mulai siapkan CV dari sekarang!_`); } }),
  textTool({ id: 'fun.jodohmakanan', name: 'jodohmakanan', category: 'fun', limit: 1, usage: '<makanan>', description: 'Ramalan jodoh dari makanan favorit', fn: jodohmakanan,
    tests: [{ input: 'seblak', expect: /pedes omongannya/ }, { input: 'makananlangka123', expect: /fleksibel/ }] }),
  F({ id: 'fun.cekmasadepan', name: 'cekmasadepan', usage: '<nama>', description: 'Ramalan masa depan (acak)',
    async run(ctx) { await ctx.reply(fill(pick(DATA.cekmasadepan), ctx.requireText('Contoh: .cekmasadepan Budi'))); } }),
  F({ id: 'fun.cekjodoh', name: 'cekjodoh', usage: '<nama>', description: 'Ramalan jodoh (acak)',
    async run(ctx) { await ctx.reply(fill(pick(DATA.cekjodoh), ctx.requireText('Contoh: .cekjodoh Budi'))); } }),
  textTool({ id: 'fun.planet', name: 'planet', category: 'edukasi', limit: 0, usage: '<nama planet>', description: 'Info planet tata surya', fn: planet,
    tests: [{ input: 'mars', expect: /Olympus Mons/ }, { input: 'bumi', expect: /INFO PLANET: Bumi/ }] }),
  F({ id: 'fun.faktadunia', name: 'faktadunia', category: 'edukasi', description: `Fakta dunia yang unik (${DATA.faktadunia.length} fakta)`,
    async run(ctx) { await ctx.reply(`🤯 *${ctx.config.bot.name} - Fakta Dunia*\n\n${pick(DATA.faktadunia).replace(/\*\*/g, '*')}`); } }),

  textTool({ id: 'islamic.niatsholat', name: 'niatsholat', aliases: ['niatshalat'], category: 'islamic', usage: '<subuh|dzuhur|ashar|maghrib|isha>', description: 'Niat sholat fardhu (Arab, latin, terjemahan)', fn: niatsholat,
    tests: [{ input: 'subuh', expect: /Niat Sholat subuh[\s\S]*Arab/ }, { input: 'isya', expect: /isha/ }] }),
  feature({ id: 'islamic.quotesislami', name: 'quotesislami', aliases: ['quotesislam'], category: 'islamic', description: `Kata mutiara islami (${DATA.quotesislami.length})`,
    async run(ctx) { const q = pick(DATA.quotesislami); await ctx.reply(`${q.arabic}\n${q.arti}`); } }),
  feature({ id: 'islamic.dzikir', name: 'dzikir', aliases: ['wirid'], category: 'islamic', description: 'Wirid & dzikir setelah sholat fardhu', async run(ctx) { await ctx.reply(DATA.dzikir); } }),
  feature({ id: 'islamic.hadits', name: 'hadits', aliases: ['haditsharian'], category: 'islamic', description: 'Hadits harian singkat', async run(ctx) { const h = pick(DATA.hadits); await ctx.reply(`📜 *Hadits Harian*\n\n"${h.hadits}"\n\n- (HR. ${h.rawi}) -`); } }),

  feature({ id: 'fun.tembak', name: 'tembak', category: 'fun', scope: 'group', description: 'Nyatakan perasaan ke @user (dia jawab .terimajadian / .tolakjadian dalam 5 menit)', usage: '@user',
    async run(ctx) {
      const t = targetJid(ctx);
      if (t === ctx.m.sender) throw new UsageError('❌ Masa nembak diri sendiri 😅');
      if (coupleOf(ctx, ctx.m.sender)) throw new UsageError(`❌ Kamu sudah punya pasangan (${mention(coupleOf(ctx, ctx.m.sender).partner)}).`);
      if (coupleOf(ctx, t)) throw new UsageError(`💔 ${mention(t)} sudah punya pasangan.`);
      proposals.set(t, { from: ctx.m.sender, chat: ctx.m.chat, at: Date.now() });
      await ctx.reply(`💘 ${mention(ctx.m.sender)} nembak ${mention(t)}!\n\n${mention(t)}, ketik *.terimajadian* atau *.tolakjadian* (5 menit).`);
    } }),
  feature({ id: 'fun.terimajadian', name: 'terimajadian', category: 'fun', scope: 'group', description: 'Terima tembakan', async run(ctx) {
    const p = proposals.get(ctx.m.sender);
    if (!p || Date.now() - p.at > 300000) throw new UsageError('❌ Tidak ada permintaan jadian untuk kamu!');
    proposals.delete(ctx.m.sender);
    const c = ctx.db.raw().couples = ctx.db.raw().couples || {};
    c[p.from] = { partner: ctx.m.sender, since: Date.now() }; c[ctx.m.sender] = { partner: p.from, since: Date.now() }; ctx.db.touch();
    await ctx.reply(`💞 Selamat! ${mention(p.from)} & ${mention(ctx.m.sender)} resmi jadian! 🎉`);
  } }),
  feature({ id: 'fun.tolakjadian', name: 'tolakjadian', category: 'fun', scope: 'group', description: 'Tolak tembakan', async run(ctx) {
    const p = proposals.get(ctx.m.sender); if (!p) throw new UsageError('❌ Tidak ada permintaan jadian untuk kamu!');
    proposals.delete(ctx.m.sender); await ctx.reply(`💔 ${mention(ctx.m.sender)} menolak ${mention(p.from)}. Yang sabar ya...`);
  } }),
  feature({ id: 'fun.cekpasangan', name: 'cekpasangan', aliases: ['mypasangan'], category: 'fun', description: 'Cek pasangan (kamu atau @user)', async run(ctx) {
    const j = targetJid(ctx, { self: true }); const c = coupleOf(ctx, j);
    await ctx.reply(c ? `💞 ${mention(j)} berpasangan dengan ${mention(c.partner)} sejak ${Math.floor((Date.now() - c.since) / 86400000)} hari lalu.` : `💔 ${mention(j)} masih jomblo.`);
  } }),
  feature({ id: 'fun.putus', name: 'putus', category: 'fun', description: 'Putus dengan pasangan', async run(ctx) {
    const c = coupleOf(ctx, ctx.m.sender); if (!c) throw new UsageError('Kamu belum punya pasangan.');
    delete ctx.db.raw().couples[ctx.m.sender]; delete ctx.db.raw().couples[c.partner]; ctx.db.touch();
    await ctx.reply(`💔 ${mention(ctx.m.sender)} dan ${mention(c.partner)} resmi putus.`);
  } })
];
module.exports._internal = { cekbeban };
