'use strict';
// Fitur user (V15: daftar, unreg, limit, claim, afk, profil, premium).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { jidUser } = require('../../library/function');

const today = () => new Date().toISOString().slice(0, 10);

module.exports = [
  feature({ id: 'user.daftar', name: 'daftar', aliases: ['register', 'reg'], category: 'user', description: 'Daftar sebagai user bot: .daftar nama,umur', usage: '<nama>,<umur>', noRegister: true,
    tests: [{ input: 'Budi,20', expect: /Pendaftaran berhasil/ }, { input: 'Bo,200', expect: /Umur harus/ }],
    async run(ctx) {
      if (ctx.user.registered) return ctx.reply(`Kamu sudah terdaftar sebagai *${ctx.user.name}*. Ketik ${ctx.prefix}unreg untuk menghapus.`);
      const m = /^\s*([^,]{2,30}),\s*(\d{1,3})\s*$/.exec(ctx.text);
      if (!m) throw new UsageError(`Format: ${ctx.prefix}daftar nama,umur`);
      const age = Number(m[2]);
      if (age < 5 || age > 100) throw new UsageError('Umur harus 5-100.');
      Object.assign(ctx.user, { registered: true, name: m[1].trim(), age, registeredAt: Date.now() });
      ctx.db.touch();
      await ctx.reply(`✅ Pendaftaran berhasil!\nNama: ${ctx.user.name}\nUmur: ${age}`);
    } }),
  feature({ id: 'user.unreg', name: 'unreg', category: 'user', description: 'Hapus data pendaftaran kamu',
    async run(ctx) {
      if (!ctx.user.registered) return ctx.reply('Kamu belum terdaftar.');
      Object.assign(ctx.user, { registered: false, name: '', age: null });
      ctx.db.touch();
      await ctx.reply('✅ Data pendaftaran dihapus.');
    } }),
  feature({ id: 'user.profile', name: 'profile', aliases: ['profil', 'me', 'myprofile'], category: 'user', description: 'Profil kamu: limit, premium, level, saldo',
    async run(ctx) {
      const u = ctx.user;
      await ctx.reply([`👤 *${u.name || ctx.m.pushName}*`, `Nomor: ${jidUser(ctx.m.sender)}`, `Terdaftar: ${u.registered ? 'ya' : 'tidak'}`, `Premium: ${ctx.isPremium ? (ctx.isOwner ? 'owner' : `sampai ${new Date(u.premiumUntil).toLocaleDateString('id-ID')}`) : 'tidak'}`, `Limit hari ini: ${ctx.isPremium ? '∞' : u.limit}`, `Level: ${u.level || 0} (${u.exp || 0} exp)`, `Saldo: ${(u.money || 0).toLocaleString('id-ID')}`, `Peringatan: ${u.warn || 0}`].join('\n'));
    } }),
  feature({ id: 'user.limit', name: 'limit', aliases: ['ceklimit'], category: 'user', description: 'Sisa limit harian',
    async run(ctx) { await ctx.reply(ctx.isPremium ? '♾️ Limit kamu tidak terbatas (premium).' : `Sisa limit hari ini: *${ctx.user.limit}* (reset tiap hari)`); } }),
  feature({ id: 'user.claim', name: 'claim', aliases: ['daily'], category: 'user', description: 'Klaim bonus harian: +5 limit, +500 saldo, +50 exp (sekali per hari)',
    tests: [{ input: '', expect: /Bonus harian/ }],
    async run(ctx) {
      const u = ctx.user;
      if (u.lastClaim === today()) return ctx.reply('Bonus hari ini sudah diklaim. Coba lagi besok ya.');
      u.lastClaim = today(); u.limit += 5; u.money = (u.money || 0) + 500; u.exp = (u.exp || 0) + 50;
      ctx.db.touch();
      await ctx.reply('🎁 Bonus harian: +5 limit, +500 saldo, +50 exp');
    } }),
  feature({ id: 'user.afk', name: 'afk', category: 'user', description: 'Set status AFK; yang menyebut kamu akan diberi tahu', usage: '[alasan]',
    async run(ctx) {
      ctx.user.afk = { since: Date.now(), reason: (ctx.text || 'tanpa alasan').slice(0, 200) };
      ctx.db.touch();
      await ctx.reply(`💤 Kamu sekarang AFK: ${ctx.user.afk.reason}`);
    },
    // Hook: keluar dari AFK saat mengirim pesan; beri tahu yang menyebut user AFK.
    async onMessage(ctx) {
      const m = ctx.m;
      if (m.isCmd && m.command === 'afk') return false;
      const me = ctx.db.get(`users.${m.sender}`);
      if (me?.afk) {
        const mins = Math.round((Date.now() - me.afk.since) / 60000);
        me.afk = null; ctx.db.touch();
        await ctx.reply(`👋 Selamat datang kembali! Kamu AFK selama ${mins} menit.`);
      }
      const targets = [...(m.mentionedJid || []), m.quoted?.sender].filter(Boolean);
      for (const jid of new Set(targets)) {
        const u = ctx.db.get(`users.${jid}`);
        if (u?.afk) await ctx.reply(`💤 @${jidUser(jid)} sedang AFK (${Math.round((Date.now() - u.afk.since) / 60000)} menit): ${u.afk.reason}`);
      }
      return false;
    } }),
  feature({ id: 'user.premium', name: 'cekprem', aliases: ['premium'], category: 'user', description: 'Cek status premium',
    async run(ctx) {
      if (ctx.isOwner) return ctx.reply('👑 Owner: semua fitur tanpa batas.');
      await ctx.reply(ctx.isPremium ? `💎 Premium aktif sampai ${new Date(ctx.user.premiumUntil).toLocaleString('id-ID')}` : `Kamu belum premium. Harga premium: Rp${ctx.config.harga.prem}. Hubungi owner: ${ctx.config.links.owner}`);
    } }),
  feature({ id: 'user.level', name: 'level', aliases: ['mylevel', 'exp'], category: 'user', description: 'Naik level berdasarkan exp (exp didapat dari claim & game)',
    async run(ctx) {
      const u = ctx.user;
      const need = lvl => 100 * (lvl + 1) * (lvl + 1);
      let up = 0;
      while ((u.exp || 0) >= need(u.level || 0)) { u.level = (u.level || 0) + 1; up++; }
      if (up) ctx.db.touch();
      await ctx.reply(`${up ? `🎉 Naik ${up} level!\n` : ''}Level: *${u.level || 0}*\nExp: ${u.exp || 0}/${need(u.level || 0)}`);
    } })
];
