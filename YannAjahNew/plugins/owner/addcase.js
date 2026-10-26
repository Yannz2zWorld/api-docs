'use strict';
// ----------------------------------------------------------------- custom command (pengganti addcase V15 yang menulis source code)
const { UsageError } = require('../../library/errors');
const { O, captureResponse, obj } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.addcase', name: 'addcase', aliases: ['addcmd'], description: 'Buat command teks/media sendiri: reply pesan + .addcase <nama>, atau .addcase <nama>|<balasan>', usage: '<nama>|<balasan>',
  async run(ctx) {
    const [n, ...rest] = ctx.requireText().split('|'); const name = n.trim().toLowerCase();
    if (!/^[a-z0-9_-]{2,30}$/.test(name)) throw new UsageError('Nama command 2-30 huruf/angka.');
    if (ctx.yannajah.registry.resolve(name)) throw new UsageError(`Command *${name}* sudah dipakai fitur bot.`);
    const c = obj(ctx.db.raw(), 'customCommands');
    c[name] = rest.length ? { text: rest.join('|').trim().slice(0, 4000), media: null } : await captureResponse(ctx);
    ctx.db.touch(); await ctx.reply(`✅ Command *${ctx.prefix}${name}* dibuat.`);
  } });
