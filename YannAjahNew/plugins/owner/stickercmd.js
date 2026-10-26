'use strict';
// Stiker jadi pemicu command (V15: .stikercmd / .delstikercmd). Owner reply stiker + .stikercmd .menu
// -> tiap kali ada yang kirim stiker itu, bot menjalankan command tsb. Disimpan per hash stiker.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

const shaOf = msg => { const s = msg?.stickerMessage; const h = s?.fileSha256; return h ? Buffer.from(h).toString('hex') : null; };
const mapOf = ctx => { const s = ctx.db.settings(); s.stickerCommands = s.stickerCommands || {}; return s.stickerCommands; };

module.exports = [
  feature({
    id: 'owner.stikercmd', name: 'stikercmd', category: 'owner', permission: 'owner', cooldown: 2,
    description: 'Jadikan stiker (reply) sebagai pemicu command', usage: '<command> (reply stiker)',
    async run(ctx) {
      const hash = shaOf(ctx.m.quoted?.message);
      if (!hash) throw new UsageError('Reply stiker yang mau dijadikan command.');
      const cmd = (ctx.text || '').trim();
      if (!cmd) throw new UsageError('Contoh: .stikercmd .menu (sambil reply stiker)');
      mapOf(ctx)[hash] = cmd.startsWith(ctx.config.prefix.list[0]) ? cmd : ctx.config.prefix.list[0] + cmd.replace(/^[./!#]/, '');
      ctx.db.touch();
      await ctx.reply(`✅ Stiker diset sebagai command: *${mapOf(ctx)[hash]}*`);
    }
  }),
  feature({
    id: 'owner.delstikercmd', name: 'delstikercmd', category: 'owner', permission: 'owner', cooldown: 2,
    description: 'Hapus command dari stiker (reply stiker)',
    async run(ctx) {
      const hash = shaOf(ctx.m.quoted?.message);
      const map = mapOf(ctx);
      if (!hash || !map[hash]) throw new UsageError('Stiker ini belum dijadikan command.');
      const was = map[hash]; delete map[hash]; ctx.db.touch();
      await ctx.reply(`✅ Command stiker *${was}* dihapus.`);
    }
  }),
  // Hook: kalau pesan stiker cocok dengan yang terdaftar, jadikan pesan itu command tsb (router lanjut mengeksekusi).
  feature({
    id: 'owner.stikercmd.hook', name: 'liststikercmd', aliases: ['stikercmdlist'], category: 'owner', permission: 'owner',
    description: 'Daftar stiker yang jadi command + jalankan command dari stiker terdaftar',
    async run(ctx) { const map = mapOf(ctx); const keys = Object.keys(map); await ctx.reply(keys.length ? `📋 ${keys.length} stiker-command:\n` + keys.map((h, i) => `${i + 1}. ${map[h]} (${h.slice(0, 10)}…)`).join('\n') : 'Belum ada stiker yang dijadikan command.'); },
    async onMessage(ctx) {
      const m = ctx.m;
      if (m.isCmd || m.type !== 'stickerMessage') return false;
      const cmd = mapOf(ctx)[shaOf(m.message)];
      if (!cmd) return false;
      const prefix = ctx.config.prefix.list.find(p => cmd.startsWith(p)) || ctx.config.prefix.list[0];
      const rest = cmd.slice(prefix.length).trim();
      const [command, ...args] = rest.split(/\s+/);
      Object.assign(m, { isCmd: true, prefix, command: command.toLowerCase(), args, text: rest.slice(command.length).trim(), body: cmd });
      return false;   // lanjut ke router untuk eksekusi command
    }
  })
];
