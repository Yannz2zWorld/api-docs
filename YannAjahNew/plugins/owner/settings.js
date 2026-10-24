'use strict';
// Pengaturan bot dari chat (V15): renamebot, setmenu/setimg/setaudiomenu, setdaftar, maintenance lokal,
// banfitur per grup, restart & auto restart, auto backup, report/request ke owner, channel, profil.
// Nilai yang diubah disimpan di settings database lokal dan diterapkan ke config saat bot jalan.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { targetJid, mention } = require('../../library/targets');
const { jidUser, toJid } = require('../../library/function');
const { loadBaileys } = require('../../library/connection');

const O = f => feature({ category: 'owner', permission: 'owner', cooldown: 1, allowInMaintenance: true, ...f });
const sock = ctx => { const s = ctx.yannajah.socket; if (!s) throw new UsageError('Bot belum terhubung.'); return s; };
const onOff = v => (['on', 'off'].includes(String(v).toLowerCase()) ? String(v).toLowerCase() === 'on' : null);
const now = ctx => new Date().toLocaleString('id-ID', { timeZone: ctx.config.bot.timezone });

// renamebot: kunci yang boleh diubah dari chat -> path di config. Nomor owner sengaja tidak
// (owner utama hanya dari settingsbot.js/.env agar tidak bisa diambil alih lewat chat).
const RENAME = {
  namaowner: ['owner', 'name'], botname: ['bot', 'name'], packname: ['bot', 'packname'], author: ['bot', 'author'],
  linkowner: ['links', 'owner'], linkgrup: ['links', 'group'], linksaluran: ['links', 'channel'], idsaluran: ['links', 'channelId'], namasaluran: ['links', 'channelName']
};
function applyOverrides(config, settings) {
  for (const [k, v] of Object.entries(settings.configOverrides || {})) { const p = RENAME[k]; if (p && typeof v === 'string') config[p[0]][p[1]] = v; }
}
let applied = false;

const MENU_STYLES = { text: 'Teks biasa', image: 'Gambar + teks', video: 'Video/GIF + teks', document: 'Dokumen + teks' };
const MENU_ALIASES = { v1: 'image', v2: 'video', v3: 'image', v4: 'document', v5: 'text', v6: 'image', v7: 'text', v8: 'image', v9: 'document', v10: 'video' };

let restartTimer = null;
function scheduleRestart(hours, logger) {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = null;
  if (!hours) return;
  restartTimer = setTimeout(() => { logger?.info?.('Auto restart terjadwal'); process.kill(process.pid, 'SIGTERM'); }, hours * 3600000);
  restartTimer.unref?.();
}
let backupTimer = null;
function scheduleBackup(yannajah, cfg, hours) {
  if (backupTimer) clearInterval(backupTimer);
  backupTimer = null;
  if (!hours) return;
  backupTimer = setInterval(async () => {
    try {
      if (!yannajah.socket) return;
      await yannajah.database.save();
      const buf = Buffer.from(JSON.stringify(yannajah.database.raw(), null, 1));
      await yannajah.sendFile(toJid(cfg.owner.number), { buffer: buf, mime: 'application/json' }, { asDocument: true, fileName: `backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`, caption: '🗄️ Auto backup database bot' });
    } catch { /* coba lagi interval berikutnya */ }
  }, hours * 3600000);
  backupTimer.unref?.();
}

const toOwner = (kind, title) => feature({
  id: `info.${kind}`, name: kind, category: 'info', cooldown: 60, usage: '<pesan>', description: `${title} ke owner bot`,
  async run(ctx) {
    const text = ctx.requireText(`Contoh: ${ctx.prefix}${kind} fitur .menu error`).slice(0, 2000);
    const from = ctx.m.isGroup ? `${ctx.m.groupMetadata?.subject || 'Grup'} (${jidUser(ctx.m.chat)})` : 'Private Chat';
    await ctx.yannajah.sendmessage(toJid(ctx.config.owner.number), { text: `╭一緒 *${title}*\n│୭ ˚.ᵎᵎ Pengirim : ${mention(ctx.m.sender)}\n│୭ ˚.ᵎᵎ Nomor : wa.me/${jidUser(ctx.m.sender)}\n│୭ ˚.ᵎᵎ Asal : ${from}\n│୭ ˚.ᵎᵎ Waktu : ${now(ctx)}\n╰─────────一緒\n\n${text.split('\n').map(l => `> ${l}`).join('\n')}`, mentions: [ctx.m.sender] });
    await ctx.reply(`✅ ${title} terkirim ke owner. Terima kasih!`);
  }
});

module.exports = [
  O({ id: 'owner.renamebot', name: 'renamebot', aliases: ['setconfig'], description: 'Ubah identitas bot: .renamebot <kunci> <nilai>', usage: '<kunci> <nilai>',
    async run(ctx) {
      const key = (ctx.args[0] || '').toLowerCase(); const val = ctx.args.slice(1).join(' ').trim();
      if (!RENAME[key] || !val) return ctx.reply(`╭一緒 *Rename Bot*\n${Object.keys(RENAME).map((k, i) => `│୭ ˚.ᵎᵎ ${i + 1}. ${k} = ${ctx.config[RENAME[k][0]][RENAME[k][1]]}`).join('\n')}\n╰─────────一緒\nContoh: ${ctx.prefix}renamebot botname Yann Bot\nNomor owner utama diatur di settingsbot.js/.env.`);
      const st = ctx.db.settings(); st.configOverrides = { ...(st.configOverrides || {}), [key]: val.slice(0, 200) };
      ctx.db.touch(); applyOverrides(ctx.config, st);
      await ctx.reply(`✅ ${key} diubah menjadi: ${val}`);
    },
    // Terapkan override yang tersimpan sekali saat pesan pertama setelah start.
    async onMessage(ctx) { if (!applied) { applied = true; applyOverrides(ctx.config, ctx.db.settings()); const st = ctx.db.settings(); scheduleRestart(st.autoRestartHours, ctx.logger); scheduleBackup(ctx.yannajah, ctx.config, st.autoBackupHours); } return false; } }),
  O({ id: 'owner.setmenu', name: 'setmenu', description: `Gaya tampilan .menu: ${Object.keys(MENU_STYLES).join('/')} (v1-v10 juga diterima)`, usage: '<gaya>',
    async run(ctx) {
      const v = (ctx.args[0] || '').toLowerCase(); const style = MENU_STYLES[v] ? v : MENU_ALIASES[v];
      if (!style) return ctx.reply(`Gaya menu sekarang: *${ctx.db.settings().menuStyle || 'text'}*\n${Object.entries(MENU_STYLES).map(([k, d]) => `• ${k} — ${d}`).join('\n')}\n${ctx.usage()}`);
      ctx.db.settings().menuStyle = style; ctx.db.touch(); await ctx.reply(`✅ Gaya menu: ${MENU_STYLES[style]}`);
    } }),
  O({ id: 'owner.setimage', name: 'setimg', aliases: ['setimage'], description: 'Ganti gambar/video menu: reply media + .setimg menu|menuvideo|reply (atau .setimg reset)', usage: '<menu|menuvideo|reply|reset>',
    async run(ctx) {
      const type = (ctx.args[0] || '').toLowerCase(); const st = ctx.db.settings(); st.images = st.images || {};
      if (type === 'reset') { const old = Object.values(st.images).map(x => x?.name); st.images = {}; ctx.db.touch(); old.forEach(n => media.release(n, ctx.db)); return ctx.reply('✅ Gambar menu kembali ke bawaan.'); }
      if (!['menu', 'menuvideo', 'reply'].includes(type)) throw new UsageError(`Contoh: reply gambar lalu ${ctx.prefix}setimg menu\nreply video lalu ${ctx.prefix}setimg menuvideo`);
      const md = await media.fromMessage(ctx, { kinds: type === 'menuvideo' ? ['video'] : ['image'] });
      if (!md) throw new UsageError(`Kirim/reply ${type === 'menuvideo' ? 'video' : 'gambar'} dengan caption ${ctx.prefix}setimg ${type}`);
      const old = st.images[type]?.name; st.images[type] = md; ctx.db.touch(); media.release(old, ctx.db);
      await ctx.reply(`✅ Media ${type} diganti.`);
    } }),
  O({ id: 'owner.setaudiomenu', name: 'setaudiomenu', description: 'Audio yang dikirim setelah .menu: reply audio + .setaudiomenu (atau .setaudiomenu off)',
    async run(ctx) {
      const st = ctx.db.settings(); const old = st.menuAudio?.name;
      if ((ctx.args[0] || '').toLowerCase() === 'off') { st.menuAudio = null; ctx.db.touch(); media.release(old, ctx.db); return ctx.reply('✅ Audio menu dimatikan.'); }
      const md = await media.fromMessage(ctx, { kinds: ['audio'] }); if (!md) throw new UsageError(`❌ Reply audio dengan caption: ${ctx.prefix}setaudiomenu`);
      st.menuAudio = md; ctx.db.touch(); media.release(old, ctx.db); await ctx.reply('✅ Audio menu diganti.');
    } }),
  O({ id: 'owner.setdaftar', name: 'setdaftar', aliases: ['setregister'], description: 'Wajib daftar sebelum memakai bot: on/off', usage: 'on/off',
    async run(ctx) { const v = onOff(ctx.args[0]); const st = ctx.db.settings(); if (v === null) return ctx.reply(`📝 *SISTEM DAFTAR*\nStatus: ${(st.registerRequired ?? ctx.config.permission.registerRequired) ? '✅ AKTIF' : '❌ NONAKTIF'}\n${ctx.usage()}`); st.registerRequired = v; ctx.db.touch(); await ctx.reply(v ? '✅ Sistem daftar AKTIF\nUser baru harus daftar.' : '✅ Sistem daftar NONAKTIF'); } }),
  O({ id: 'owner.maintenance', name: 'maintenance', aliases: ['mt'], description: 'Maintenance bot (lokal): on [pesan] / off / status. Maintenance dari dashboard tetap berlaku terpisah', usage: 'on [pesan]|off|status',
    async run(ctx) {
      const st = ctx.db.settings(); const mode = (ctx.args[0] || '').toLowerCase();
      if (['on', 'aktif', '1'].includes(mode)) { st.maintenance = { active: true, message: ctx.args.slice(1).join(' ').slice(0, 300) || 'Bot sedang maintenance, coba lagi nanti.', since: Date.now() }; ctx.db.touch(); return ctx.reply(`🔧 Maintenance AKTIF\nPesan: ${st.maintenance.message}`); }
      if (['off', 'nonaktif', '0'].includes(mode)) { st.maintenance = { active: false }; ctx.db.touch(); return ctx.reply('✅ Maintenance dimatikan.'); }
      const d = ctx.yannajah.auth?.maintenance?.() || {};
      await ctx.reply(`╭─🔧 *Maintenance*\n│ Lokal : ${st.maintenance?.active ? `AKTIF — ${st.maintenance.message}` : 'nonaktif'}\n│ Dashboard : ${d.active ? `AKTIF — ${d.message}` : 'nonaktif'}\n╰─ ${ctx.usage()}`);
    } }),
  feature({ id: 'group.banfitur', name: 'banfitur', category: 'group', scope: 'group', permission: 'admin', description: 'Larang command tertentu di grup ini: .banfitur <cmd> | .banfitur del <cmd> | .banfitur', usage: '[del] <command>',
    async run(ctx) {
      const g = ctx.group; g.bannedFeatures = Array.isArray(g.bannedFeatures) ? g.bannedFeatures : [];
      if (!ctx.args.length) return ctx.reply(`🚫 *BANNED FEATURES*\n\n${g.bannedFeatures.length ? g.bannedFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n') : '❌ Tidak ada'}\n\n${ctx.prefix}banfitur <cmd>\n${ctx.prefix}banfitur del <cmd>`);
      const del = ['del', 'hapus', 'unban'].includes(ctx.args[0].toLowerCase());
      const f = ctx.yannajah.registry.resolve((del ? ctx.args[1] : ctx.args[0]) || '');
      if (!f) throw new UsageError('Command tidak ditemukan.');
      if (['banfitur', 'menu'].includes(f.name) || f.category === 'owner') throw new UsageError('Command itu tidak bisa dilarang.');
      g.bannedFeatures = g.bannedFeatures.filter(x => x !== f.name); if (!del) g.bannedFeatures.push(f.name);
      ctx.db.touch(); await ctx.reply(del ? `✅ ${f.name} boleh dipakai lagi.` : `🚫 ${f.name} dilarang di grup ini.`);
    } }),
  O({ id: 'owner.cleardb', name: 'cleardb', aliases: ['resetdb', 'rstdb'], description: 'Kosongkan database lokal bot (user, grup, data fitur). Wajib: .cleardb confirm', usage: 'confirm',
    async run(ctx) {
      if (ctx.args[0] !== 'confirm') throw new UsageError(`⚠️ Ini menghapus SEMUA data lokal (user, limit, saldo, grup, list, sewa...).\nBackup dulu: ${ctx.prefix}backupdb\nLanjut: ${ctx.prefix}cleardb confirm`);
      await ctx.db.save();
      const keep = { settings: ctx.db.raw().settings, owners: ctx.db.raw().owners };
      for (const k of Object.keys(ctx.db.raw())) delete ctx.db.raw()[k];
      Object.assign(ctx.db.raw(), require('../../source/database').DEFAULTS(), keep);
      ctx.db.touch(); await ctx.db.save();
      await ctx.reply('🗑️ Database lokal dikosongkan (pengaturan & owner tambahan dipertahankan).');
    } }),
  O({ id: 'owner.restart', name: 'restart', aliases: ['rst'], description: 'Restart bot (pm2 menyalakan lagi otomatis)',
    async run(ctx) { await ctx.reply('♻️ Memproses restart...'); await ctx.db.save(); setTimeout(() => process.kill(process.pid, 'SIGTERM'), 1500).unref?.(); } }),
  O({ id: 'owner.setrestart', name: 'setrestart', aliases: ['autorestart'], description: 'Restart otomatis tiap N jam (0 = mati)', usage: '<jam>',
    async run(ctx) {
      const st = ctx.db.settings(); const h = Number(ctx.args[0]);
      if (!ctx.args.length || !Number.isInteger(h) || h < 0 || h > 168) return ctx.reply(`*⚙️ Auto Restart*\nStatus: ${st.autoRestartHours ? `tiap ${st.autoRestartHours} jam` : 'nonaktif'}\n${ctx.prefix}setrestart 6 (tiap 6 jam)\n${ctx.prefix}setrestart 0 (matikan)`);
      st.autoRestartHours = h; ctx.db.touch(); scheduleRestart(h, ctx.logger);
      await ctx.reply(h ? `✅ Bot restart otomatis tiap ${h} jam.` : '✅ Auto restart dimatikan.');
    } }),
  O({ id: 'owner.autobackup', name: 'autobackup', description: 'Kirim backup database ke owner tiap N jam (0 = mati)', usage: '<jam>',
    async run(ctx) {
      const st = ctx.db.settings(); const h = Number(ctx.args[0]);
      if (!ctx.args.length || !Number.isInteger(h) || h < 0 || h > 168) return ctx.reply(`🗄️ Auto backup: ${st.autoBackupHours ? `tiap ${st.autoBackupHours} jam` : 'nonaktif'}\n${ctx.prefix}autobackup 24 | ${ctx.prefix}autobackup 0`);
      st.autoBackupHours = h; ctx.db.touch(); scheduleBackup(ctx.yannajah, ctx.config, h);
      await ctx.reply(h ? `✅ Backup dikirim ke chat owner tiap ${h} jam.` : '✅ Auto backup dimatikan.');
    } }),
  O({ id: 'owner.autoreactsw', name: 'autoreactsw', aliases: ['autoreadsw'], description: 'Otomatis baca & beri reaksi status WhatsApp kontak', usage: 'on/off [emoji]',
    async run(ctx) { const v = onOff(ctx.args[0]); const st = ctx.db.settings(); if (v === null) return ctx.reply(`Auto read & react SW: *${st.autoReactSw ? 'ON' : 'OFF'}*\n${ctx.usage()}`); st.autoReactSw = v; if (ctx.args[1]) st.autoReactEmoji = [...ctx.args[1]].slice(0, 2).join(''); ctx.db.touch(); await ctx.reply(`✅ Auto Read & React SW ${v ? 'AKTIF' : 'NONAKTIF'}`); } }),
  O({ id: 'owner.autosambut', name: 'autosambut', aliases: ['sambutowner'], description: 'Bot menyambut owner saat owner chat di grup (cooldown menit)', usage: 'on/off/set <menit>',
    async run(ctx) {
      const st = ctx.db.settings(); const c = st.sambutOwner = st.sambutOwner || { enabled: false, cooldown: 15 };
      const a = (ctx.args[0] || '').toLowerCase();
      if (a === 'set' && Number(ctx.args[1]) >= 1) c.cooldown = Math.min(Number(ctx.args[1]), 1440);
      else if (onOff(a) !== null) c.enabled = onOff(a);
      else return ctx.reply(`⚙️ Auto Sambut Owner\nStatus: ${c.enabled ? 'ON' : 'OFF'}\nCooldown: ${c.cooldown} menit\n\n${ctx.prefix}sambutowner on/off/set <menit>`);
      ctx.db.touch(); await ctx.reply(`✅ Auto sambut owner ${c.enabled ? 'AKTIF' : 'NONAKTIF'} (cooldown ${c.cooldown} menit).`);
    },
    async onMessage(ctx) {
      const c = ctx.db.settings().sambutOwner;
      if (!c?.enabled || !ctx.m.isGroup || !ctx.isOwner || ctx.m.fromMe) return false;
      const g = ctx.db.group(ctx.m.chat);
      if (g.lastSambut && Date.now() - g.lastSambut < c.cooldown * 60000) return false;
      g.lastSambut = Date.now(); ctx.db.touch();
      await ctx.reply(`👑 Selamat datang owner ${ctx.config.owner.name}! Bot siap melayani.`);
      return false;
    } }),

  // ----------------------------------------------------------------- report / request ke owner
  toOwner('report', 'Laporan dari User'),
  toOwner('req', 'Request Fitur'),
  toOwner('error', 'Report Error'),

  // ----------------------------------------------------------------- channel & profil
  O({ id: 'owner.upchannel', name: 'upchannel', aliases: ['upch', 'kirimch', 'upchannel2'], description: 'Kirim teks/media ke channel bot (links.channelId)', usage: '<teks> (atau reply media)',
    async run(ctx) {
      const ch = ctx.config.links.channelId; if (!/@newsletter$/.test(ch || '')) throw new UsageError('ID channel belum diatur (renamebot idsaluran ...@newsletter).');
      const md = ctx.media();
      if (md) await ctx.yannajah.sendFile(ch, await md.download(), { caption: ctx.text || ctx.m.quoted?.text || '' });
      else await ctx.yannajah.sendmessage(ch, { text: ctx.requireText() });
      await ctx.reply('✅ Berhasil dikirim ke channel.');
    } }),
  feature({ id: 'info.idch', name: 'idch', aliases: ['cekidch'], category: 'tools', description: 'Info & ID channel WhatsApp dari link', usage: '<link channel>', limit: 1,
    async run(ctx) {
      const code = /whatsapp\.com\/channel\/([A-Za-z0-9]+)/.exec(ctx.text || '')?.[1]; if (!code) throw new UsageError('❌ Link channel tidak valid!');
      const r = await sock(ctx).newsletterMetadata('invite', code).catch(() => null); if (!r) throw new UsageError('❌ Gagal mengambil data channel!');
      const t = r.thread_metadata || r;
      await ctx.reply(`╔──☉ *CHANNEL INFO*\n│✎ *ID* : ${r.id}\n│✎ *Nama* : ${t.name?.text || r.name || '-'}\n│✎ *Followers* : ${t.subscribers_count || r.subscribers || 0}\n│✎ *Verified* : ${(t.verification || r.verification) === 'VERIFIED' ? 'Ya' : 'Tidak'}\n╚────────────☉`);
    } }),
  feature({ id: 'tools.getpp', name: 'getpp', aliases: ['getprofile'], category: 'tools', description: 'Ambil foto profil WhatsApp (tag/reply/nomor)', usage: '<@tag|nomor>', limit: 1,
    async run(ctx) {
      const j = targetJid(ctx, { self: true });
      const url = await sock(ctx).profilePictureUrl(j, 'image').catch(() => null);
      if (!url) throw new UsageError(`❌ Foto profil ${mention(j)} tidak ada atau disembunyikan.`);
      await ctx.sendFile(url, { caption: `📸 Foto profil ${mention(j)}` });
    } }),
  O({ id: 'owner.setpppanjang', name: 'setpppanjang', aliases: ['setpppanjangbot', 'setppfull', 'setbotpp'], description: 'Ganti foto profil bot tanpa crop persegi (reply gambar)',
    async run(ctx) {
      const md = ctx.media(); if (!md || !/image\/(jpe?g|png)/.test(md.mime)) throw new UsageError('Kirim/reply gambar JPG/PNG.');
      const { Jimp } = require('jimp');
      const img = await Jimp.read(await md.download());
      img.scaleToFit({ w: 720, h: 720 });
      const jpg = await img.getBuffer('image/jpeg');
      const B = await loadBaileys(); const s = sock(ctx);
      // Sama dengan sock.updateProfilePicture untuk akun sendiri, tapi tanpa crop persegi.
      await s.query({ tag: 'iq', attrs: { to: B.S_WHATSAPP_NET, type: 'set', xmlns: 'w:profile:picture' }, content: [{ tag: 'picture', attrs: { type: 'image' }, content: jpg }] });
      await ctx.reply('✅ Foto profil bot diganti (tanpa crop).');
    } }),
  O({ id: 'owner.clearchat', name: 'clearchat', aliases: ['clc'], description: 'Hapus chat ini dari WhatsApp bot',
    async run(ctx) { await sock(ctx).chatModify({ delete: true, lastMessages: [{ key: ctx.m.key, messageTimestamp: ctx.m.timestamp }] }, ctx.m.chat); } }),
  O({ id: 'owner.save', name: 'save', aliases: ['sv'], scope: 'private', description: 'Kirim kartu kontak lawan chat (untuk disimpan)',
    async run(ctx) { const n = jidUser(ctx.m.chat); await ctx.yannajah.sendmessage(ctx.m.chat, { contacts: { displayName: n, contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${n}\nTEL;type=CELL;waid=${n}:+${n}\nEND:VCARD` }] } }, { quoted: ctx.m.raw }); } }),
  feature({ id: 'group.swgc', name: 'swgc', aliases: ['statusgrup'], category: 'group', scope: 'group', permission: 'admin', description: 'Buat status grup dari teks/gambar/video (reply media + caption)', usage: '<teks>',
    async run(ctx) {
      const md = ctx.media(); if (!md && !ctx.text) throw new UsageError(`Contoh: reply gambar lalu ${ctx.prefix}swgc caption`);
      const B = await loadBaileys(); const s = sock(ctx);
      const content = md ? { [/video/.test(md.mime) ? 'video' : /audio/.test(md.mime) ? 'audio' : 'image']: await md.download(), caption: ctx.text } : { text: ctx.text };
      const msg = await B.generateWAMessageContent(content, { upload: s.waUploadToServer });
      await s.relayMessage(ctx.m.chat, { groupStatusMessageV2: { message: msg } }, {});
      await ctx.reply('✅ Status grup dibuat.');
    } }),
  feature({ id: 'group.setintro', name: 'setintro', category: 'group', scope: 'group', permission: 'admin', description: 'Atur template .intro grup', usage: '<template>',
    async run(ctx) { ctx.group.introTemplate = ctx.requireText('Format: .setintro <template>\nContoh: .setintro ╔──☉ INTRO\n│ ✧ Nama: •••\n╚───☉').slice(0, 2000); ctx.db.touch(); await ctx.reply('✅ Template intro disimpan.'); } }),
  feature({ id: 'group.intro', name: 'intro', category: 'group', scope: 'group', description: 'Tampilkan template perkenalan member grup',
    async run(ctx) { await ctx.reply(ctx.group.introTemplate || '╔──☉ INTRO MEMBER\n│ ✦ Nama: •••\n│ ✦ Umur: •••\n│ ✦ Gender: •••\n│ ✦ Askot: •••\n╚────────────☉'); } }),
  feature({ id: 'tools.ambilsw', name: 'ambilsw', aliases: ['sw'], category: 'tools', limit: 1, description: 'Simpan gambar/video dari status WhatsApp yang kamu reply',
    async run(ctx) {
      const q = ctx.m.quoted; if (!q?.isMedia || !/image|video/.test(q.mime)) throw new UsageError('📌 Balas status gambar/video yang ingin diambil!');
      await ctx.sendFile(await q.download(), { caption: q.text || '' });
    } }),
  feature({ id: 'tools.copy', name: 'copy', aliases: ['salin'], category: 'tools', description: 'Salin teks pesan yang di-reply (nomor & link dipisah agar mudah disalin)',
    async run(ctx) {
      const t = ctx.m.quoted?.text; if (!t) throw new UsageError('⚠️ Reply pesan *teks* lalu ketik .copy');
      const blue = t.match(/(\+?628\d{8,13}|08\d{8,13}|https?:\/\/\S+)/g);
      await ctx.reply(t);
      if (blue?.length) await ctx.reply(blue.join('\n'));
    } })
];
module.exports.applyOverrides = applyOverrides;
