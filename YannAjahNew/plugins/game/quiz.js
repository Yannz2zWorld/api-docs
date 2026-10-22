'use strict';
// Game tebak-tebakan dari dataset Yann AI V15 (data/game/*.json). Jawab dengan membalas teks biasa.
// Hadiah: exp + saldo. .hint untuk petunjuk (mengurangi hadiah), .nyerah untuk menyerah.
const path = require('path');
const crypto = require('crypto');
const { feature } = require('../../library/plugin-kit');
const games = require('../../library/games');
const { UsageError } = require('../../library/errors');

const DATA = path.join(__dirname, '..', '..', 'data', 'game');
const cache = {};
const load = name => (cache[name] = cache[name] || require(path.join(DATA, `${name}.json`)));
const pick = list => list[crypto.randomInt(0, list.length)];

// name: [file, deskripsi, pemetaan item -> { question, image?, audio?, answer, info? }]
const QUIZ = {
  asahotak: ['asahotak', 'Asah otak: jawab pertanyaan pengetahuan umum', x => ({ question: x.soal, answer: x.jawaban })],
  caklontong: ['caklontong', 'Teka-teki nyeleneh ala Cak Lontong', x => ({ question: x.soal, answer: x.jawaban, info: x.deskripsi })],
  lengkapikalimat: ['lengkapikalimat', 'Lengkapi peribahasa/kalimat yang rumpang', x => ({ question: x.soal, answer: x.jawaban })],
  siapakahaku: ['siapakahaku', 'Siapakah aku? Tebak dari ciri-cirinya', x => ({ question: x.soal, answer: x.jawaban })],
  susunkata: ['susunkata', 'Susun huruf acak menjadi kata', x => ({ question: `${x.soal}\nKategori: ${x.tipe}`, answer: x.jawaban })],
  tebakhewan: ['tebakhewan', 'Tebak nama hewan dari ciri-cirinya', x => ({ question: x.soal, answer: x.jawaban })],
  tebakkata: ['tebakkata', 'Tebak kata dari petunjuk-petunjuk', x => ({ question: x.soal, answer: x.jawaban })],
  tebaklirik: ['tebaklirik', 'Lengkapi lirik lagu yang hilang', x => ({ question: x.soal, answer: x.jawaban })],
  tebakgambar: ['tebakgambar', 'Tebak kata/kalimat dari gambar', x => ({ question: 'Gambar apakah ini?', image: x.img, answer: x.jawaban, info: x.deskripsi })],
  tebakbendera: ['tebakbendera', 'Tebak nama negara dari benderanya', x => ({ question: 'Bendera negara apakah ini?', image: x.img, answer: x.name })],
  tebakanime: ['tebakanime', 'Tebak nama karakter anime dari gambar', x => ({ question: 'Siapa nama karakter anime ini?', image: x.img, answer: x.jawaban })],
  tebakgame: ['tebakgame', 'Tebak judul game dari gambar', x => ({ question: 'Game apakah ini?', image: x.img, answer: x.jawaban })],
  tebakgenshin: ['tebakgenshin', 'Tebak karakter Genshin Impact', x => ({ question: 'Siapa karakter Genshin ini?', image: x.img, answer: x.jawaban })],
  tebakhero: ['tebakhero', 'Tebak hero Mobile Legends', x => ({ question: 'Hero ML siapakah ini?', image: x.img, answer: x.jawaban, info: x.deskripsi })],
  tebaklogo: ['tebaklogo', 'Tebak merek dari logonya', x => ({ question: `Merek apakah ini? (${x.deskripsi || 'logo'})`, image: x.img, answer: x.jawaban })],
  tebakmakanan: ['tebakmakanan', 'Tebak nama makanan dari gambar', x => ({ question: x.deskripsi || 'Makanan apakah ini?', image: x.img, answer: x.jawaban })],
  tebaklagu: ['tebaklagu', 'Tebak judul lagu dari cuplikan audio', x => ({ question: 'Judul lagu apakah ini?', audio: x.soal, answer: x.jawaban, info: x.artis ? `Penyanyi: ${x.artis}` : '' })]
};
const REWARD = { exp: 30, money: 300 };
const TIMEOUT = 60000;

function quizFeature(name, [file, description, map]) {
  return feature({
    id: `game.${name}`, name, category: 'game', description: `${description} (${load(file).length} soal)`, cooldown: 5, limit: 1,
    dataset: `data/game/${file}.json`,
    async run(ctx) {
      if (games.get(ctx.m.chat)) throw new UsageError('Masih ada game yang berjalan di chat ini. Jawab dulu atau ketik .nyerah');
      const q = map(pick(load(file)));
      if (!q.answer) throw new UsageError('Soal rusak, coba lagi.');
      games.start(ctx.m.chat, { type: 'quiz', name, answer: String(q.answer).trim(), info: q.info, reward: { ...REWARD } }, {
        timeoutMs: TIMEOUT,
        onTimeout: s => ctx.yannajah.sendmessage(ctx.m.chat, { text: `⌛ Waktu habis! Jawabannya: *${s.answer}*${s.info ? `\n${s.info}` : ''}` }).catch(() => {})
      });
      const caption = `🎮 *${name.toUpperCase()}*\n${q.question}\n\n⏱️ ${TIMEOUT / 1000} detik · hadiah ${REWARD.exp} exp + ${REWARD.money} saldo\nBalas dengan jawabanmu · .hint · .nyerah`;
      if (q.image) await ctx.sendFile(q.image, { caption }).catch(() => ctx.reply(`${caption}\n(gambar: ${q.image})`));
      else if (q.audio) { await ctx.reply(caption); await ctx.sendFile(q.audio).catch(() => ctx.reply('(audio soal gagal dimuat)')); }
      else await ctx.reply(caption);
    }
  });
}

// Family 100: banyak jawaban per soal.
const family100 = feature({
  id: 'game.family100', name: 'family100', category: 'game', description: `Family 100: sebutkan jawaban survei sebanyak-banyaknya (${load('family100').length} soal)`, cooldown: 5, limit: 1, dataset: 'data/game/family100.json',
  async run(ctx) {
    if (games.get(ctx.m.chat)) throw new UsageError('Masih ada game yang berjalan di chat ini.');
    const x = pick(load('family100'));
    games.start(ctx.m.chat, { type: 'family100', name: 'family100', answers: x.jawaban.map(String), found: [], reward: { exp: 10, money: 100 } }, {
      timeoutMs: 120000,
      onTimeout: s => ctx.yannajah.sendmessage(ctx.m.chat, { text: `⌛ Waktu habis!\nSemua jawaban:\n${s.answers.map((a, i) => `${i + 1}. ${a}${s.found.includes(a) ? ' ✅' : ''}`).join('\n')}` }).catch(() => {})
    });
    await ctx.reply(`🎮 *FAMILY 100*\n${x.soal}\n\nAda ${x.jawaban.length} jawaban · 120 detik · .nyerah untuk menyerah`);
  }
});

const hintCmd = feature({ id: 'game.hint', name: 'hint', aliases: ['petunjuk', 'bantuan'], category: 'game', description: 'Petunjuk untuk game tebak-tebakan yang sedang berjalan (hadiah berkurang)',
  async run(ctx) {
    const s = games.get(ctx.m.chat);
    if (!s || s.type !== 'quiz') throw new UsageError('Tidak ada game tebakan yang berjalan.');
    s.hints++; s.reward.exp = Math.max(5, Math.floor(s.reward.exp / 2)); s.reward.money = Math.max(50, Math.floor(s.reward.money / 2));
    await ctx.reply(`💡 ${games.hint(s.answer, s.hints)}`);
  } });
const giveUp = feature({ id: 'game.nyerah', name: 'nyerah', aliases: ['menyerah', 'giveup'], category: 'game', description: 'Menyerah pada game yang sedang berjalan',
  async run(ctx) {
    const s = games.stop(ctx.m.chat);
    if (!s) throw new UsageError('Tidak ada game yang berjalan.');
    if (s.type === 'family100') return ctx.reply(`🏳️ Menyerah. Jawaban:\n${s.answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`);
    await ctx.reply(`🏳️ Menyerah. Jawabannya: *${s.answer ?? s.target ?? '-'}*`);
  } });

// Hook: cek jawaban dari pesan biasa (bukan command).
const answerHook = feature({ id: 'game.answer', name: 'gamestatus', category: 'game', description: 'Status game yang sedang berjalan di chat ini',
  async run(ctx) { const s = games.get(ctx.m.chat); await ctx.reply(s ? `Game aktif: ${s.name} (${Math.round((Date.now() - s.startedAt) / 1000)} detik)` : 'Tidak ada game aktif.'); },
  async onMessage(ctx) {
    const m = ctx.m;
    if (m.isCmd || !m.body) return false;
    const s = games.get(m.chat);
    if (!s) return false;
    const u = ctx.db.user(m.sender);
    if (s.type === 'quiz') {
      const r = games.judge(s.answer, m.body);
      if (r === 'correct') {
        games.stop(m.chat);
        u.exp = (u.exp || 0) + s.reward.exp; u.money = (u.money || 0) + s.reward.money; ctx.db.touch();
        await ctx.reply(`✅ Benar! Jawabannya *${s.answer}*\n+${s.reward.exp} exp, +${s.reward.money} saldo${s.info ? `\n\n${s.info}` : ''}`);
        return true;
      }
      if (r === 'close') { await ctx.reply('🤏 Hampir benar!'); return true; }
      return false;
    }
    if (s.type === 'family100') {
      const hit = s.answers.find(a => !s.found.includes(a) && games.judge(a, m.body) === 'correct');
      if (!hit) return false;
      s.found.push(hit);
      u.exp = (u.exp || 0) + s.reward.exp; u.money = (u.money || 0) + s.reward.money; ctx.db.touch();
      const board = s.answers.map((a, i) => `${i + 1}. ${s.found.includes(a) ? a : '______'}`).join('\n');
      if (s.found.length === s.answers.length) { games.stop(m.chat); await ctx.reply(`🎉 Semua jawaban ditemukan!\n${board}`); }
      else await ctx.reply(`✅ *${hit}* benar! (+${s.reward.exp} exp)\n${board}`);
      return true;
    }
    if (typeof s.onAnswer === 'function') return s.onAnswer(ctx, m.body);
    return false;
  } });

module.exports = [...Object.entries(QUIZ).map(([n, def]) => quizFeature(n, def)), family100, hintCmd, giveUp, answerHook];
