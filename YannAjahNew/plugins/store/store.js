'use strict';
// Fitur toko grup V15: list produk (addlist/list/dellist/updatelist/setlist + ketik nama item),
// payment per grup (addpay/pay/listpay/delpay + ketik keyword), template proses/done, testimoni, donasi.
// Semua data per grup di database lokal (groups[jid].store); media disimpan lewat library/mediastore.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { canvas, fit, font, roundRect, png } = require('../../library/canvas');
const { jidUser } = require('../../library/function');

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

const orderPair = (kind, status, emoji) => [
  A({ id: `store.set${kind}`, name: `set${kind}`, description: `Atur template pesan .${kind} (variabel: @tanggal @jam @status @item @user @group)`, usage: '<template>',
    async run(ctx) {
      const s = store(ctx);
      s[`${kind}Template`] = ctx.requireText(`Format: ${ctx.prefix}set${kind} <template>\nVariabel: @tanggal @jam @status @item @user @group`).slice(0, 3000);
      ctx.db.touch();
      await ctx.reply(`✅ Template .${kind} disimpan.\n\n📋 Preview:\n${renderOrder(ctx, s[`${kind}Template`], status, 'AM12', ctx.m.sender).text}`);
    } }),
  A({ id: `store.${kind}`, name: kind, description: `Kirim pesan ${status.toLowerCase()} ke pembeli (reply pesan pembeli): .${kind} <item>`, usage: '[item]',
    async run(ctx) {
      const tpl = store(ctx)[`${kind}Template`] || `${emoji} *${status.toUpperCase()}*\n\n📆 @tanggal\n⏰ @jam\n👤 @user\n📦 @item\n✨ Status: @status`;
      if (!ctx.m.quoted) throw new UsageError(`Reply pesan pembeli. Contoh: ${ctx.prefix}${kind} AM12`);
      const r = renderOrder(ctx, tpl, status, ctx.text || 'Produk', ctx.m.quoted.sender);
      await ctx.yannajah.sendmessage(ctx.m.chat, r, { quoted: { key: ctx.m.quoted.key, message: ctx.m.quoted.message } });
    } })
];

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

module.exports = [
  // ----------------------------------------------------------------- list produk
  A({ id: 'store.addlist', name: 'addlist', description: 'Tambah item list grup: .addlist nama|deskripsi (boleh kirim/reply gambar, video, audio, stiker)', usage: '<nama>|<deskripsi>',
    async run(ctx) {
      const [name, ...rest] = ctx.requireText().split('|');
      const desc = rest.join('|').trim();
      if (!name?.trim() || !desc) throw new UsageError(`Format: ${ctx.prefix}addlist Burger|Burger dengan keju`);
      const s = store(ctx);
      if (s.items.length >= MAX_ITEMS) throw new UsageError(`Maksimal ${MAX_ITEMS} item per grup.`);
      if (s.items.some(i => i.name.toLowerCase() === name.trim().toLowerCase())) throw new UsageError(`Item "${name.trim()}" sudah ada. Pakai ${ctx.prefix}updatelist.`);
      s.items.push({ name: name.trim().slice(0, 80), desc: desc.slice(0, 4000), media: await media.fromMessage(ctx), by: ctx.m.sender, at: Date.now() });
      ctx.db.touch();
      await ctx.reply(`✅ Item "${name.trim()}" berhasil ditambahkan!`);
    } }),
  S({ id: 'store.list', name: 'list', aliases: ['daftarlist', 'store'], description: 'Tampilkan list item grup (ketik nama item untuk detail)',
    async run(ctx) {
      const s = store(ctx);
      if (!s.items.length) return ctx.reply(`╭一緒 List\n│୭ ˚.ᵎᵎ Status : Belum ada item\n│୭ ˚.ᵎᵎ Tambah : ${ctx.prefix}addlist nama|deskripsi\n╰─────────一緒`);
      const text = renderList(ctx, s);
      const c = s.templateMedia ? media.content(s.templateMedia, text) : null;
      await ctx.yannajah.sendmessage(ctx.m.chat, c || { text }, { quoted: ctx.m.raw });
    },
    // Ketik nama item persis -> kirim detailnya (V15). Juga keyword payment.
    async onMessage(ctx) {
      const m = ctx.m;
      if (!m.isGroup || m.isCmd || m.fromMe || !m.body || m.body.length > 80) return false;
      const g = ctx.db.get(['groups', m.chat]);
      const key = m.body.toLowerCase().trim();
      const item = g?.store?.items?.find(i => i.name.toLowerCase() === key);
      if (item) { await sendEntry(ctx, item, item.desc); return true; }
      const pay = g?.store?.payments?.[key];
      if (pay) { await sendEntry(ctx, pay, pay.text); return true; }
      return false;
    } }),
  A({ id: 'store.dellist', name: 'dellist', description: 'Hapus item list (nama atau nomor urut)', usage: '<nama|nomor>',
    async run(ctx) {
      const s = store(ctx); const i = findItem(s.items, ctx.requireText());
      if (i < 0) throw new UsageError(`❌ Item "${ctx.text}" tidak ditemukan`);
      const [it] = s.items.splice(i, 1); ctx.db.touch(); media.release(it.media?.name, ctx.db);
      await ctx.reply(`✅ Item "${it.name}" berhasil dihapus!`);
    } }),
  A({ id: 'store.updatelist', name: 'updatelist', aliases: ['editlist'], description: 'Ubah deskripsi item: .updatelist nama|deskripsi baru (kirim/reply media untuk ganti media)', usage: '<nama>|<deskripsi>',
    async run(ctx) {
      const [name, ...rest] = ctx.requireText().split('|');
      const desc = rest.join('|').trim();
      if (!desc) throw new UsageError(`Format: ${ctx.prefix}updatelist Burger|Deskripsi baru`);
      const s = store(ctx); const i = findItem(s.items, name);
      if (i < 0) throw new UsageError(`❌ Item "${name.trim()}" tidak ditemukan`);
      const it = s.items[i]; it.desc = desc.slice(0, 4000);
      const md = await media.fromMessage(ctx);
      if (md) { const old = it.media?.name; it.media = md; ctx.db.touch(); media.release(old, ctx.db); }
      ctx.db.touch();
      await ctx.reply(`✅ Item "${it.name}" berhasil diperbarui!`);
    } }),
  A({ id: 'store.setlist', name: 'setlist', description: 'Atur template .list (variabel @name @group @time @date @fulldate @daytime @x, baris "@prefix <simbol>")', usage: '<template>',
    async run(ctx) {
      if (!ctx.text) return ctx.reply(`╭一緒 Variabel tersedia\n│୭ ˚.ᵎᵎ @name - Nama user\n│୭ ˚.ᵎᵎ @group - Nama grup\n│୭ ˚.ᵎᵎ @time - Waktu (HH:mm:ss)\n│୭ ˚.ᵎᵎ @date - Tanggal (DD/MM/YYYY)\n│୭ ˚.ᵎᵎ @fulldate - Hari, Tanggal Bulan Tahun\n│୭ ˚.ᵎᵎ @daytime - Pagi/Siang/Sore/Malam\n│୭ ˚.ᵎᵎ @x - Daftar item\n│୭ ˚.ᵎᵎ @prefix teks - Simbol depan item\n╰─────────一緒\n\nContoh:\n${ctx.prefix}setlist ╭一緒 List Produk @group\n│ Customer : @name\n│ @x\n╰───\n@prefix │୭`);
      const s = store(ctx);
      s.template = ctx.text.slice(0, 4000);
      s.listPrefix = (/@prefix\s+([^\n]+)/i.exec(ctx.text) || [])[1]?.trim() || null;
      const old = s.templateMedia?.name;
      s.templateMedia = await media.fromMessage(ctx, { kinds: ['image'] });
      ctx.db.touch(); if (old && old !== s.templateMedia?.name) media.release(old, ctx.db);
      await ctx.reply('✅ Template list berhasil disimpan!');
    } }),
  A({ id: 'store.clearlist', name: 'clearlist', description: 'Hapus semua item list grup ini',
    async run(ctx) {
      const s = store(ctx); const n = s.items.length;
      if (!n) throw new UsageError('❌ Tidak ada item di list untuk dibersihkan.');
      const names = s.items.map(i => i.media?.name); s.items = []; ctx.db.touch(); names.forEach(x => media.release(x, ctx.db));
      await ctx.reply(`✅ Berhasil membersihkan *${n} item* dari list grup ini!`);
    } }),
  A({ id: 'store.resetlist', name: 'resetlist', description: 'Kembalikan template .list ke bawaan',
    async run(ctx) { const s = store(ctx); const old = s.templateMedia?.name; s.template = null; s.listPrefix = null; s.templateMedia = null; ctx.db.touch(); media.release(old, ctx.db); await ctx.reply('✅ Template list berhasil direset ke default!'); } }),

  // ----------------------------------------------------------------- payment
  A({ id: 'store.addpay', name: 'addpay', aliases: ['setpay'], description: 'Tambah metode bayar grup: .addpay dana|DANA 0812xxx a.n. Budi (boleh kirim/reply gambar QR)', usage: '<keyword>|<teks>',
    async run(ctx) {
      const [k, ...rest] = ctx.requireText().split('|');
      const key = k.trim().toLowerCase(); const text = rest.join('|').trim();
      if (!/^[a-z0-9 _-]{1,30}$/.test(key) || !text) throw new UsageError(`Format: ${ctx.prefix}addpay dana|DANA 0812xxxx a.n. Nama`);
      const s = store(ctx);
      if (Object.keys(s.payments).length >= 20 && !s.payments[key]) throw new UsageError('Maksimal 20 payment per grup.');
      const old = s.payments[key]?.media?.name;
      s.payments[key] = { text: text.slice(0, 2000), media: await media.fromMessage(ctx, { kinds: ['image'] }), by: ctx.m.sender, at: Date.now() };
      ctx.db.touch(); if (old) media.release(old, ctx.db);
      await ctx.reply(`✅ Payment "${key}" disimpan. Member cukup ketik *${key}* atau ${ctx.prefix}pay.`);
    } }),
  S({ id: 'store.pay', name: 'pay', aliases: ['payment'], description: 'Tampilkan semua metode pembayaran grup',
    async run(ctx) {
      const pays = Object.entries(store(ctx).payments);
      if (!pays.length) {
        const p = ctx.config.payment;
        const lines = [p.dana && `💳 *DANA*: ${p.dana}`, p.gopay && `💳 *GOPAY*: ${p.gopay}`].filter(Boolean);
        if (!lines.length && !p.qris) throw new UsageError(`📭 Belum ada payment. Admin: ${ctx.prefix}addpay dana|...`);
        return p.qris ? ctx.sendFile(p.qris, { caption: `💰 *PAYMENT*\n\n${lines.join('\n') || 'Scan QRIS di atas.'}` }) : ctx.reply(`💰 *PAYMENT*\n\n${lines.join('\n')}`);
      }
      for (const [, v] of pays) await sendEntry(ctx, v, v.text);
    } }),
  S({ id: 'store.listpay', name: 'listpay', description: 'Daftar keyword payment grup',
    async run(ctx) { const k = Object.keys(store(ctx).payments); await ctx.reply(k.length ? `📋 DAFTAR PAYMENT\n\n${k.map(x => `• ${x}`).join('\n')}\n\nTotal: ${k.length} payment` : '📭 Tidak ada payment di grup ini'); } }),
  A({ id: 'store.delpay', name: 'delpay', description: 'Hapus payment grup', usage: '<keyword>',
    async run(ctx) { const s = store(ctx); const k = ctx.requireText().toLowerCase(); const v = s.payments[k]; if (!v) throw new UsageError(`❌ Payment "${k}" tidak ditemukan`); delete s.payments[k]; ctx.db.touch(); media.release(v.media?.name, ctx.db); await ctx.reply(`✅ Payment "${k}" dihapus`); } }),

  // ----------------------------------------------------------------- proses / done
  ...orderPair('proses', 'Proses', '⏳'),
  ...orderPair('done', 'Selesai', '✅'),

  // ----------------------------------------------------------------- testimoni & donasi
  feature({ id: 'store.testimoni', name: 'testimoni', aliases: ['testi'], category: 'store', limit: 1, cooldown: 10, description: 'Buat kartu testimoni: .testimoni nama|produk|harga', usage: '<nama>|<produk>|<harga>',
    async run(ctx) {
      const [nama, produk, harga] = ctx.requireText().split('|').map(x => x?.trim());
      if (!nama || !produk || !harga) throw new UsageError(`Format: ${ctx.prefix}testimoni Budi|Premium Bot|Rp5.000`);
      const t = now(ctx.config.bot.timezone);
      const img = await testimoniCard({ nama: nama.slice(0, 60), produk: produk.slice(0, 80), harga: harga.slice(0, 40), tanggal: t.full, toko: ctx.config.bot.name });
      await ctx.sendFile({ buffer: img, mime: 'image/png' }, { caption: `✅ Testimoni ${nama}` });
    },
    _card: testimoniCard }),
  feature({ id: 'store.donate', name: 'donate', aliases: ['donasi'], category: 'info', description: 'Info donasi (QRIS dari settingsbot.js)',
    async run(ctx) {
      const text = ' ╼ ׅ ֹ𔖰᷼𔖮 *DONASI*\n╭╼─┈───┈─一緒╼\n│୭ ˚.ᵎᵎ Dukung bot ini\n│୭ ˚.ᵎᵎ Jika merasa terbantu,\n│୭ ˚.ᵎᵎ pertimbangkan donasi\n╰─╼𔕬─┈───┈───┈\nScan QRIS untuk berdonasi. Terima kasih!';
      if (ctx.config.payment.qris) await ctx.sendFile(ctx.config.payment.qris, { caption: text }); else await ctx.reply(text);
    } })
];
