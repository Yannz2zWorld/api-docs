'use strict';
// Fitur hiburan. Fitur "cek" (V15: cekganteng, cekkaya, ...) memberi persentase yang konsisten per
// orang per hari (hash, bukan acak setiap kali) — jelas sebagai hiburan, bukan penilaian sungguhan.
const crypto = require('crypto');
const { feature, textTool } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const { jidUser } = require('../library/function');

const daily = (...parts) => crypto.createHash('sha256').update([...parts, new Date().toISOString().slice(0, 10)].join('|')).digest().readUInt32BE(0);
const pick = arr => arr[crypto.randomInt(0, arr.length)];

const CEK = {
  cekganteng: 'Ganteng', cekcantik: 'Cantik', cekkaya: 'Kaya', cekjones: 'Jomblo', cekbucin: 'Bucin', cekstress: 'Stress', cekwibu: 'Wibu',
  cekpintar: 'Pintar', cekmalas: 'Malas', ceklucu: 'Lucu', cekbaik: 'Baik hati', ceksabar: 'Sabar', cekgalau: 'Galau', cekhoki: 'Hoki hari ini', cekkeren: 'Keren', ceksial: 'Sial hari ini'
};
const KODAM = ['Macan Putih', 'Naga Emas', 'Burung Garuda', 'Kucing Oren', 'Ular Kobra', 'Harimau Sumatra', 'Elang Jawa', 'Kura-kura Ninja', 'Banteng Merah', 'Kosong (belum terisi)', 'Ayam Jago', 'Lumba-lumba', 'Rusa Emas', 'Singa Hitam'];
const JAWAB = ['Iya', 'Tidak', 'Mungkin', 'Bisa jadi', 'Tentu saja', 'Jangan berharap', 'Coba tanya lagi nanti', 'Pasti', 'Sepertinya tidak', 'Aku rasa iya'];
const KAPAN = ['besok', 'lusa', 'minggu depan', 'bulan depan', 'tahun depan', '2 jam lagi', 'nanti malam', 'tidak akan pernah', '5 tahun lagi', 'sebentar lagi'];
const QUOTES = ['Kesuksesan adalah jumlah dari usaha kecil yang diulang setiap hari.', 'Jangan menunggu kesempatan, ciptakan kesempatan itu.', 'Belajar dari kemarin, hidup untuk hari ini, berharap untuk besok.', 'Kegagalan adalah bumbu yang memberi rasa pada kesuksesan.', 'Hal besar dimulai dari langkah kecil.', 'Fokus pada kemajuan, bukan kesempurnaan.', 'Disiplin adalah jembatan antara tujuan dan pencapaian.', 'Orang yang berhenti belajar akan menjadi pemilik masa lalu.', 'Kerja keras mengalahkan bakat ketika bakat tidak bekerja keras.', 'Jangan bandingkan bab satumu dengan bab dua puluh orang lain.'];
const PANTUN = ['Jalan-jalan ke kota Blitar,\nJangan lupa membeli roti.\nRajin belajar supaya pintar,\nBiar ilmu dibawa sampai mati.', 'Pergi ke pasar membeli tomat,\nTomat dibeli di pagi hari.\nHidup ini harus hemat,\nAgar tak susah di kemudian hari.', 'Buah mangga buah kedondong,\nDimakan enak di siang hari.\nJangan suka berbohong,\nNanti dijauhi teman sendiri.', 'Ikan hiu makan tomat,\nSudah cukup jangan ditambah.\nBelajar terus jangan malas,\nAgar cita-cita tercapai sudah.'];

const target = ctx => ctx.m.mentionedJid?.[0] || ctx.m.quoted?.sender || ctx.m.sender;

// Satu command "cek" per kunci CEK (plugins/fun/<nama>.js).
function cek(name) {
  const label = CEK[name];
  if (!label) throw new Error(`Cek '${name}' tidak ada`);
  return feature({
    id: `fun.${name}`, name, category: 'fun', description: `Seberapa ${label.toLowerCase()} kamu hari ini? (hiburan)`, usage: '[@user]',
    async run(ctx) { const t = target(ctx); const p = daily(name, t) % 101; await ctx.yannajah.sendmessage(ctx.m.chat, { text: `✨ ${label} @${jidUser(t)}: *${p}%*\n${'█'.repeat(Math.round(p / 10))}${'░'.repeat(10 - Math.round(p / 10))}`, mentions: [t] }, { quoted: ctx.m.raw }); }
  });
}

module.exports = { daily, pick, KODAM, JAWAB, KAPAN, QUOTES, PANTUN, cek };
