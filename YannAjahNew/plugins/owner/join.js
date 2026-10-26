'use strict';
const { UsageError } = require('../../library/errors');
const { O, sock } = require('../../lib/owner');

module.exports = O({ id: 'owner.join', name: 'join', aliases: ['joingc', 'joingcall'], description: 'Bot masuk grup lewat link undangan', usage: '<link>',
  async run(ctx) { const m = /chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/.exec(ctx.text); if (!m) throw new UsageError('Link grup tidak valid.'); const id = await sock(ctx).groupAcceptInvite(m[1]); await ctx.reply(`✅ Bergabung ke grup ${id || ''}`); } });
