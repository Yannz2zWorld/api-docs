'use strict';
// Skenario multi-command: satu database bersama, socket tiruan, semua pesan keluar ditangkap.
// Dipakai test fitur yang menyimpan state (list, sewa, redeem, respon, warn, ...).
const { UsageError } = require('../../library/errors');
const { createDatabaseFacade } = require('../../yannajah');
const { loadRegistry, freshStore } = require('./feature-harness');

const GROUP = '120363000000000001@g.us';
const OWNER = '6281200000001@s.whatsapp.net';

function createScenario({ registry = loadRegistry().registry, config = require('../../settingsbot.js') } = {}) {
  const store = freshStore();
  const db = createDatabaseFacade(store, { dailyLimit: 10, timezone: config.bot.timezone });
  const sent = [];
  const calls = [];
  const socket = new Proxy({ user: { id: '6289900000000:1@s.whatsapp.net' } }, {
    get(t, k) {
      if (k in t) return t[k];
      return async (...a) => { calls.push([k, ...a]); return t.__results?.[k]; };
    }
  });
  const yannajah = {
    registry, database: db, socket, api: null, health: () => ({ features: registry.features.size, uptime_s: 1, memory_mb: 1 }),
    auth: { isActive: () => true, maintenance: () => ({ active: false }) },
    sendmessage: async (jid, content) => { sent.push({ jid, content }); return { key: { id: 'OUT' } }; },
    sendFile: async (jid, input, opts) => { sent.push({ jid, file: input, opts }); },
    plugins: { disable() {}, enable() {} }
  };

  function message({ text = '', from = OWNER, group = false, quoted = null, mentions = [], media = null, participants = [], keyId = null }) {
    const prefix = text.startsWith('.') ? '.' : '';
    const body = prefix ? text.slice(1) : text;
    const [cmd, ...args] = body.split(/\s+/);
    return {
      chat: group ? GROUP : from, sender: from, senderNumber: from.split('@')[0], isGroup: group, fromMe: false,
      isCmd: Boolean(prefix), command: prefix ? cmd.toLowerCase() : '', prefix, args: prefix ? args.filter(Boolean) : [], text: prefix ? body.slice(cmd.length).trim() : text, body: text,
      quoted, pushName: 'Tester', key: { id: keyId || `IN${sent.length}`, remoteJid: group ? GROUP : from }, raw: {}, mentionedJid: mentions,
      timestamp: Math.floor(Date.now() / 1000), isMedia: Boolean(media), mime: media?.mime || '',
      groupMetadata: group ? { id: GROUP, subject: 'Grup Tes', participants } : null,
      getMedia: () => media
    };
  }

  function context(m, feature, flags) {
    const ctx = {
      m, yannajah, feature, config, logger: { info() {}, warn() {}, error() {}, debug() {} },
      command: m.command, args: m.args, text: m.text, prefix: '.', ...flags, db, api: null,
      user: db.user(m.sender), group: m.isGroup ? db.group(m.chat) : null,
      reply: async c => sent.push({ jid: m.chat, content: typeof c === 'string' ? { text: c } : c }),
      react: async () => {},
      sendFile: async (input, opts = {}) => sent.push({ jid: m.chat, file: input, opts }),
      usage: () => `Contoh: .${m.command}${feature.usage ? ' ' + feature.usage : ''}`,
      requireText(msg) { if (!ctx.text) throw new UsageError(msg || 'Teksnya mana?'); return ctx.text; },
      media: () => m.getMedia()
    };
    return ctx;
  }

  // Jalankan seperti router: hook dulu, lalu command. Mengembalikan teks balasan yang baru.
  async function send(opts) {
    const m = message(opts);
    const isOwner = m.sender === OWNER || opts.owner === true;
    const flags = { isOwner, isPremium: isOwner || db.isPremium(m.sender), isAdmin: Boolean(opts.admin), isBotAdmin: opts.botAdmin !== false };
    const before = sent.length;
    for (const f of registry.features.values()) {
      if (typeof f.onMessage !== 'function') continue;
      if (await f.onMessage(context(m, f, flags))) return out(before);
    }
    if (m.isCmd) {
      const f = registry.resolve(m.command);
      if (!f) return out(before);
      if (f.status === 'planned') { sent.push({ jid: m.chat, content: { text: `PLANNED ${f.name}` } }); return out(before); }
      if (f.permission === 'owner' && !isOwner) { sent.push({ jid: m.chat, content: { text: 'DENIED owner' } }); return out(before); }
      if (f.permission === 'admin' && !(flags.isAdmin || isOwner)) { sent.push({ jid: m.chat, content: { text: 'DENIED admin' } }); return out(before); }
      if (f.scope === 'group' && !m.isGroup) { sent.push({ jid: m.chat, content: { text: 'DENIED group' } }); return out(before); }
      try { await f.run(context(m, f, flags)); } catch (e) { if (e.name !== 'UsageError' && !e.userMessage) throw e; sent.push({ jid: m.chat, content: { text: e.userMessage || e.message } }); }
    }
    return out(before);
  }
  const out = before => sent.slice(before).map(s => s.content?.text ?? s.content?.caption ?? s.opts?.caption ?? (s.content ? Object.keys(s.content)[0] : 'file')).join('\n');

  return { send, db, sent, calls, socket, registry, GROUP, OWNER };
}

module.exports = { createScenario, GROUP, OWNER };
