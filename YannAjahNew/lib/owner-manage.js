'use strict';
// Manajemen V15: reseller, premium (grup/trial/beli), sewa grup + sistem sewa, limit, kode redeem,
// respon otomatis, badword, custom command, order manual (beli premium/sewa -> owner acc).
// Pembayaran otomatis V15 (Pakasir) tidak dipakai: order dicatat lalu dikonfirmasi owner (.acctrx).
const crypto = require('crypto');
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const media = require('../library/mediastore');
const { targetJid, targetJids, amountArg, mention } = require('../library/targets');
const { jidUser, toJid, normalizePhone, toIDR } = require('../library/function');

const DAY = 86400000;
const O = f => feature({ category: 'owner', permission: 'owner', cooldown: 1, allowInMaintenance: true, ...f });
const U = f => feature({ category: 'store', ...f });
const arr = (o, k) => (o[k] = Array.isArray(o[k]) ? o[k] : []);
const obj = (o, k) => (o[k] = o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? o[k] : {});
const sock = ctx => { const s = ctx.yannajah.socket; if (!s) throw new UsageError('Bot belum terhubung.'); return s; };
const fmtDate = (ts, ctx) => new Date(ts).toLocaleString('id-ID', { timeZone: ctx.config.bot.timezone, dateStyle: 'medium', timeStyle: 'short' });
const left = ms => { const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600000); return d ? `${d} hari ${h} jam` : `${h} jam ${Math.floor((ms % 3600000) / 60000)} menit`; };
const addPremium = (ctx, jid, days) => { const u = ctx.db.user(jid); u.premiumUntil = Math.max(u.premiumUntil || 0, Date.now()) + days * DAY; ctx.db.touch(); return u.premiumUntil; };
const LINK_RE = /chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/i;

// ----------------------------------------------------------------- reseller (dua daftar: biasa & AM, seperti V15)
const resellerList = (ctx, key) => arr(ctx.db.raw(), key);

function resellerAdd(key, label) {
  return O({ id: `owner.${key.toLowerCase()}.add`, name: key === 'resellers' ? 'addreseller' : 'addreselleram', aliases: key === 'resellers' ? ['addres'] : [], description: `Tambah ${label} (tag/reply/nomor)`, usage: '<@tag|nomor>',
    async run(ctx) {
      const ts = targetJids(ctx); if (!ts.length) throw new UsageError(ctx.usage());
      const l = resellerList(ctx, key); const added = ts.filter(j => !l.includes(j)); l.push(...added); ctx.db.touch();
      await ctx.reply(added.length ? `✅ ${added.map(mention).join(', ')} ditambahkan sebagai ${label}.` : `✅ ${ts.map(mention).join(', ')} sudah terdaftar sebagai ${label}.`);
    } });
}

function resellerDel(key, label) {
  return O({ id: `owner.${key.toLowerCase()}.del`, name: key === 'resellers' ? 'delreseller' : 'delreselleram', description: `Hapus ${label}`, usage: '<@tag|nomor>',
    async run(ctx) {
      const ts = targetJids(ctx); if (!ts.length) throw new UsageError(ctx.usage());
      const l = resellerList(ctx, key); const gone = ts.filter(j => l.includes(j));
      ctx.db.raw()[key] = l.filter(j => !gone.includes(j)); ctx.db.touch();
      await ctx.reply(gone.length ? `✅ ${gone.map(mention).join(', ')} dihapus dari ${label}.` : `❌ ${ts.map(mention).join(', ')} tidak ada di daftar ${label}.`);
    } });
}

function resellerShow(key, label) {
  return O({ id: `owner.${key.toLowerCase()}.list`, name: key === 'resellers' ? 'listreseller' : 'listreselleram', description: `Daftar ${label}`,
    async run(ctx) { const l = resellerList(ctx, key); await ctx.reply(l.length ? `*「 LIST ${label.toUpperCase()} 」*\n\n${l.map((j, i) => `${i + 1}. ${mention(j)}`).join('\n')}` : `⚠️ Belum ada ${label}.`); } });
}

// ----------------------------------------------------------------- sewa grup
function sewa(ctx, jid) { return obj(ctx.db.raw(), 'sewa')[jid] || null; }
let sewaTimer = null;
function ensureSewaLoop(yannajah) {
  if (sewaTimer) return;
  sewaTimer = setInterval(async () => {
    try {
      if (!yannajah.auth?.isActive?.() || !yannajah.socket) return;
      const all = yannajah.database.raw().sewa || {};
      for (const [jid, s] of Object.entries(all)) {
        if (s.expiresAt > Date.now()) {
          if (!s.warned && s.expiresAt - Date.now() < DAY) { s.warned = true; yannajah.database.touch(); await yannajah.sendmessage(jid, { text: '⏰ Masa sewa bot di grup ini tinggal kurang dari 1 hari. Hubungi owner untuk perpanjang.' }).catch(() => {}); }
          continue;
        }
        delete all[jid]; yannajah.database.touch();
        await yannajah.sendmessage(jid, { text: '⌛ Masa sewa bot di grup ini sudah habis. Terima kasih! Hubungi owner untuk sewa lagi.' }).catch(() => {});
        if (yannajah.database.settings().sewaAutoLeave !== false) await yannajah.socket.groupLeave(jid).catch(() => {});
      }
    } catch { /* coba lagi putaran berikutnya */ }
  }, 60000);
  sewaTimer.unref?.();
}

async function resolveGroup(ctx) {
  const link = LINK_RE.exec(ctx.text || '');
  if (link) {
    try { return { jid: await sock(ctx).groupAcceptInvite(link[1]), status: '✅ Berhasil join via link' }; }
    catch { const info = await sock(ctx).groupGetInviteInfo(link[1]).catch(() => null); if (!info?.id) throw new UsageError('❌ Link tidak valid atau bot tidak bisa mengakses info grup.'); return { jid: info.id, status: '⏳ Menunggu persetujuan admin grup' }; }
  }
  const id = ctx.args.find(a => /@g\.us$/.test(a) || /^\d{15,22}$/.test(a));
  if (id) return { jid: id.endsWith('@g.us') ? id : `${id}@g.us`, status: '✅' };
  if (!ctx.m.isGroup) throw new UsageError(`Jalankan di grup, atau sertakan link/ID grup. ${ctx.usage()}`);
  return { jid: ctx.m.chat, status: '✅ Sudah di dalam grup' };
}

// ----------------------------------------------------------------- order manual
function newOrder(ctx, product, days, extra = {}) {
  const orders = arr(ctx.db.raw(), 'orders');
  const pending = orders.filter(o => o.user === ctx.m.sender && o.status === 'pending');
  if (pending.length >= 3) throw new UsageError(`Kamu masih punya ${pending.length} order pending. Batalkan dulu: ${ctx.prefix}bataltrx <id>`);
  const price = Number(product === 'premium' ? ctx.config.harga.prem : ctx.config.harga.sewa) || 0;
  const o = { id: `${product === 'premium' ? 'PREM' : 'SEWA'}-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`, user: ctx.m.sender, chat: ctx.m.chat, product, days, amount: price * days, status: 'pending', createdAt: Date.now(), ...extra };
  orders.push(o); if (orders.length > 500) orders.splice(0, orders.length - 500);
  ctx.db.touch();
  return o;
}
async function sendInvoice(ctx, o, title) {
  const p = ctx.config.payment;
  const caption = `𐔈⃘ ֹ ׅ 🌟 ֹ *${title}* ֹ ׅ ୫\n╭╼─┈───┈──✦\n│୭ ˚.ᵎᵎ *Order ID* : ${o.id}\n│୭ ˚.ᵎᵎ *Pembeli* : ${ctx.m.pushName}\n│୭ ˚.ᵎᵎ *Durasi* : ${o.days} hari\n│୭ ˚.ᵎᵎ *Total* : ${toIDR(o.amount)}\n╰─╼𔕬─┈───┈✦\n${[p.dana && `💳 DANA: ${p.dana}`, p.gopay && `💳 GOPAY: ${p.gopay}`].filter(Boolean).join('\n')}\n\n> Bayar lewat QRIS/e-wallet di atas lalu kirim bukti ke owner.\n> Order aktif setelah dikonfirmasi owner.\n> Batalkan: ${ctx.prefix}bataltrx ${o.id}`;
  if (p.qris) await ctx.sendFile(p.qris, { caption }); else await ctx.reply(caption);
  await ctx.yannajah.sendmessage(toJid(ctx.config.owner.number), { text: `🧾 Order baru ${o.id}\nDari: ${mention(o.user)}\nProduk: ${o.product} ${o.days} hari\nTotal: ${toIDR(o.amount)}${o.group ? `\nGrup: ${o.group}` : ''}\n\nKonfirmasi: ${ctx.prefix}acctrx ${o.id}\nTolak: ${ctx.prefix}tolaktrx ${o.id}`, mentions: [o.user] }).catch(() => {});
}
const findOrder = (ctx, id) => arr(ctx.db.raw(), 'orders').find(o => o.id.toUpperCase() === String(id || '').trim().toUpperCase());

// ----------------------------------------------------------------- respon & custom command
const KEY_RE = /^[^\n]{1,60}$/;
async function captureResponse(ctx) {
  const q = ctx.m.quoted;
  if (!q) throw new UsageError('❌ Reply pesan (teks/foto/video/audio/stiker) yang mau dijadikan respon!');
  const entry = { text: q.text || '', media: null };
  if (q.isMedia) { const buf = await q.download(); const kind = /webp/.test(q.mime) ? 'sticker' : q.mime.split('/')[0]; entry.media = { name: await media.save(buf, q.mime), kind: ['image', 'video', 'audio', 'sticker'].includes(kind) ? kind : 'document', mime: q.mime }; }
  if (!entry.text && !entry.media) throw new UsageError('Pesan yang di-reply kosong.');
  return entry;
}
async function sendResponse(ctx, r) {
  const c = r.media ? media.content(r.media, ['image', 'video'].includes(r.media.kind) ? r.text : undefined) : { text: r.text };
  if (c) await ctx.yannajah.sendmessage(ctx.m.chat, c, { quoted: ctx.m.raw });
  if (r.media && !['image', 'video'].includes(r.media.kind) && r.text) await ctx.reply(r.text);
}

const ITEMS = { koin: 'koin', limit: 'limit', premium: 'premium' };

module.exports = { DAY, O, U, arr, obj, sock, fmtDate, left, addPremium, LINK_RE, resellerAdd, resellerDel, resellerShow, sewa, ensureSewaLoop, resolveGroup, newOrder, sendInvoice, findOrder, KEY_RE, captureResponse, sendResponse, ITEMS };
