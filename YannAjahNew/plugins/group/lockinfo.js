'use strict';
const { UsageError } = require('../../library/errors');
const { G, sock } = require('../../lib/group');

module.exports = G({ id: 'group.lockinfo', name: 'lockinfo', description: 'Kunci info grup (hanya admin yang bisa ubah info)', usage: 'on/off', permission: 'admin', botAdmin: true,
  async run(ctx) { const v = ctx.args[0]; if (!['on', 'off'].includes(v)) throw new UsageError(ctx.usage()); await sock(ctx).groupSettingUpdate(ctx.m.chat, v === 'on' ? 'locked' : 'unlocked'); await ctx.reply(`✅ Info grup ${v === 'on' ? 'dikunci' : 'dibuka'}.`); } });
