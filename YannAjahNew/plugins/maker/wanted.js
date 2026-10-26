'use strict';
const { feature } = require('../../library/plugin-kit');
const { targetJid } = require('../../library/targets');
const { photoOf, wantedPoster } = require('../../lib/memecanvas');

module.exports = feature({ id: 'maker.wanted', name: 'wanted', aliases: ['buronan', 'posterwanted'], category: 'maker', description: 'Poster WANTED dari foto (kirim/reply foto, atau tag orang): .wanted [nama]|[hadiah]', usage: '[nama]|[hadiah]', cooldown: 5, limit: 1,
  async run(ctx) {
    const jid = targetJid(ctx, { self: true });
    const [nama, hadiah] = String(ctx.text || '').replace(/@\d+/g, '').split('|').map(s => s.trim());
    const name = (nama || ctx.db.get(['users', jid])?.name || (jid === ctx.m.sender ? ctx.m.pushName : '') || 'BURONAN').slice(0, 30);
    const reward = (hadiah || `Rp ${1 + (name.length * 7919) % 99}.000.000`).slice(0, 24);
    const buf = await wantedPoster({ photo: await photoOf(ctx, jid), name, reward });
    await ctx.sendFile({ buffer: buf, mime: 'image/png' }, { caption: `🤠 WANTED: ${name}` });
  } });
