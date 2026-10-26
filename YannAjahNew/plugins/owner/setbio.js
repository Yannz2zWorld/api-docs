'use strict';
const { UsageError } = require('../../library/errors');
const { O, sock } = require('../../lib/owner');

module.exports = O({ id: 'owner.setbio', name: 'setbio', description: 'Ganti bio/status bot', usage: '<teks>', async run(ctx) { const t = ctx.requireText(); if (t.length > 139) throw new UsageError('Bio maks 139 karakter.'); await sock(ctx).updateProfileStatus(t); await ctx.reply('✅ Bio diganti.'); } });
