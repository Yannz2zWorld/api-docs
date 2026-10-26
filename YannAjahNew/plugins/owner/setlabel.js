'use strict';
const { UsageError } = require('../../library/errors');
const { O, sock } = require('../../lib/group-admin');

module.exports = O({ id: 'owner.setlabel', name: 'setlabel', description: 'Atur label member bot di grup: .setlabel <id grup|all>|<label maks 30>', usage: '<idgc|all>|<label>',
  async run(ctx) {
    const [target, label] = ctx.requireText().split('|').map(x => x?.trim());
    if (!target || !label || label.length > 30) throw new UsageError(`Format: ${ctx.prefix}setlabel all|Bot Resmi (label maks 30 karakter)`);
    const all = Object.keys(await sock(ctx).groupFetchAllParticipating());
    const ids = target.toLowerCase() === 'all' ? all : [target.endsWith('@g.us') ? target : `${target}@g.us`];
    if (!ids.every(j => all.includes(j))) throw new UsageError('❌ Bot tidak berada di grup itu.');
    let ok = 0;
    for (const j of ids.slice(0, 200)) {
      await sock(ctx).relayMessage(j, { protocolMessage: { type: 30, memberLabel: { label } } }, { additionalNodes: [{ tag: 'meta', attrs: { tag_reason: 'user_update', appdata: 'member_tag' } }] }).then(() => ok++).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    }
    await ctx.reply(`✅ Label diset di ${ok}/${ids.length} grup.`);
  } });
