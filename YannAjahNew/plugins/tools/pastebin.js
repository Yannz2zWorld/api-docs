'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { getText } = require('../../lib/webjson');

module.exports = feature({ id: 'tools.pastebin', name: 'pastebin', aliases: ['getpastebin'], category: 'tools', description: 'Ambil isi teks dari link Pastebin', usage: '<link/ID pastebin>', cooldown: 5, limit: 1,
  async run(ctx) {
    const id = (/(?:pastebin\.com\/(?:raw\/)?)?([A-Za-z0-9]{8})\b/.exec((ctx.text || ctx.m.quoted?.text || '').trim()) || [])[1];
    if (!id) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} https://pastebin.com/AbCd1234`);
    const text = await getText(`https://pastebin.com/raw/${id}`, { maxBytes: 512 * 1024 });
    if (text.length > 60000) return ctx.sendFile({ buffer: Buffer.from(text), mime: 'text/plain' }, { asDocument: true, fileName: `pastebin-${id}.txt`, caption: `📋 pastebin.com/${id}` });
    await ctx.reply(`📋 *pastebin.com/${id}*\n\n${text}`);
  } });
