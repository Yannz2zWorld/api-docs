'use strict';
// Event WhatsApp (seperti handler.js V15). Alur pesan:
//   messages.upsert -> source/message.js (serializer jadi `m`) -> yannai-cmd.js (router) -> plugins/**
// Event grup: welcome / left (teks per grup, lib/welcome.js). Semuanya mati kalau lisensi terkunci.

const { serialize } = require('./source/message');
const { createRouter } = require('./yannai-cmd');
const { render, DEFAULT_WELCOME, DEFAULT_LEFT } = require('./lib/welcome');

function createGroupHandler(yannajah, { logger }) {
  return async function onParticipants(ev) {
    try {
      if (!yannajah.auth.isActive() || yannajah.auth.maintenance().active) return;
      const g = yannajah.database.get(['groups', ev.id]);
      if (!g) return;
      const action = ev.action;
      if (!((action === 'add' && g.welcome) || (action === 'remove' && g.left))) return;
      const meta = await yannajah.socket.groupMetadata(ev.id).catch(() => null);
      for (const p of ev.participants || []) {
        const jid = typeof p === 'string' ? p : p.phoneNumber || p.id;
        const text = render(action === 'add' ? g.welcomeText || DEFAULT_WELCOME : g.leftText || DEFAULT_LEFT, { user: jid, group: meta?.subject || 'grup', desc: meta?.desc || '', count: meta?.participants?.length || 0 });
        await yannajah.sendmessage(ev.id, { text, mentions: [jid] });
      }
    } catch (e) { logger.warn('group-participants handler error', e.message); }
  };
}

// Pasang semua event pesan & grup ke koneksi WhatsApp. Dipanggil sekali oleh yannajah.js.
function initializerHandler(yannajah, { config, logger, wa, store, license, B }) {
  const route = createRouter(yannajah, { config, logger: logger.child('router') });
  const groupMetadata = jid => wa.groupCache.get(jid) ? Promise.resolve(wa.groupCache.get(jid)) : wa.sock.groupMetadata(jid).then(md => { wa.groupCache.set(jid, md); return md; });

  wa.on('messages', async ev => {
    if (ev.type !== 'notify') return;
    for (const raw of ev.messages || []) {
      try {
        const settings = store.data.settings;
        // .autoreactsw: baca & beri reaksi status kontak (tidak diproses sebagai command).
        if (raw.key?.remoteJid === 'status@broadcast') {
          if (settings.autoReactSw && raw.message && !raw.key.fromMe && raw.key.participant && license.isActive()) {
            wa.sock.readMessages([raw.key]).catch(() => {});
            wa.sock.sendMessage('status@broadcast', { react: { text: settings.autoReactEmoji || '💚', key: raw.key } }, { statusJidList: [raw.key.participant] }).catch(() => {});
          }
          continue;
        }
        if (!raw.message || raw.message.protocolMessage) continue;
        if (settings.autoread ?? config.chat.autoRead) wa.sock.readMessages([raw.key]).catch(() => {});
        const m = await serialize(wa.sock, raw, { B, groupMetadata, prefixes: settings.prefix?.length ? settings.prefix : config.prefix.list, allowNoPrefix: config.prefix.allowNoPrefix });
        if (config.chat.logMessageContent) logger.debug('pesan', { chat: m.chat, cmd: m.command });
        if ((settings.autotyping ?? config.chat.autoTyping) && m.isCmd) wa.sock.sendPresenceUpdate('composing', m.chat).catch(() => {});
        await route(m);
      } catch (e) { logger.error('Gagal memproses pesan', e.message); }
    }
  });
  wa.on('group-participants', createGroupHandler(yannajah, { logger }));
  return { route };
}

module.exports = { initializerHandler, createGroupHandler };
