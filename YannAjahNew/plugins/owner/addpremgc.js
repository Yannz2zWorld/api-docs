'use strict';
// ----------------------------------------------------------------- premium
const { UsageError } = require('../../library/errors');
const { amountArg } = require('../../library/targets');
const { jidUser } = require('../../library/function');
const { O, addPremium } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.addpremgc', name: 'addpremgc', aliases: ['addpremgrup', 'addpremiumgc'], scope: 'group', description: 'Jadikan semua member grup premium N hari', usage: '<hari>',
  async run(ctx) {
    const days = amountArg(ctx, { max: 365 }); if (!days) throw new UsageError(`❌ Masukkan jumlah hari 1-365. ${ctx.usage()}`);
    const bot = `${jidUser(ctx.yannajah.socket?.user?.id || '')}@s.whatsapp.net`;
    const members = (ctx.m.groupMetadata?.participants || []).map(p => p.phoneNumber || p.id).filter(j => j.endsWith('@s.whatsapp.net') && j !== bot);
    if (!members.length) throw new UsageError('❌ Tidak ada member yang bisa ditambahkan premium.');
    members.forEach(j => addPremium(ctx, j, days));
    await ctx.reply(`✅ *Premium grup aktif*\nMember: ${members.length} orang\nDurasi: ${days} hari`);
  } });
