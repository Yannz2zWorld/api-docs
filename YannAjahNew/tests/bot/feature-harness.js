'use strict';
// Konteks tiruan untuk menjalankan fitur tanpa WhatsApp sungguhan. Semua balasan ditangkap.
const { Registry } = require('../../library/registry');
const { createDatabaseFacade } = require('../../yannajah');
const DataBase = require('../../source/database');
const path = require('path');

const freshStore = () => ({ data: DataBase.DEFAULTS(), markDirty() {}, write: async () => {} });

function loadRegistry() {
  const store = freshStore();
  const registry = new Registry({ db: () => store.data });
  registry.loadDir(path.join(__dirname, '..', '..', 'plugins'));
  return { registry, store };
}

function mockCtx({ feature, text = '', store, api = null, quoted = null, media = null, isOwner = false, isGroup = false, extra = {} }) {
  const replies = [];
  const files = [];
  const db = createDatabaseFacade(store, { dailyLimit: 10 });
  const m = { chat: isGroup ? '120363000000000001@g.us' : '6281200000001@s.whatsapp.net', sender: '6281200000001@s.whatsapp.net', senderNumber: '6281200000001', isGroup, command: feature.name, prefix: '.', args: text ? text.split(/\s+/) : [], text, quoted, pushName: 'Tester', key: { id: 'TEST' }, getMedia: () => media, mentionedJid: [], ...extra.m };
  const ctx = {
    m, feature, command: feature.name, args: m.args, text, prefix: '.', isOwner, isPremium: isOwner, isAdmin: false, isBotAdmin: false,
    db, api, user: db.user(m.sender), group: isGroup ? db.group(m.chat) : null, config: require('../../settingsbot.js'), logger: { info() {}, warn() {}, error() {}, debug() {} },
    yannajah: { database: db, api, registry: extra.registry, socket: extra.socket || null, health: () => ({}) },
    reply: async c => { replies.push(typeof c === 'string' ? c : c?.text ?? c); },
    react: async () => {},
    sendFile: async (input, opts = {}) => { files.push({ input, opts }); },
    usage: () => `Contoh: .${feature.name}${feature.usage ? ' ' + feature.usage : ''}`,
    requireText(msg) { if (!text) { const { UsageError } = require('../../library/errors'); throw new UsageError(msg || 'butuh teks'); } return text; },
    media: () => media,
    ...extra.ctx
  };
  return { ctx, replies, files };
}

function check(expect, out) {
  if (expect instanceof RegExp) return expect.test(String(out));
  if (typeof expect === 'function') return Boolean(expect(out));
  return String(out) === String(expect);
}

module.exports = { loadRegistry, mockCtx, check, freshStore };
