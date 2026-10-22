'use strict';
// Fitur hiburan. Fitur "cek" (V15: cekganteng, cekkaya, ...) memberi persentase yang konsisten per
// orang per hari (hash, bukan acak setiap kali) — jelas sebagai hiburan, bukan penilaian sungguhan.
const crypto = require('crypto');
const { feature, textTool } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { jidUser } = require('../../library/function');

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

module.exports = [
  ...Object.entries(CEK).map(([name, label]) => feature({
    id: `fun.${name}`, name, category: 'fun', description: `Seberapa ${label.toLowerCase()} kamu hari ini? (hiburan)`, usage: '[@user]',
    async run(ctx) { const t = target(ctx); const p = daily(name, t) % 101; await ctx.yannajah.sendmessage(ctx.m.chat, { text: `✨ ${label} @${jidUser(t)}: *${p}%*\n${'█'.repeat(Math.round(p / 10))}${'░'.repeat(10 - Math.round(p / 10))}`, mentions: [t] }, { quoted: ctx.m.raw }); }
  })),
  feature({ id: 'fun.cekkodam', name: 'cekkodam', category: 'fun', description: 'Cek "khodam" kamu hari ini (hiburan)', usage: '[nama]',
    async run(ctx) { const n = ctx.text || ctx.m.pushName; await ctx.reply(`🔮 Khodam *${n}* hari ini: *${KODAM[daily('kodam', n.toLowerCase()) % KODAM.length]}*`); } }),
  textTool({ id: 'fun.apakah', name: 'apakah', category: 'fun', description: 'Tanya jawab ya/tidak acak (hiburan)', usage: '<pertanyaan>', fn: t => `❓ Apakah ${t}\n💬 ${pick(JAWAB)}`, tests: [{ input: 'aku ganteng', expect: /^❓ Apakah aku ganteng\n💬 .+/ }], aliases: ['bisakah'] }),
  textTool({ id: 'fun.kapan', name: 'kapan', aliases: ['kapankah'], category: 'fun', description: 'Kapan sesuatu terjadi? (hiburan)', usage: '<pertanyaan>', fn: t => `❓ Kapan ${t}\n💬 ${pick(KAPAN)}`, tests: [{ input: 'aku kaya', expect: /^❓ Kapan aku kaya\n💬 .+/ }] }),
  textTool({ id: 'fun.berapa', name: 'berapa', category: 'fun', description: 'Berapa ...? jawaban angka acak (hiburan)', usage: '<pertanyaan>', fn: t => `❓ Berapa ${t}\n💬 ${crypto.randomInt(0, 101)}`, tests: [{ input: 'umurku', expect: /^❓ Berapa umurku\n💬 \d+$/ }] }),
  textTool({ id: 'fun.pilih', name: 'pilih', aliases: ['choose'], category: 'fun', description: 'Pilihkan satu opsi: .pilih nasi|mie|roti', usage: '<a>|<b>|...', fn: t => { const o = t.split('|').map(s => s.trim()).filter(Boolean); if (o.length < 2) throw new UsageError('Minimal 2 pilihan dipisah |'); return `🤔 Aku pilih: *${pick(o)}*`; }, tests: [{ input: 'a|b', expect: /^🤔 Aku pilih: \*(a|b)\*$/ }] }),
  textTool({ id: 'fun.ship', name: 'ship', aliases: ['jodoh', 'cocok'], category: 'fun', description: 'Persentase kecocokan dua nama (hiburan, hasil konsisten)', usage: '<nama1>|<nama2>', fn: t => { const [a, b] = t.split('|').map(s => s && s.trim()); if (!a || !b) throw new UsageError('Format: nama1|nama2'); const p = crypto.createHash('md5').update([a.toLowerCase(), b.toLowerCase()].sort().join('+')).digest().readUInt16BE(0) % 101; return `💞 ${a} × ${b}: *${p}%*\n${p > 80 ? 'Jodoh banget!' : p > 50 ? 'Lumayan cocok' : p > 25 ? 'Perlu usaha' : 'Mending temenan aja'}`; }, tests: [{ input: 'Budi|Ani', expect: o => /^💞 Budi × Ani: \*\d+%\*/.test(o) }, { input: 'Ani|Budi', expect: o => o.includes('%') }] }),
  feature({ id: 'fun.siapa', name: 'siapa', aliases: ['siapakah'], category: 'fun', scope: 'group', description: 'Pilih anggota grup secara acak untuk sebuah pertanyaan', usage: '<pertanyaan>',
    async run(ctx) { const md = ctx.m.groupMetadata; if (!md) throw new UsageError('Data grup belum tersedia.'); const p = pick(md.participants); const j = p.phoneNumber || p.id; await ctx.yannajah.sendmessage(ctx.m.chat, { text: `❓ Siapa ${ctx.requireText()}\n💬 @${jidUser(j)}`, mentions: [j] }, { quoted: ctx.m.raw }); } }),
  feature({ id: 'fun.pasangan', name: 'pasangan', aliases: ['jadian'], category: 'fun', scope: 'group', description: 'Pasangkan dua anggota grup secara acak (hiburan)',
    async run(ctx) { const md = ctx.m.groupMetadata; if (!md || md.participants.length < 2) throw new UsageError('Anggota kurang.'); const i = crypto.randomInt(0, md.participants.length); let k = crypto.randomInt(0, md.participants.length - 1); if (k >= i) k++; const a = md.participants[i].phoneNumber || md.participants[i].id, b = md.participants[k].phoneNumber || md.participants[k].id; await ctx.yannajah.sendmessage(ctx.m.chat, { text: `💘 @${jidUser(a)} ❤️ @${jidUser(b)}`, mentions: [a, b] }); } }),
  feature({ id: 'fun.quotes', name: 'motivasi', aliases: ['quotesmotivasi'], category: 'fun', description: 'Kata-kata motivasi acak', pure: () => `💬 ${pick(QUOTES)}`, tests: [{ input: '', expect: /^💬 .+/ }], async run(ctx) { await ctx.reply(this.pure()); } }),
  feature({ id: 'fun.pantun', name: 'pantun', category: 'fun', description: 'Pantun acak', pure: () => pick(PANTUN), tests: [{ input: '', expect: o => o.split('\n').length === 4 }], async run(ctx) { await ctx.reply(this.pure()); } }),
  feature({ id: 'fun.8ball', name: '8ball', aliases: ['magicball'], category: 'fun', description: 'Bola ajaib 8 menjawab pertanyaanmu', usage: '<pertanyaan>', pure: t => { if (!String(t || '').trim()) throw new UsageError('Tanyakan sesuatu.'); return `🎱 ${pick(JAWAB)}`; }, tests: [{ input: 'lulus?', expect: /^🎱 / }], async run(ctx) { await ctx.reply(this.pure(ctx.text)); } }),
  feature({ id: 'fun.rate', name: 'rate', aliases: ['nilai'], category: 'fun', description: 'Beri nilai 1-10 untuk apa saja (konsisten per hari)', usage: '<sesuatu>', pure: t => { if (!String(t || '').trim()) throw new UsageError('Apa yang mau dinilai?'); return `⭐ ${t}: *${daily('rate', String(t).toLowerCase()) % 10 + 1}/10*`; }, tests: [{ input: 'nasi goreng', expect: /^⭐ nasi goreng: \*\d+\/10\*$/ }], async run(ctx) { await ctx.reply(this.pure(ctx.text)); } })
];
