'use strict';
// Top game Roblox (V15: .toproblox) dari games.roblox.com (publik, tanpa key).
const { feature } = require('../../library/plugin-kit');
const extapi = require('../../lib/extapi');

module.exports = feature({
  id: 'tools.toproblox', name: 'toproblox', category: 'tools', cooldown: 10, limit: 1,
  description: 'Top 10 game Roblox yang lagi ramai', dependencies: { apis: ['roblox'] },
  async run(ctx) {
    await ctx.react('⏳');
    const json = await extapi.get(ctx, 'https://games.roblox.com/v1/games/list', { timeoutMs: 30000 });
    const list = (json?.games || []).slice(0, 10);
    if (!list.length) throw new (require('../../library/errors').UsageError)('Gagal mengambil daftar game Roblox.');
    const fmt = n => Number(n || 0).toLocaleString('id-ID');
    let out = '*TOP 10 GAME ROBLOX (PLAYING NOW)*\n\n';
    list.forEach((v, i) => {
      const likePct = v.totalUpVotes + v.totalDownVotes > 0 ? ((v.totalUpVotes / (v.totalUpVotes + v.totalDownVotes)) * 100).toFixed(0) : '0';
      out += `${i + 1}. ${v.name}\n   👥 ${fmt(v.playerCount)} · 👍 ${likePct}%\n   https://www.roblox.com/games/${v.rootPlaceId}\n\n`;
    });
    await ctx.reply(out.trim());
  }
});
