'use strict';
// Fitur toko grup V15: list produk (addlist/list/dellist/updatelist/setlist + ketik nama item),
// payment per grup (addpay/pay/listpay/delpay + ketik keyword), template proses/done, testimoni, donasi.
// Semua data per grup di database lokal (groups[jid].store); media disimpan lewat library/mediastore.
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const media = require('../library/mediastore');
const { canvas, fit, font, roundRect, png } = require('../library/canvas');
const { jidUser } = require('../library/function');

const S = f => feature({ category: 'store', scope: 'group', ...f });
const A = f => S({ permission: 'admin', ...f });
const store = ctx => {
  const g = ctx.db.group(ctx.m.chat);
  g.store = g.store || {};
  g.store.items = Array.isArray(g.store.items) ? g.store.items : [];
  g.store.payments = g.store.payments || {};
  return g.store;
};
const MAX_ITEMS = 200;
const DAY = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function now(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  const d = new Date(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
  const h = Number(p.hour);
  return {
    time: `${p.hour}:${p.minute}:${p.second}`, date: `${p.day}/${p.month}/${p.year}`,
    full: `${DAY[d.getUTCDay()]}, ${Number(p.day)} ${MONTH[Number(p.month) - 1]} ${p.year}`,
    part: h < 5 ? 'Dini Hari' : h < 10 ? 'Pagi' : h < 15 ? 'Siang' : h < 18 ? 'Sore' : 'Malam'
  };
}

function renderList(ctx, s) {
  const items = [...s.items].sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
  const mark = s.listPrefix || '୭ ˚.ᵎᵎ';
  const names = items.map(i => `${mark} ${i.name}`).join('\n');
  if (!s.template) return `📋 *DAFTAR LIST*\n\n${names}\n\n📌 *Cara pakai:* ketik nama item untuk melihat detail`;
  const t = now(ctx.config.bot.timezone);
  return s.template.replace(/@prefix[^\n]*\n?/gi, '')
    .replace(/@name/g, ctx.m.pushName).replace(/@group/g, ctx.m.groupMetadata?.subject || 'Grup')
    .replace(/@time/g, t.time).replace(/@date/g, t.date).replace(/@fulldate/g, t.full).replace(/@daytime/g, t.part)
    .replace(/@x/g, names);
}

function findItem(items, q) {
  const k = String(q).toLowerCase().trim();
  if (/^\d+$/.test(k)) return items[Number(k) - 1] ? Number(k) - 1 : -1;
  const exact = items.findIndex(i => i.name.toLowerCase() === k);
  return exact >= 0 ? exact : items.findIndex(i => i.name.toLowerCase().includes(k));
}

async function sendEntry(ctx, entry, text) {
  const c = entry.media ? media.content(entry.media, ['image', 'video'].includes(entry.media.kind) ? text : undefined) : null;
  if (c) {
    await ctx.yannajah.sendmessage(ctx.m.chat, c, { quoted: ctx.m.raw });
    if (!['image', 'video'].includes(entry.media.kind) && text) await ctx.reply(text);
  } else await ctx.reply(text);
}

// Template proses/done: @tanggal @jam @status @item @user @group
function renderOrder(ctx, tpl, status, item, target) {
  const t = now(ctx.config.bot.timezone);
  return {
    text: tpl.replace(/@tanggal/g, t.full).replace(/@jam/g, t.time).replace(/@status/g, status).replace(/@item/g, item)
      .replace(/@user/g, `@${jidUser(target)}`).replace(/@group/g, ctx.m.groupMetadata?.subject || 'Grup'),
    mentions: [target]
  };
}

// .setproses/.setdone: atur template pesan pesanan.
const orderTemplate = (kind, status) => A({ id: `store.set${kind}`, name: `set${kind}`, description: `Atur template pesan .${kind} (variabel: @tanggal @jam @status @item @user @group)`, usage: '<template>',
  async run(ctx) {
    const s = store(ctx);
    s[`${kind}Template`] = ctx.requireText(`Format: ${ctx.prefix}set${kind} <template>\nVariabel: @tanggal @jam @status @item @user @group`).slice(0, 3000);
    ctx.db.touch();
    await ctx.reply(`✅ Template .${kind} disimpan.\n\n📋 Preview:\n${renderOrder(ctx, s[`${kind}Template`], status, 'AM12', ctx.m.sender).text}`);
  } });

// .proses/.done: kirim pesan status pesanan ke pembeli (reply pesan pembeli).
const orderMessage = (kind, status, emoji) => A({ id: `store.${kind}`, name: kind, description: `Kirim pesan ${status.toLowerCase()} ke pembeli (reply pesan pembeli): .${kind} <item>`, usage: '[item]',
  async run(ctx) {
    const tpl = store(ctx)[`${kind}Template`] || `${emoji} *${status.toUpperCase()}*\n\n📆 @tanggal\n⏰ @jam\n👤 @user\n📦 @item\n✨ Status: @status`;
    if (!ctx.m.quoted) throw new UsageError(`Reply pesan pembeli. Contoh: ${ctx.prefix}${kind} AM12`);
    const r = renderOrder(ctx, tpl, status, ctx.text || 'Produk', ctx.m.quoted.sender);
    await ctx.yannajah.sendmessage(ctx.m.chat, r, { quoted: { key: ctx.m.quoted.key, message: ctx.m.quoted.message } });
  } });

async function testimoniCard({ nama, produk, harga, tanggal, toko }) {
  const W = 1080, H = 1350;
  const { c, g } = canvas(W, H);
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0f0c29'); bg.addColorStop(0.5, '#302b63'); bg.addColorStop(1, '#24243e');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(g, 80, 150, W - 160, H - 300, 40); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.stroke();
  g.textAlign = 'center'; g.fillStyle = '#ffd86b'; g.font = font(78, true); g.fillText('TESTIMONI', W / 2, 290);
  g.fillStyle = '#ffffff'; g.font = font(34); g.fillText(toko, W / 2, 350);
  g.fillStyle = '#8be9fd'; g.font = font(64); g.fillText('★★★★★', W / 2, 450);
  const rows = [['Pembeli', nama], ['Produk', produk], ['Harga', harga], ['Tanggal', tanggal]];
  let y = 540;
  for (const [k, v] of rows) {
    g.textAlign = 'left'; g.fillStyle = '#b8b5ff'; g.font = font(34, true); g.fillText(k, 150, y);
    g.fillStyle = '#ffffff';
    const f = fit(g, v, W - 300, 100, { start: 52, min: 22, bold: true });
    g.font = font(f.size, true);
    f.lines.slice(0, 2).forEach((l, i) => g.fillText(l, 150, y + 58 + i * f.size * 1.15));
    y += 155;
  }
  g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = font(30); g.fillText('Terima kasih sudah order! 🙏', W / 2, H - 185);
  return png(c);
}

module.exports = { S, A, store, MAX_ITEMS, now, renderList, findItem, sendEntry, orderTemplate, orderMessage, testimoniCard };
