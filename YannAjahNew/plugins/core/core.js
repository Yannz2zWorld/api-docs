'use strict';
// Command inti: menu (dibangun dari registry), info bot, status lisensi/API, bantuan per command.
const { feature } = require('../../library/plugin-kit');
const { buildMenu, buildAllMenu } = require('../../menu');
const { runtime, bytesToSize } = require('../../library/function');
const media = require('../../library/mediastore');

const statusOpts = ctx => ({ apiKey: ctx.api?.hasKey?.() ?? true, disabledList: ctx.config.plugin.disabled });

// Gaya menu dari .setmenu (text/image/video/document); media dari .setimg, audio dari .setaudiomenu.
async function sendMenu(ctx, text) {
  const st = ctx.db.settings(); const style = st.menuStyle || 'text'; const imgs = st.images || {};
  const image = media.load(imgs.menu?.name) || ctx.config.image.menu;
  if (style === 'image' && image) await ctx.sendFile(image, { caption: text });
  else if (style === 'video' && media.load(imgs.menuvideo?.name)) await ctx.sendFile(media.load(imgs.menuvideo.name), { caption: text, gif: true });
  else if (style === 'document') await ctx.sendFile({ buffer: Buffer.from(text), mime: 'text/plain' }, { asDocument: true, fileName: `${ctx.config.bot.name}-menu.txt`, caption: text.slice(0, 1000) });
  else await ctx.reply(text);
  const audio = media.load(st.menuAudio?.name);
  if (audio) await ctx.sendFile(audio, { mimetype: st.menuAudio.mime || 'audio/mpeg' });
}

module.exports = [
  feature({ id: 'core.menu', name: 'menu', aliases: ['help', 'start'], category: 'core', description: 'Daftar kategori & fitur bot', usage: '[kategori]', cooldown: 3, allowInMaintenance: false,
    async run(ctx) {
      const reg = ctx.yannajah.registry;
      const text = buildMenu(reg, { prefix: ctx.prefix, category: ctx.args[0] || null, statusOpts: statusOpts(ctx), botName: ctx.config.bot.name, isOwner: ctx.isOwner });
      if (!text) return ctx.reply(`Kategori *${ctx.args[0]}* tidak ada. Ketik ${ctx.prefix}menu`);
      await sendMenu(ctx, text);
    } }),
  feature({ id: 'core.allmenu', name: 'allmenu', category: 'core', description: 'Semua fitur aktif per kategori', cooldown: 10,
    async run(ctx) { await ctx.reply(buildAllMenu(ctx.yannajah.registry, { prefix: ctx.prefix, statusOpts: statusOpts(ctx), isOwner: ctx.isOwner })); } }),
  feature({ id: 'core.cmdinfo', name: 'cmdinfo', aliases: ['caracmd', 'infofitur'], category: 'core', description: 'Detail sebuah command: deskripsi, alias, parameter, permission, status', usage: '<command>',
    async run(ctx) {
      const name = ctx.requireText().replace(/^[./!#]/, '').split(/\s+/)[0];
      const f = ctx.yannajah.registry.resolve(name);
      if (!f) return ctx.reply(`Command *${name}* tidak ditemukan.`);
      const st = ctx.yannajah.registry.effectiveStatus(f, statusOpts(ctx));
      await ctx.reply([`*${ctx.prefix}${f.name}* ${f.usage || ''}`, f.description, `ID: ${f.id}`, `Kategori: ${f.category}`, `Alias: ${f.aliases.join(', ') || '-'}`, `Permission: ${f.permission}${f.scope !== 'all' ? ` (${f.scope} saja)` : ''}`, `Status: ${st}`, f.dependencies.apiz2z ? `API: APIZ2Z ${f.dependencies.apiz2z}` : null, f.params.length ? `Parameter: ${f.params.map(p => p.name + (p.required ? '*' : '')).join(', ')}` : null].filter(Boolean).join('\n'));
    } }),
  feature({ id: 'core.ping', name: 'ping', aliases: ['p'], category: 'core', description: 'Cek respons bot', allowInMaintenance: true,
    async run(ctx) { const t = Date.now(); await ctx.reply(`🏓 Pong! ${Date.now() - Number(ctx.m.timestamp ? ctx.m.timestamp * 1000 : t)} ms`); } }),
  feature({ id: 'core.runtime', name: 'runtime', aliases: ['uptime'], category: 'core', description: 'Lama bot berjalan',
    async run(ctx) { await ctx.reply(`⏱️ Aktif selama ${runtime(process.uptime())}`); } }),
  feature({ id: 'core.botinfo', name: 'botinfo', aliases: ['info'], category: 'core', description: 'Informasi bot, versi, statistik',
    async run(ctx) {
      const h = ctx.yannajah.health();
      const s = ctx.db.raw().stats;
      await ctx.reply([`*${ctx.config.bot.name}* — YannAjahNew v${ctx.config.bot.version}`, `Owner: ${ctx.config.owner.name}`, `Fitur terdaftar: ${h.features}`, `Command dijalankan: ${s.totalCommands || 0}`, `User tercatat: ${Object.keys(ctx.db.raw().users).length}`, `Grup tercatat: ${Object.keys(ctx.db.raw().groups).length}`, `Uptime: ${runtime(h.uptime_s)}`, `Memori: ${h.memory_mb} MB`, `Node: ${process.version}`].join('\n'));
    } }),
  feature({ id: 'core.owner', name: 'owner', aliases: ['creator', 'developerbot'], category: 'core', description: 'Kontak owner bot',
    async run(ctx) {
      const n = ctx.config.owner.number, name = ctx.config.owner.name.replace(/[\r\n;]/g, ' ');
      await ctx.yannajah.sendmessage(ctx.m.chat, { contacts: { displayName: name, contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;waid=${n}:+${n}\nEND:VCARD` }] } }, { quoted: ctx.m.raw });
    } }),
  feature({ id: 'core.totalfitur', name: 'totalfitur', aliases: ['fitur'], category: 'core', description: 'Jumlah fitur per status dan kategori (sesuai registry)',
    async run(ctx) {
      const reg = ctx.yannajah.registry; const count = {}; const cat = {};
      for (const f of reg.features.values()) { const s = reg.effectiveStatus(f, statusOpts(ctx)); count[s] = (count[s] || 0) + 1; if (s !== 'planned') cat[f.category] = (cat[f.category] || 0) + 1; }
      await ctx.reply(`📊 *Total fitur terdaftar: ${reg.features.size}*\n${Object.entries(count).map(([k, v]) => `• ${k}: ${v}`).join('\n')}\n\n*Per kategori (aktif):*\n${Object.entries(cat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${k}: ${v}`).join('\n')}`);
    } }),
  feature({ id: 'core.status', name: 'status', aliases: ['lisensi'], category: 'core', description: 'Status lisensi, koneksi WhatsApp, maintenance', allowInMaintenance: true,
    async run(ctx) {
      const h = ctx.yannajah.health(); const l = h.license || {};
      await ctx.reply([`Lisensi: ${l.active ? '✅ aktif' : `🔒 terkunci (${l.reason})`}`, `Bot: ${l.bot ? `${l.bot.name} (${l.bot.phone_number})` : '-'}`, `Instance: ${l.instanceName || '-'}`, `Maintenance: ${l.maintenance?.active ? `ya (${l.maintenance.scope})` : 'tidak'}`, `WhatsApp: ${h.wa}`, `Verifikasi terakhir: ${l.lastOkAt || '-'}`].join('\n'));
    } }),
  feature({ id: 'core.apistatus', name: 'apistatus', category: 'core', description: 'Status koneksi ke APIZ2Z (tanpa memakai kuota)', permission: 'owner', cooldown: 10,
    async run(ctx) {
      const s = await ctx.api.getStatus();
      await ctx.reply([`APIZ2Z: ${s.reachable ? '✅ terjangkau' : `❌ tidak terjangkau (${s.error || s.status})`} ${s.ms} ms`, `API key: ${s.hasKey ? 'terisi' : 'BELUM diisi'}`, `Endpoint terverifikasi: ${s.endpoints}`, `Request: ${s.stats.requests} (ok ${s.stats.ok}, gagal ${s.stats.failed}, cache ${s.stats.cached})`].join('\n'));
    } }),
  feature({ id: 'core.speed', name: 'speed', aliases: ['server'], category: 'core', description: 'Info server: CPU, memori, platform',
    async run(ctx) {
      const os = require('os');
      await ctx.reply([`Platform: ${os.platform()} ${os.arch()}`, `CPU: ${os.cpus()[0]?.model || '?'} × ${os.cpus().length}`, `Load: ${os.loadavg().map(x => x.toFixed(2)).join(' ')}`, `RAM: ${bytesToSize(os.totalmem() - os.freemem())} / ${bytesToSize(os.totalmem())}`, `Proses: ${bytesToSize(process.memoryUsage().rss)}`].join('\n'));
    } })
];
