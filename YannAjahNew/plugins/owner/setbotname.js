'use strict';
const { UsageError } = require('../../library/errors');
const { O, sock } = require('../../lib/owner');

module.exports = O({ id: 'owner.setbotname', name: 'setbotname', description: 'Ganti nama profil WhatsApp bot', usage: '<nama>', async run(ctx) { const t = ctx.requireText(); if (t.length > 25) throw new UsageError('Nama maks 25 karakter.'); await sock(ctx).updateProfileName(t); await ctx.reply('✅ Nama profil diganti.'); } });
