'use strict';
/*
 * YannAjahNew — yannajah.js
 * Namespace utama `yannajah` sekaligus FACADE DATABASE bot (peran hasil audit: base/V15 memakai
 * source/database.js + global.db; di sini semua akses data bot lewat yannajah.database).
 * File ini hanya merangkai modul; logika ada di library/*:
 *
 *   yannajah.sendmessage(jid, content, opts)   kirim pesan (antrian per chat + retry terbatas)
 *   yannajah.reply(m, content, opts)           balas pesan m
 *   yannajah.react(m, emoji)                   reaksi
 *   yannajah.sendFile(jid, input, opts)        kirim Buffer/URL/file dengan deteksi mime sebenarnya
 *   yannajah.database.get/set/delete/user/group/save   (path string bertitik atau array, mis. ['users', jid])
 *   yannajah.api.get/post/getEndpoints/getStatus   (library/apiz2z.js — hanya endpoint terverifikasi)
 *   yannajah.auth.verify/isActive/status/maintenance (library/license.js — backend pusat)
 *   yannajah.plugins.register/list/get/enable/disable (library/registry.js)
 *
 * Database pusat (akun, rank, bot, kredensial, audit) ada di server/ (PostgreSQL) dan diakses bot
 * HANYA lewat API lisensi — bot tidak pernah memegang credential database pusat.
 */

const { err, UsageError } = require('./library/errors');
const { sniffMime, mediaKind, sleep, isUrl, truncate, toJid } = require('./library/function');
const { download } = require('./library/net');

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const JID_RE = /^[0-9a-zA-Z._:-]+@(s\.whatsapp\.net|g\.us|lid|newsletter|broadcast)$/;

// Path: 'settings.public' atau array ['users', jid] (WAJIB array kalau ada kunci bertitik seperti JID).
function splitPath(p) {
  const parts = Array.isArray(p) ? p.map(String) : String(p || '').split('.').filter(Boolean);
  if (!parts.length || parts.length > 8 || parts.some(k => FORBIDDEN_KEYS.has(k) || k.length > 120)) throw err('INVALID_DB_PATH', `Path database tidak valid: ${p}`);
  return parts;
}

function createDatabaseFacade(store, { dailyLimit = 10, timezone = 'Asia/Jakarta' } = {}) {
  const data = () => store.data;
  // Hari berganti jam 00:00 di zona waktu bot (V15: reset limit 00:00 WIB).
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = () => fmt.format(new Date());
  const facade = {
    raw: data,
    get(path, fallback = undefined) {
      let cur = data();
      for (const k of splitPath(path)) { if (cur == null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, k)) return fallback; cur = cur[k]; }
      return cur;
    },
    set(path, value) {
      const parts = splitPath(path);
      let cur = data();
      for (const k of parts.slice(0, -1)) {
        if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
        cur = cur[k];
      }
      cur[parts[parts.length - 1]] = value;
      store.markDirty();
      return value;
    },
    delete(path) {
      const parts = splitPath(path);
      const parent = parts.length > 1 ? facade.get(parts.slice(0, -1)) : data();
      if (parent && typeof parent === 'object') { delete parent[parts[parts.length - 1]]; store.markDirty(); return true; }
      return false;
    },
    // Data user (struktur kompatibel V15: limit harian, premium, banned, warn, exp, money, afk).
    user(jid) {
      const users = data().users;
      if (!users[jid]) { users[jid] = { name: '', registered: false, limit: dailyLimit, limitDate: today(), premiumUntil: 0, banned: false, warn: 0, exp: 0, level: 0, money: 0, afk: null, createdAt: Date.now() }; store.markDirty(); }
      const u = users[jid];
      // dailyLimit per user (.setlimit) menggantikan limit default; bonus (.redeem/.addlimitall hari ini) ditambahkan.
      if (u.limitDate !== today()) { u.limit = (u.dailyLimit || dailyLimit) + (u.bonusLimitDate === today() ? u.bonusLimit || 0 : 0); u.limitDate = today(); store.markDirty(); }
      return u;
    },
    group(jid) {
      const groups = data().groups;
      if (!groups[jid]) { groups[jid] = { welcome: false, left: false, antilink: false, mute: false, onlyAdmin: false, welcomeText: '', leftText: '', createdAt: Date.now() }; store.markDirty(); }
      return groups[jid];
    },
    settings() { return data().settings; },
    isPremium(jid) { const u = data().users[jid]; return Boolean(u && u.premiumUntil && u.premiumUntil > Date.now()); },
    touch() { store.markDirty(); },
    save: () => store.write()
  };
  return facade;
}

function createYannajah({ config, logger, store, license, api, registry, wa = null }) {
  const queues = new Map();
  const yannajah = {
    name: 'YannAjahNew',
    version: config.bot.version,
    config,
    logger,
    wa,
    get socket() { return yannajah.wa?.sock || null; },
    database: createDatabaseFacade(store, { dailyLimit: config.limit.daily, timezone: config.bot.timezone }),
    api,
    auth: license,
    registry,
    plugins: {
      register: (feature, opts) => registry.register(feature, opts),
      list: opts => registry.list(opts),
      get: cmd => registry.resolve(cmd),
      enable: id => registry.setEnabled(id, true),
      disable: id => registry.setEnabled(id, false),
      categories: () => registry.categories()
    }
  };

  function sock() {
    const s = yannajah.socket;
    if (!s) throw err('NOT_CONNECTED', 'WhatsApp belum terhubung', { userMessage: 'Bot belum terhubung ke WhatsApp.' });
    return s;
  }

  // Kirim pesan. Antrian per chat (urutan terjaga, jeda minimal 250 ms) + retry terbatas untuk error sementara.
  yannajah.sendmessage = async (jid, content, opts = {}) => {
    if (!JID_RE.test(String(jid))) throw err('INVALID_JID', `JID tidak valid: ${jid}`);
    if (license && !license.isActive() && !opts.allowWhenLocked) throw err('LICENSE_LOCKED', 'Bot terkunci oleh server lisensi');
    const payload = typeof content === 'string' ? { text: truncate(content, 60000) } : content;
    if (!payload || typeof payload !== 'object') throw err('INVALID_CONTENT', 'Konten pesan tidak valid');
    const { allowWhenLocked, ...sendOpts } = opts;
    const prev = queues.get(jid) || Promise.resolve();
    const job = prev.catch(() => {}).then(async () => {
      let lastErr;
      for (let i = 0; i <= config.retry.sendMessage; i++) {
        try { const r = await sock().sendMessage(jid, payload, sendOpts); await sleep(250); return r; }
        catch (e) { lastErr = e; if (e.code === 'NOT_CONNECTED' || i === config.retry.sendMessage) break; await sleep(700 * (i + 1)); }
      }
      throw lastErr;
    });
    queues.set(jid, job);
    job.finally(() => { if (queues.get(jid) === job) queues.delete(jid); }).catch(() => {});
    return job;
  };

  yannajah.reply = (m, content, opts = {}) => {
    const payload = typeof content === 'string' ? { text: content, mentions: [...String(content).matchAll(/@(\d{5,16})/g)].map(x => toJid(x[1])) } : content;
    return yannajah.sendmessage(m.chat, payload, { quoted: m.raw, ...opts });
  };

  yannajah.react = (m, emoji) => yannajah.sendmessage(m.chat, { react: { text: String(emoji || ''), key: m.key } }, { allowWhenLocked: true }).catch(() => null);

  // input: Buffer | URL https | { buffer, mime }. Tipe pesan dipilih dari isi file sebenarnya.
  yannajah.sendFile = async (jid, input, { caption = '', fileName, mimetype, quoted, asDocument = false, ptt = false, gif = false } = {}) => {
    let buffer, mime = mimetype;
    if (Buffer.isBuffer(input)) buffer = input;
    else if (input && Buffer.isBuffer(input.buffer)) { buffer = input.buffer; mime = mime || input.mime; }
    else if (typeof input === 'string' && isUrl(input)) {
      const d = await download(input, { maxBytes: config.media.maxDownloadBytes, timeoutMs: config.media.downloadTimeoutMs });
      buffer = d.buffer; mime = mime || d.mime;
    } else throw new UsageError('File tidak valid.');
    if (!buffer.length) throw err('EMPTY_FILE', 'File kosong', { userMessage: 'File hasil kosong.' });
    const sniff = sniffMime(buffer);
    mime = sniff?.mime || mime || 'application/octet-stream';
    const kind = asDocument ? 'document' : mediaKind(mime);
    const name = fileName || `yannajah-${Date.now()}.${sniff?.ext || (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '')}`;
    const msg = kind === 'image' ? { image: buffer, caption }
      : kind === 'gif' ? { video: buffer, gifPlayback: true, caption }
      : kind === 'video' ? { video: buffer, caption, gifPlayback: gif }
      : kind === 'audio' ? { audio: buffer, mimetype: mime === 'audio/ogg' && ptt ? 'audio/ogg; codecs=opus' : mime, ptt }
      : kind === 'sticker' ? { sticker: buffer }
      : { document: buffer, mimetype: mime, fileName: name, caption };
    return yannajah.sendmessage(jid, msg, quoted ? { quoted } : {});
  };

  yannajah.health = () => ({
    wa: yannajah.wa?.status || 'disconnected',
    license: license?.status() || null,
    features: registry.features.size,
    uptime_s: Math.round(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().rss / 1048576)
  });

  return yannajah;
}

module.exports = { createYannajah, createDatabaseFacade, splitPath };
