'use strict';
// Manajemen V15: reseller, premium (grup/trial/beli), sewa grup + sistem sewa, limit, kode redeem,
// respon otomatis, badword, custom command, order manual (beli premium/sewa -> owner acc).
// Pembayaran otomatis V15 (Pakasir) tidak dipakai: order dicatat lalu dikonfirmasi owner (.acctrx).
const crypto = require('crypto');
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { targetJid, targetJids, amountArg, mention } = require('../../library/targets');
const { jidUser, toJid, normalizePhone, toIDR } = require('../../library/function');

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
function resellerSet(key, label) {
  const list = ctx => arr(ctx.db.raw(), key);
  return [
    O({ id: `owner.${key.toLowerCase()}.add`, name: key === 'resellers' ? 'addreseller' : 'addreselleram', aliases: key === 'resellers' ? ['addres'] : [], description: `Tambah ${label} (tag/reply/nomor)`, usage: '<@tag|nomor>',
      async run(ctx) {
        const ts = targetJids(ctx); if (!ts.length) throw new UsageError(ctx.usage());
        const l = list(ctx); const added = ts.filter(j => !l.includes(j)); l.push(...added); ctx.db.touch();
        await ctx.reply(added.length ? `✅ ${added.map(mention).join(', ')} ditambahkan sebagai ${label}.` : `✅ ${ts.map(mention).join(', ')} sudah terdaftar sebagai ${label}.`);
      } }),
    O({ id: `owner.${key.toLowerCase()}.del`, name: key === 'resellers' ? 'delreseller' : 'delreselleram', description: `Hapus ${label}`, usage: '<@tag|nomor>',
      async run(ctx) {
        const ts = targetJids(ctx); if (!ts.length) throw new UsageError(ctx.usage());
        const l = list(ctx); const gone = ts.filter(j => l.includes(j));
        ctx.db.raw()[key] = l.filter(j => !gone.includes(j)); ctx.db.touch();
        await ctx.reply(gone.length ? `✅ ${gone.map(mention).join(', ')} dihapus dari ${label}.` : `❌ ${ts.map(mention).join(', ')} tidak ada di daftar ${label}.`);
      } }),
    O({ id: `owner.${key.toLowerCase()}.list`, name: key === 'resellers' ? 'listreseller' : 'listreselleram', description: `Daftar ${label}`,
      async run(ctx) { const l = list(ctx); await ctx.reply(l.length ? `*「 LIST ${label.toUpperCase()} 」*\n\n${l.map((j, i) => `${i + 1}. ${mention(j)}`).join('\n')}` : `⚠️ Belum ada ${label}.`); } })
  ];
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

module.exports = [
  ...resellerSet('resellers', 'Reseller'),
  ...resellerSet('resellersAm', 'Reseller AM'),
  feature({ id: 'user.cekres', name: 'cekres', aliases: ['isreseller'], category: 'user', description: 'Cek apakah user reseller', usage: '<@tag|nomor>',
    async run(ctx) { const j = targetJid(ctx, { self: true }); const r = arr(ctx.db.raw(), 'resellers').includes(j); await ctx.reply(r ? `✅ User ${mention(j)} adalah *Reseller*.` : `❌ User ${mention(j)} bukan Reseller.`); } }),
  O({ id: 'owner.resellers.clear', name: 'clearreseller', aliases: ['resetreseller', 'hapussemuareseller'], description: 'Hapus semua reseller',
    async run(ctx) { const n = arr(ctx.db.raw(), 'resellers').length; if (!n) throw new UsageError('⚠️ Database reseller sudah kosong.'); ctx.db.raw().resellers = []; ctx.db.touch(); await ctx.reply(`🗑️ *BERHASIL MENGHAPUS SEMUA RESELLER!*\nTotal dihapus: *${n} user*`); } }),

  // ----------------------------------------------------------------- premium
  O({ id: 'owner.addpremgc', name: 'addpremgc', aliases: ['addpremgrup', 'addpremiumgc'], scope: 'group', description: 'Jadikan semua member grup premium N hari', usage: '<hari>',
    async run(ctx) {
      const days = amountArg(ctx, { max: 365 }); if (!days) throw new UsageError(`❌ Masukkan jumlah hari 1-365. ${ctx.usage()}`);
      const bot = `${jidUser(ctx.yannajah.socket?.user?.id || '')}@s.whatsapp.net`;
      const members = (ctx.m.groupMetadata?.participants || []).map(p => p.phoneNumber || p.id).filter(j => j.endsWith('@s.whatsapp.net') && j !== bot);
      if (!members.length) throw new UsageError('❌ Tidak ada member yang bisa ditambahkan premium.');
      members.forEach(j => addPremium(ctx, j, days));
      await ctx.reply(`✅ *Premium grup aktif*\nMember: ${members.length} orang\nDurasi: ${days} hari`);
    } }),
  O({ id: 'owner.delpremgc', name: 'delpremgc', aliases: ['delpremgrup', 'deletepremgc'], scope: 'group', description: 'Cabut premium semua member grup',
    async run(ctx) {
      let n = 0;
      for (const p of ctx.m.groupMetadata?.participants || []) { const u = ctx.db.get(['users', p.phoneNumber || p.id]); if (u?.premiumUntil > Date.now()) { u.premiumUntil = 0; n++; } }
      ctx.db.touch();
      await ctx.reply(n ? `✅ Premium grup dihapus\nMember: ${n} orang` : '❌ Tidak ada member premium di grup ini.');
    } }),
  O({ id: 'owner.clearprem', name: 'clearprem', description: 'Bersihkan data premium yang sudah kedaluwarsa',
    async run(ctx) { let n = 0, active = 0; for (const u of Object.values(ctx.db.raw().users)) { if (u.premiumUntil && u.premiumUntil <= Date.now()) { u.premiumUntil = 0; n++; } else if (u.premiumUntil) active++; } ctx.db.touch(); await ctx.reply(`🧹 *Pembersihan Selesai!*\n\n📌 Dihapus: *${n}*\n📦 Premium aktif: *${active}*`); } }),
  feature({ id: 'group.onlyprem', name: 'onlyprem', category: 'group', scope: 'group', permission: 'admin', description: 'Mode grup: hanya user premium yang bisa memakai bot', usage: 'on/off',
    async run(ctx) { const v = (ctx.args[0] || '').toLowerCase(); if (!['on', 'off'].includes(v)) return ctx.reply(`Mode onlyPrem: *${ctx.group.onlyPrem ? 'ON' : 'OFF'}*\n${ctx.usage()}`); ctx.group.onlyPrem = v === 'on'; ctx.db.touch(); await ctx.reply(`Mode onlyPrem ${v === 'on' ? 'diaktifkan' : 'dimatikan'} untuk grup ini.`); },
    async onMessage(ctx) { if (!ctx.m.isGroup || !ctx.m.isCmd || ctx.isPremium || ctx.isAdmin) return false; if (!ctx.db.get(['groups', ctx.m.chat, 'onlyPrem'])) return false; await ctx.reply(ctx.config.mess.prem); return true; } }),
  feature({ id: 'user.trialprem', name: 'trialprem', aliases: ['trialpremium'], category: 'user', description: 'Coba premium gratis 1 hari (sekali seumur hidup)',
    async run(ctx) {
      if (ctx.user.trialUsed) throw new UsageError(`❌ *TRIAL SUDAH PERNAH DICLAIM!*\nTrial hanya bisa 1 kali.\n\n💎 Upgrade premium: ${ctx.prefix}prem`);
      if (ctx.isPremium) throw new UsageError('❌ Kamu sudah premium aktif!');
      ctx.user.trialUsed = Date.now();
      const until = addPremium(ctx, ctx.m.sender, 1);
      await ctx.reply(`🎉 *Trial premium aktif!*\nBerlaku sampai ${fmtDate(until, ctx)}`);
    } }),
  U({ id: 'store.prem', name: 'prem', aliases: ['hargaprem', 'pricelist'], description: 'Info & harga premium / sewa bot',
    async run(ctx) {
      const s = ctx.config.sewa;
      await ctx.reply(`╭╼ *Premium Member*\n│୭ ˚.ᵎᵎ Harga : ${toIDR(ctx.config.harga.prem)}/hari\n│୭ ˚.ᵎᵎ Tanpa limit, prioritas, semua fitur\n│୭ ˚.ᵎᵎ Beli : ${ctx.prefix}buyprem <hari>\n│\n│ *Sewa Bot ke Grup*\n│୭ ˚.ᵎᵎ 1 bulan : ${toIDR(s.bulan1)}\n│୭ ˚.ᵎᵎ 3 bulan : ${toIDR(s.bulan3)}\n│୭ ˚.ᵎᵎ 6 bulan : ${toIDR(s.bulan6)}\n│୭ ˚.ᵎᵎ 12 bulan : ${toIDR(s.bulan12)}\n│୭ ˚.ᵎᵎ Sewa : ${ctx.prefix}buysewagc <link> <hari>\n╰─╼ Owner: ${ctx.config.links.owner}`);
    } }),
  U({ id: 'store.sewa', name: 'sewa', aliases: ['sewabot'], description: 'Info sewa bot ke grup', async run(ctx) { await ctx.yannajah.registry.resolve('prem').run(ctx); } }),
  U({ id: 'store.buyprem', name: 'buyprem', aliases: ['buypremium', 'beliprem', 'belipremium'], description: 'Beli premium (order dikonfirmasi owner): .buyprem <hari 7-365>', usage: '<hari>', cooldown: 10,
    async run(ctx) {
      const days = amountArg(ctx, { min: 7, max: 365 }); if (!days) throw new UsageError(`Format: ${ctx.prefix}buyprem <hari>\nMin 7 hari, maks 365 hari. Harga ${toIDR(ctx.config.harga.prem)}/hari`);
      if (ctx.isPremium && !ctx.isOwner) throw new UsageError(`Kamu sudah premium sampai ${fmtDate(ctx.user.premiumUntil, ctx)}.`);
      await sendInvoice(ctx, newOrder(ctx, 'premium', days), `Premium Bot ${days} Hari`);
    } }),
  U({ id: 'store.buysewagc', name: 'buysewagc', description: 'Sewa bot untuk grup (order dikonfirmasi owner): .buysewagc <link grup> <hari 7-365>', usage: '<link> <hari>', cooldown: 10,
    async run(ctx) {
      const link = LINK_RE.exec(ctx.text || ''); const days = amountArg(ctx, { min: 7, max: 365 });
      if (!link || !days) throw new UsageError(`Format: ${ctx.prefix}buysewagc https://chat.whatsapp.com/xxxx 7\nMin 7 hari, maks 365. Harga ${toIDR(ctx.config.harga.sewa)}/hari`);
      await sendInvoice(ctx, newOrder(ctx, 'sewa', days, { link: link[0] }), `Sewa Bot ${days} Hari`);
    } }),
  U({ id: 'store.bataltrx', name: 'bataltrx', aliases: ['batalkantrx'], description: 'Batalkan order kamu yang masih pending', usage: '<order id>',
    async run(ctx) { const o = findOrder(ctx, ctx.args[0]); if (!o || o.status !== 'pending') throw new UsageError('❌ Transaksi tidak ditemukan / sudah diproses.'); if (o.user !== ctx.m.sender && !ctx.isOwner) throw new UsageError('❌ Anda tidak memiliki izin untuk membatalkan transaksi ini.'); o.status = 'cancelled'; ctx.db.touch(); await ctx.reply('✅ Transaksi berhasil dibatalkan.'); } }),
  O({ id: 'owner.listtrx', name: 'listtrx', aliases: ['cektrx'], description: 'Daftar order pending',
    async run(ctx) { const l = arr(ctx.db.raw(), 'orders').filter(o => o.status === 'pending'); await ctx.reply(l.length ? l.map(o => `• ${o.id} — ${o.product} ${o.days} hari — ${toIDR(o.amount)} — ${mention(o.user)}`).join('\n') : 'Tidak ada order pending.'); } }),
  O({ id: 'owner.acctrx', name: 'acctrx', aliases: ['konfirmasitrx'], description: 'Konfirmasi order (premium/sewa langsung aktif)', usage: '<order id>',
    async run(ctx) {
      const o = findOrder(ctx, ctx.args[0]); if (!o || o.status !== 'pending') throw new UsageError('❌ Order tidak ditemukan / sudah diproses.');
      let info;
      if (o.product === 'premium') info = `💎 Premium aktif sampai ${fmtDate(addPremium(ctx, o.user, o.days), ctx)}`;
      else {
        const code = LINK_RE.exec(o.link || '')?.[1];
        let jid = await sock(ctx).groupAcceptInvite(code).catch(() => null);
        if (!jid) jid = (await sock(ctx).groupGetInviteInfo(code).catch(() => null))?.id;
        if (!jid) throw new UsageError('❌ Link grup order ini tidak valid lagi. Minta pembeli kirim link baru.');
        const all = obj(ctx.db.raw(), 'sewa'); const cur = all[jid];
        all[jid] = { expiresAt: Math.max(cur?.expiresAt || 0, Date.now()) + o.days * DAY, by: o.user, order: o.id, warned: false };
        info = `🏠 Sewa grup aktif sampai ${fmtDate(all[jid].expiresAt, ctx)}`; ensureSewaLoop(ctx.yannajah);
      }
      o.status = 'paid'; o.paidAt = Date.now(); ctx.db.touch();
      await ctx.yannajah.sendmessage(o.chat, { text: `✅ Pembayaran ${o.id} dikonfirmasi!\n${info}`, mentions: [o.user] }).catch(() => {});
      await ctx.reply(`✅ ${o.id} dikonfirmasi. ${info}`);
    } }),
  O({ id: 'owner.tolaktrx', name: 'tolaktrx', description: 'Tolak order', usage: '<order id> [alasan]',
    async run(ctx) { const o = findOrder(ctx, ctx.args[0]); if (!o || o.status !== 'pending') throw new UsageError('❌ Order tidak ditemukan / sudah diproses.'); o.status = 'rejected'; ctx.db.touch(); await ctx.yannajah.sendmessage(o.chat, { text: `❌ Order ${o.id} ditolak. ${ctx.args.slice(1).join(' ')}`.trim(), mentions: [o.user] }).catch(() => {}); await ctx.reply('✅ Order ditolak.'); } }),

  // ----------------------------------------------------------------- sewa grup
  O({ id: 'owner.addsewagc', name: 'addsewagc', description: 'Sewakan bot ke grup: .addsewagc <hari> (di grup) atau .addsewagc <link> <hari>', usage: '[link] <hari>',
    async run(ctx) {
      const days = amountArg(ctx, { max: 3650 }); if (!days) throw new UsageError(ctx.usage());
      const g = await resolveGroup(ctx);
      const all = obj(ctx.db.raw(), 'sewa'); const cur = all[g.jid];
      all[g.jid] = { expiresAt: Math.max(cur?.expiresAt || 0, Date.now()) + days * DAY, by: ctx.m.sender, warned: false };
      ctx.db.touch(); ensureSewaLoop(ctx.yannajah);
      const name = (await sock(ctx).groupMetadata(g.jid).catch(() => null))?.subject || g.jid;
      await ctx.reply(`✅ *Sewa grup ${cur ? 'diperpanjang' : 'aktif'}*\nGrup: ${name}\nStatus: ${g.status}\nBerakhir: ${fmtDate(all[g.jid].expiresAt, ctx)}`);
    } }),
  O({ id: 'owner.renewsewa', name: 'perpanjangsewa', aliases: ['renewsewa', 'renewsewagc'], description: 'Perpanjang sewa grup N hari', usage: '[id grup] <hari>', async run(ctx) { await ctx.yannajah.registry.resolve('addsewagc').run(ctx); } }),
  O({ id: 'owner.delsewagc', name: 'delsewagc', description: 'Hentikan sewa grup (di grup atau dengan ID grup)', usage: '[id grup]',
    async run(ctx) { const g = await resolveGroup(ctx); const all = obj(ctx.db.raw(), 'sewa'); if (!all[g.jid]) throw new UsageError('❌ Grup ini tidak sedang sewa.'); delete all[g.jid]; ctx.db.touch(); await ctx.reply('✅ Sewa grup dihapus.'); } }),
  O({ id: 'owner.listsewagc', name: 'listsewagc', description: 'Daftar grup sewa aktif',
    async run(ctx) {
      const all = Object.entries(obj(ctx.db.raw(), 'sewa'));
      if (!all.length) return ctx.reply('📭 Belum ada grup sewa.');
      const groups = await sock(ctx).groupFetchAllParticipating().catch(() => ({}));
      await ctx.reply(`📋 *GRUP SEWA* (${all.length})\n\n${all.map(([j, s], i) => `${i + 1}. ${groups[j]?.subject || j}\n   ⏳ ${s.expiresAt > Date.now() ? left(s.expiresAt - Date.now()) : 'habis'}`).join('\n')}`);
    } }),
  feature({ id: 'group.ceksewagc', name: 'ceksewagc', aliases: ['ceksewa'], category: 'group', scope: 'group', description: 'Cek sisa masa sewa grup ini',
    async run(ctx) { const s = sewa(ctx, ctx.m.chat); await ctx.reply(s && s.expiresAt > Date.now() ? `🏠 *Sewa aktif*\nBerakhir: ${fmtDate(s.expiresAt, ctx)}\nSisa: ${left(s.expiresAt - Date.now())}` : `❌ Grup ini belum sewa. Info: ${ctx.prefix}sewa`); } }),
  O({ id: 'owner.sistemsewa', name: 'sistemsewa', description: 'Sistem sewa: bot hanya melayani grup yang sewa', usage: 'on/off',
    async run(ctx) {
      const v = (ctx.args[0] || '').toLowerCase(); const st = ctx.db.settings();
      if (!['on', 'off'].includes(v)) return ctx.reply(`╭一緒 *Sistem Sewa*\n│୭ ˚.ᵎᵎ Status : ${st.sistemSewa ? '✅ AKTIF' : '❌ NONAKTIF'}\n╰─────────一緒\n${ctx.usage()}`);
      st.sistemSewa = v === 'on'; ctx.db.touch(); ensureSewaLoop(ctx.yannajah);
      await ctx.reply(v === 'on' ? '✅ Sistem Sewa AKTIF\nBot hanya bisa digunakan di grup yang sudah sewa.' : '✅ Sistem Sewa NONAKTIF\nBot bisa digunakan di semua grup.');
    },
    async onMessage(ctx) {
      ensureSewaLoop(ctx.yannajah);
      if (!ctx.m.isGroup || !ctx.m.isCmd || ctx.isOwner || !ctx.db.settings().sistemSewa) return false;
      const s = sewa(ctx, ctx.m.chat);
      if (s && s.expiresAt > Date.now()) return false;
      if (['sewa', 'prem', 'buysewagc', 'owner', 'ceksewagc'].includes(ctx.m.command)) return false;
      const g = ctx.db.group(ctx.m.chat);
      if (!g.sewaNotifiedAt || Date.now() - g.sewaNotifiedAt > 6 * 3600000) { g.sewaNotifiedAt = Date.now(); ctx.db.touch(); await ctx.reply(`🔒 Grup ini belum sewa bot.\nInfo sewa: ${ctx.prefix}sewa`); }
      return true;
    } }),

  // ----------------------------------------------------------------- limit
  O({ id: 'owner.addlimitall', name: 'addlimitall', description: 'Tambah limit hari ini untuk semua user', usage: '<jumlah>',
    async run(ctx) { const n = amountArg(ctx, { max: 100000 }); if (!n) throw new UsageError(ctx.usage()); let c = 0; for (const j of Object.keys(ctx.db.raw().users)) { ctx.db.user(j).limit += n; c++; } ctx.db.touch(); await ctx.reply(`✅ +${n} limit untuk ${c} user.`); } }),
  O({ id: 'owner.setlimit', name: 'setlimit', description: 'Atur limit harian permanen user (0 = kembali default)', usage: '<@tag> <limit/hari>',
    async run(ctx) {
      const j = targetJid(ctx); const n = Number(ctx.args.find(a => /^\d{1,5}$/.test(a))); if (!Number.isInteger(n)) throw new UsageError(ctx.usage());
      const u = ctx.db.user(j); if (n > 0) { u.dailyLimit = n; u.limit = Math.max(u.limit, n); } else delete u.dailyLimit; ctx.db.touch();
      await ctx.reply(n > 0 ? `✅ Limit permanen ${mention(j)} menjadi *${n} limit/hari*.` : `✅ Limit ${mention(j)} kembali ke default.`);
    } }),
  O({ id: 'owner.dellimit', name: 'dellimit', description: 'Hapus limit harian permanen user', usage: '<@tag>',
    async run(ctx) { const j = targetJid(ctx); const u = ctx.db.user(j); if (!u.dailyLimit) throw new UsageError(`❌ ${mention(j)} tidak punya limit permanen.`); delete u.dailyLimit; ctx.db.touch(); await ctx.reply(`✅ Limit permanen ${mention(j)} dihapus.`); } }),
  feature({ id: 'user.kapanreset', name: 'kapanreset', category: 'user', description: 'Kapan limit harian di-reset',
    async run(ctx) {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: ctx.config.bot.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
      const s = 86400 - (Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second));
      await ctx.reply(`🕛 *RESET LIMIT*\nLimit direset setiap hari jam *00:00* (${ctx.config.bot.timezone}).\n⏳ Reset dalam *${Math.floor(s / 3600)} jam ${Math.floor((s % 3600) / 60)} menit ${s % 60} detik*`);
    } }),
  feature({ id: 'user.jumlahuser', name: 'jumlahuser', aliases: ['totaluser'], category: 'info', description: 'Jumlah user bot',
    async run(ctx) { const u = Object.values(ctx.db.raw().users); await ctx.reply(`📊 *TOTAL PENGGUNA*\n👥 Tercatat: ${u.length} user\n📝 Terdaftar: ${u.filter(x => x.registered).length} user\n💎 Premium: ${u.filter(x => x.premiumUntil > Date.now()).length} user`); } }),

  // ----------------------------------------------------------------- kode redeem
  O({ id: 'owner.buatkode', name: 'buatkode', aliases: ['addkode'], description: 'Buat kode redeem: .buatkode <KODE> <koin|limit|premium>:<jumlah> <maks klaim>', usage: '<kode> <item>:<jumlah> <maks>',
    async run(ctx) {
      const [code, it, max] = ctx.args; const [type, val] = String(it || '').split(':');
      if (!/^[A-Za-z0-9_-]{3,30}$/.test(code || '') || !ITEMS[String(type).toLowerCase()] || !(Number(val) > 0) || !(Number(max) > 0)) throw new UsageError(`📌 *Cara Buat Kode Redeem:*\n${ctx.prefix}buatkode <kode> <item>:<jumlah> <maxklaim>\nItem: koin, limit, premium (jumlah = hari)\n\nContoh:\n${ctx.prefix}buatkode HEMAT limit:10 50\n${ctx.prefix}buatkode VIP premium:7 20`);
      const codes = obj(ctx.db.raw(), 'redeemCodes'); const k = code.toUpperCase();
      if (codes[k]) throw new UsageError('❌ Kode sudah ada.');
      codes[k] = { item: type.toLowerCase(), value: Math.min(Number(val), type.toLowerCase() === 'premium' ? 365 : 1e9), max: Math.min(Number(max), 100000), claimed: [], createdAt: Date.now() };
      ctx.db.touch(); await ctx.reply(`✅ Kode *${k}* dibuat: ${codes[k].item} ${codes[k].value}, maks ${codes[k].max} klaim.`);
    } }),
  O({ id: 'owner.listkode', name: 'listkode', description: 'Daftar kode redeem', async run(ctx) { const c = Object.entries(obj(ctx.db.raw(), 'redeemCodes')); await ctx.reply(c.length ? c.map(([k, v]) => `• *${k}* — ${v.item} ${v.value} — ${v.claimed.length}/${v.max}`).join('\n') : 'Belum ada kode.'); } }),
  O({ id: 'owner.hapuskode', name: 'hapuskode', aliases: ['delkode'], description: 'Hapus kode redeem', usage: '<kode>', async run(ctx) { const c = obj(ctx.db.raw(), 'redeemCodes'); const k = (ctx.args[0] || '').toUpperCase(); if (!c[k]) throw new UsageError('❌ Kode tidak ada.'); delete c[k]; ctx.db.touch(); await ctx.reply(`✅ Kode ${k} dihapus.`); } }),
  feature({ id: 'user.redeem', name: 'redeem', aliases: ['klaimkode'], category: 'user', cooldown: 5, description: 'Tukar kode redeem', usage: '<kode>',
    async run(ctx) {
      const k = (ctx.args[0] || '').toUpperCase(); const c = obj(ctx.db.raw(), 'redeemCodes')[k];
      if (!k) throw new UsageError(`📌 Cara pakai: ${ctx.prefix}redeem <kode>`);
      if (!c) throw new UsageError('❌ Kode tidak valid.');
      if (c.claimed.includes(ctx.m.sender)) throw new UsageError('❌ Kamu sudah pernah klaim kode ini.');
      if (c.claimed.length >= c.max) throw new UsageError('❌ Kuota klaim kode ini sudah habis.');
      c.claimed.push(ctx.m.sender);
      let res;
      if (c.item === 'koin') { ctx.user.money = (ctx.user.money || 0) + c.value; res = `💰 +${c.value.toLocaleString('id-ID')} koin`; }
      else if (c.item === 'limit') { ctx.user.limit += c.value; res = `🎟️ +${c.value} limit`; }
      else res = `💎 Premium sampai ${fmtDate(addPremium(ctx, ctx.m.sender, c.value), ctx)}`;
      ctx.db.touch(); await ctx.reply(`🎁 *Redeem berhasil!*\n${res}`);
    } }),

  // ----------------------------------------------------------------- respon otomatis
  O({ id: 'owner.addrespon', name: 'addrespon', description: 'Reply pesan + .addrespon <kata kunci>: bot membalas pesan itu tiap ada yang mengetik kata kunci', usage: '<kata kunci>',
    async run(ctx) {
      const key = ctx.requireText().toLowerCase().trim(); if (!KEY_RE.test(key)) throw new UsageError('Kata kunci 1-60 karakter.');
      const r = obj(ctx.db.raw(), 'responses'); if (r[key]) throw new UsageError(`Respon *${key}* sudah ada!`);
      if (Object.keys(r).length >= 300) throw new UsageError('Maksimal 300 respon.');
      r[key] = await captureResponse(ctx); ctx.db.touch();
      await ctx.reply(`✅ Respon untuk *${key}* disimpan.`);
    } }),
  O({ id: 'owner.delrespon', name: 'delrespon', description: 'Hapus respon otomatis', usage: '<kata kunci>',
    async run(ctx) { const r = obj(ctx.db.raw(), 'responses'); const k = ctx.requireText().toLowerCase().trim(); if (!r[k]) throw new UsageError(`Respon *${k}* tidak ditemukan.`); const old = r[k].media?.name; delete r[k]; ctx.db.touch(); media.release(old, ctx.db); await ctx.reply(`✅ Respon *${k}* dihapus.`); } }),
  O({ id: 'owner.listrespon', name: 'listrespon', description: 'Daftar respon otomatis',
    async run(ctx) { const r = Object.entries(obj(ctx.db.raw(), 'responses')); const icon = v => ({ image: '🖼️', video: '🎥', audio: '🎵', sticker: '🏷️', document: '📄' }[v.media?.kind] || '💬'); await ctx.reply(r.length ? `*📋 LIST RESPON*\n\n${r.map(([k, v]) => `${icon(v)} *${k}*`).join('\n')}` : 'Tidak ada respon.'); } }),
  O({ id: 'owner.clearrespon', name: 'clearrespon', description: 'Hapus semua respon otomatis',
    async run(ctx) { const r = obj(ctx.db.raw(), 'responses'); const names = Object.values(r).map(v => v.media?.name); const n = names.length; ctx.db.raw().responses = {}; ctx.db.touch(); names.forEach(x => media.release(x, ctx.db)); await ctx.reply(`✅ ${n} respon dihapus.`); },
    async onMessage(ctx) {
      if (ctx.m.isCmd || !ctx.m.body || ctx.m.body.length > 60 || ctx.m.fromMe) return false;
      const r = ctx.db.raw().responses?.[ctx.m.body.toLowerCase().trim()];
      if (!r) return false;
      await sendResponse(ctx, r); return true;
    } }),

  // ----------------------------------------------------------------- custom command (pengganti addcase V15 yang menulis source code)
  O({ id: 'owner.addcase', name: 'addcase', aliases: ['addcmd'], description: 'Buat command teks/media sendiri: reply pesan + .addcase <nama>, atau .addcase <nama>|<balasan>', usage: '<nama>|<balasan>',
    async run(ctx) {
      const [n, ...rest] = ctx.requireText().split('|'); const name = n.trim().toLowerCase();
      if (!/^[a-z0-9_-]{2,30}$/.test(name)) throw new UsageError('Nama command 2-30 huruf/angka.');
      if (ctx.yannajah.registry.resolve(name)) throw new UsageError(`Command *${name}* sudah dipakai fitur bot.`);
      const c = obj(ctx.db.raw(), 'customCommands');
      c[name] = rest.length ? { text: rest.join('|').trim().slice(0, 4000), media: null } : await captureResponse(ctx);
      ctx.db.touch(); await ctx.reply(`✅ Command *${ctx.prefix}${name}* dibuat.`);
    } }),
  O({ id: 'owner.delcase', name: 'delcase', aliases: ['delcmd'], description: 'Hapus command buatan sendiri', usage: '<nama>',
    async run(ctx) { const c = obj(ctx.db.raw(), 'customCommands'); const k = ctx.requireText().toLowerCase(); if (!c[k]) throw new UsageError('❌ Command tidak ada.'); const old = c[k].media?.name; delete c[k]; ctx.db.touch(); media.release(old, ctx.db); await ctx.reply(`✅ Command ${k} dihapus.`); } }),
  O({ id: 'owner.listcase', name: 'listcase', aliases: ['listcmd'], description: 'Daftar command buatan sendiri', async run(ctx) { const k = Object.keys(obj(ctx.db.raw(), 'customCommands')); await ctx.reply(k.length ? k.map(x => `• ${ctx.prefix}${x}`).join('\n') : 'Belum ada command buatan.'); } }),
  O({ id: 'owner.getcase', name: 'getcase', aliases: ['getcmd'], description: 'Lihat isi command buatan sendiri', usage: '<nama>',
    async run(ctx) { const c = obj(ctx.db.raw(), 'customCommands')[ctx.requireText().toLowerCase()]; if (!c) throw new UsageError('❌ Command tidak ada.'); await ctx.reply(`${c.media ? `[${c.media.kind}] ` : ''}${c.text || ''}`); },
    // Jalankan command buatan: .nama
    async onMessage(ctx) { if (!ctx.m.isCmd || ctx.user.banned) return false; const c = ctx.db.raw().customCommands?.[ctx.m.command]; if (!c || ctx.yannajah.registry.resolve(ctx.m.command)) return false; await sendResponse(ctx, c); return true; } }),

  // ----------------------------------------------------------------- badword
  feature({ id: 'group.addbadword', name: 'addbadword', aliases: ['tambahbadword'], category: 'group', scope: 'group', permission: 'admin', description: 'Tambah kata terlarang grup (pesan berisi kata itu dihapus saat .antibadword on)', usage: '<kata>',
    async run(ctx) { const w = ctx.requireText().toLowerCase().trim().slice(0, 40); const l = arr(ctx.group, 'badwords'); if (l.includes(w)) throw new UsageError(`❌ Kata "${w}" sudah ada!`); if (l.length >= 200) throw new UsageError('Maksimal 200 kata.'); l.push(w); ctx.db.touch(); await ctx.reply(`✅ "${w}" ditambahkan. ${ctx.group.antibadword ? '' : `Aktifkan: ${ctx.prefix}antibadword on`}`); } }),
  feature({ id: 'group.delbadword', name: 'delbadword', aliases: ['hapusbadword'], category: 'group', scope: 'group', permission: 'admin', description: 'Hapus kata terlarang', usage: '<kata>',
    async run(ctx) { const w = ctx.requireText().toLowerCase().trim(); const l = arr(ctx.group, 'badwords'); if (!l.includes(w)) throw new UsageError(`❌ Kata "${w}" tidak ditemukan!`); ctx.group.badwords = l.filter(x => x !== w); ctx.db.touch(); await ctx.reply('✅ Dihapus.'); } }),
  feature({ id: 'group.listbadword', name: 'listbadword', aliases: ['daftarbadword'], category: 'group', scope: 'group', description: 'Daftar kata terlarang grup',
    async run(ctx) { const l = arr(ctx.group, 'badwords'); await ctx.reply(l.length ? `📋 Badwords (${l.length}):\n${l.map((w, i) => `${i + 1}. ${w}`).join('\n')}` : '📭 Belum ada kata terlarang.'); } }),
  feature({ id: 'group.antibadword', name: 'antibadword', aliases: ['antitoxic'], category: 'group', scope: 'group', permission: 'admin', description: 'Hapus otomatis pesan berisi kata terlarang (+ peringatan)', usage: 'on/off',
    async run(ctx) { const v = (ctx.args[0] || '').toLowerCase(); if (!['on', 'off'].includes(v)) return ctx.reply(`Antibadword: *${ctx.group.antibadword ? 'ON' : 'OFF'}*\n${ctx.usage()}`); ctx.group.antibadword = v === 'on'; ctx.db.touch(); await ctx.reply(`✅ Antibadword ${v === 'on' ? 'dinyalakan' : 'dimatikan'}.`); },
    async onMessage(ctx) {
      const m = ctx.m; if (!m.isGroup || !m.body || ctx.isAdmin || ctx.isOwner) return false;
      const g = ctx.db.get(['groups', m.chat]); if (!g?.antibadword || !g.badwords?.length) return false;
      const words = m.body.toLowerCase().split(/[^a-z0-9]+/);
      const hit = g.badwords.find(w => (w.includes(' ') ? m.body.toLowerCase().includes(w) : words.includes(w)));
      if (!hit) return false;
      if (ctx.isBotAdmin) await ctx.yannajah.sendmessage(m.chat, { delete: m.key }).catch(() => {});
      await ctx.reply(`⚠️ ${mention(m.sender)} jaga bahasa ya, pesan berisi kata terlarang.`);
      return true;
    } })
];
