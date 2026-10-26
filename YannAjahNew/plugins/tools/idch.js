'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { sock } = require('../../lib/owner-settings');

module.exports = feature({ id: 'info.idch', name: 'idch', aliases: ['cekidch'], category: 'tools', description: 'Info & ID channel WhatsApp dari link', usage: '<link channel>', limit: 1,
  async run(ctx) {
    const code = /whatsapp\.com\/channel\/([A-Za-z0-9]+)/.exec(ctx.text || '')?.[1]; if (!code) throw new UsageError('❌ Link channel tidak valid!');
    const r = await sock(ctx).newsletterMetadata('invite', code).catch(() => null); if (!r) throw new UsageError('❌ Gagal mengambil data channel!');
    const t = r.thread_metadata || r;
    await ctx.reply(`╔──☉ *CHANNEL INFO*\n│✎ *ID* : ${r.id}\n│✎ *Nama* : ${t.name?.text || r.name || '-'}\n│✎ *Followers* : ${t.subscribers_count || r.subscribers || 0}\n│✎ *Verified* : ${(t.verification || r.verification) === 'VERIFIED' ? 'Ya' : 'Tidak'}\n╚────────────☉`);
  } });
