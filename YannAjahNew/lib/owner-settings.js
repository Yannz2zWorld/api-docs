'use strict';
// Pengaturan bot dari chat (V15): renamebot, setmenu/setimg/setaudiomenu, setdaftar, maintenance lokal,
// banfitur per grup, restart & auto restart, auto backup, report/request ke owner, channel, profil.
// Nilai yang diubah disimpan di settings database lokal dan diterapkan ke config saat bot jalan.
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const media = require('../library/mediastore');
const { targetJid, mention } = require('../library/targets');
const { jidUser, toJid } = require('../library/function');
const { loadBaileys } = require('../library/connection');

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

module.exports = { O, sock, onOff, RENAME, applyOverrides, MENU_STYLES, MENU_ALIASES, scheduleRestart, scheduleBackup, toOwner };
