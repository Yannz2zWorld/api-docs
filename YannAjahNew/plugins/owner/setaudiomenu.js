'use strict';
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { O } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.setaudiomenu', name: 'setaudiomenu', description: 'Audio yang dikirim setelah .menu: reply audio + .setaudiomenu (atau .setaudiomenu off)',
  async run(ctx) {
    const st = ctx.db.settings(); const old = st.menuAudio?.name;
    if ((ctx.args[0] || '').toLowerCase() === 'off') { st.menuAudio = null; ctx.db.touch(); media.release(old, ctx.db); return ctx.reply('✅ Audio menu dimatikan.'); }
    const md = await media.fromMessage(ctx, { kinds: ['audio'] }); if (!md) throw new UsageError(`❌ Reply audio dengan caption: ${ctx.prefix}setaudiomenu`);
    st.menuAudio = md; ctx.db.touch(); media.release(old, ctx.db); await ctx.reply('✅ Audio menu diganti.');
  } });
