'use strict';
// Logic Bell (V15: .logicbell) — ngobrol sama AI persona "Bella". API: Termai (butuh key TERMAI_API_KEY).
// Kalau key kosong, fitur ditandai needs_api_key (tidak dihapus).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { request } = require('../../library/net');
const extapi = require('../../lib/extapi');

module.exports = feature({
  id: 'ai.logicbell', name: 'logicbell', category: 'ai', cooldown: 5, limit: 1,
  description: 'Ngobrol dengan AI persona "Bella" (Termai)', usage: '<pesan>',
  params: [{ name: 'text', required: true }], dependencies: { apis: ['termai'], needsKey: 'TERMAI_API_KEY' },
  async run(ctx) {
    const { url, key } = ctx.config.extapi.termai;
    if (!key) throw new UsageError('Fitur ini butuh API Termai. Owner isi TERMAI_API_KEY di .env.');
    const text = (ctx.text || ctx.m.quoted?.text || '').trim();
    if (!text) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} halo, kamu siapa?`);
    await ctx.react('⏳');
    const body = JSON.stringify({ text, id: ctx.m.chat, fullainame: 'Bella Clarissa', nickainame: 'Bella', senderName: ctx.m.pushName || 'User', ownerName: ctx.config.owner.name, date: new Date().toISOString(), role: 'teman dekat', msgtype: 'text', commands: [] });
    const r = await request(`${url}/api/chat/logic-bell?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, allowHosts: extapi.hostsFrom(ctx.config), timeoutMs: 120000 });
    let data; try { data = JSON.parse(r.body.toString('utf8')); } catch { data = null; }
    const result = data?.data?.msg || data?.result;
    if (!result) throw new UsageError('Gagal mendapatkan respons, coba lagi nanti.');
    await ctx.reply(`🎀 *${ctx.config.bot.name}*\n\n${String(result).slice(0, 4000)}`);
  }
});
