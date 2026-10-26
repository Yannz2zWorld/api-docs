'use strict';
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.backupdb', name: 'backupdb', aliases: ['backup'], description: 'Kirim file database lokal bot ke chat pribadi owner', scope: 'private',
  async run(ctx) { await ctx.db.save(); const buf = Buffer.from(JSON.stringify(ctx.db.raw(), null, 1)); await ctx.yannajah.sendFile(ctx.m.chat, { buffer: buf, mime: 'application/json' }, { asDocument: true, fileName: `database-${new Date().toISOString().slice(0, 10)}.json`, quoted: ctx.m.raw }); } });
