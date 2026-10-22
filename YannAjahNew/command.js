'use strict';
// Router command (pengganti switch-case raksasa command.js base/V15). Urutan pemeriksaan setiap command:
//   1. mode self/public  2. kunci lisensi (ban/disable/sesi dicabut = fitur mati)  3. maintenance
//   4. status fitur (planned/disabled/needs_api_key)  5. scope grup/private  6. permission
//   (owner/admin/premium/botAdmin)  7. banned user lokal, mute grup  8. cooldown & anti-spam
//   9. limit harian (dipotong hanya kalau sukses)  10. concurrency  11. timeout & isolasi error
// Hook non-command (anti-link, AFK, dll.) dijalankan sebelum command, masing-masing terisolasi.

const util = require('util');
const { TTLCache, RateLimiter, Semaphore, jidUser } = require('./library/function');
const { UsageError } = require('./library/errors');

function createRouter(yannajah, { config, logger }) {
  const { registry, database: db, auth: license, api } = yannajah;
  const mess = config.mess;
  const cooldowns = new TTLCache({ ttlMs: 60000, max: 5000 });
  const spam = new RateLimiter({ limit: config.limit.spamMaxCommands, windowMs: config.limit.spamWindowMs });
  const perUser = new Map();
  const globalSem = new Semaphore(config.concurrency.globalCommands);
  const hooks = () => [...registry.features.values()].filter(f => typeof f.onMessage === 'function' && registry.effectiveStatus(f, { apiKey: api?.hasKey?.() }) !== 'disabled');

  const ownerNumbers = () => new Set([config.owner.number, ...config.owner.extra, ...(db.raw().owners || [])].map(String));
  const isOwnerOf = m => m.fromMe || ownerNumbers().has(jidUser(m.sender));

  function buildContext(m, feature, flags) {
    const ctx = {
      m, yannajah, feature, config, logger,
      command: m.command, args: m.args || [], text: m.text || '', prefix: m.prefix || '',
      ...flags,
      db, api,
      user: db.user(m.sender),
      group: m.isGroup ? db.group(m.chat) : null,
      reply: (content, opts) => yannajah.reply(m, content, opts),
      react: emoji => yannajah.react(m, emoji),
      sendFile: (input, opts = {}) => yannajah.sendFile(m.chat, input, { quoted: m.raw, ...opts }),
      usage: () => `Contoh: *${m.prefix}${m.command}${feature.usage ? ' ' + feature.usage : ''}*`,
      requireText(msg) { if (!ctx.text) throw new UsageError(msg || `Teksnya mana?\n${ctx.usage()}`); return ctx.text; },
      media: () => m.getMedia?.() || null,
      // Kompatibilitas plugin base/V15: handler(m, { conn, alip, clutch, Reply, isCreator, text, command, example, ... })
      legacyContext: () => ({
        conn: yannajah.socket, alip: yannajah.socket, clutch: yannajah.socket, yannajah,
        Reply: t => yannajah.reply(m, t), reply: t => yannajah.reply(m, t), isCreator: flags.isOwner, isOwner: flags.isOwner,
        isPremium: flags.isPremium, text: m.text, q: m.text, args: m.args, command: m.command, prefix: m.prefix,
        example: t => `\n*Contoh:* ${m.prefix}${m.command} ${t}\n`, mess, isCmd: true, botNumber: yannajah.socket?.user?.id
      })
    };
    return ctx;
  }

  async function runHooks(m, flags) {
    for (const f of hooks()) {
      try {
        const stop = await f.onMessage(buildContext(m, f, flags));
        if (stop === true) return true;
      } catch (e) { logger.warn(`Hook ${f.id} error`, e.message); }
    }
    return false;
  }

  function denied(m, text) { return text ? yannajah.reply(m, text).catch(() => {}) : null; }

  return async function handle(m) {
    if (!m || m.isBaileys) return;
    const settings = db.settings();
    const isOwner = isOwnerOf(m);
    const isPremium = isOwner || db.isPremium(m.sender);
    const flags = { isOwner, isPremium, isAdmin: Boolean(m.isAdmin), isBotAdmin: Boolean(m.isBotAdmin) };
    const isPublic = settings.public ?? config.chat.public;
    if (!isPublic && !isOwner) return;
    if (config.chat.groupOnly && !m.isGroup && !isOwner) return;
    if (config.chat.privateOnly && m.isGroup && !isOwner) return;

    // Lisensi terkunci: tidak ada fitur sama sekali (hook pun tidak). Owner diberi tahu alasannya.
    if (!license.isActive()) {
      if (m.isCmd && isOwner) await denied(m, `${mess.unlicensed}\nAlasan: ${license.describe(license.lockReason)}`);
      return;
    }
    if (await runHooks(m, flags)) return;
    if (!m.isCmd) return;

    const feature = registry.resolve(m.command);
    if (!feature) {
      const s = m.prefix ? registry.suggest(m.command) : [];
      if (s.length) await denied(m, `Command *${m.command}* tidak ada. Mungkin maksud kamu: ${s.map(x => m.prefix + x).join(', ')}`);
      return;
    }

    const mt = license.maintenance();
    if (mt.active && !isOwner && !feature.allowInMaintenance) return denied(m, `🛠️ ${mt.message}`);

    const user = db.user(m.sender);
    if (user.banned && !isOwner) return;
    if (m.isGroup) {
      const g = db.group(m.chat);
      if (g.mute && !isOwner && !feature.allowWhenMuted) return;
      if (g.onlyAdmin && !m.isAdmin && !isOwner && !feature.allowWhenMuted) return;
    }

    const status = registry.effectiveStatus(feature, { apiKey: api?.hasKey?.() ?? true, disabledList: config.plugin.disabled });
    if (status === 'planned') return denied(m, `🧭 Fitur *${feature.name}* masih dalam rencana pengembangan (status: planned).`);
    if (status === 'disabled') return denied(m, mess.disabled);
    if (status === 'needs_api_key') return denied(m, mess.needApiKey);

    if (feature.scope === 'group' && !m.isGroup) return denied(m, mess.group);
    if (feature.scope === 'private' && m.isGroup) return denied(m, mess.private);
    if (feature.permission === 'owner' && !isOwner) return denied(m, mess.owner);
    if (feature.permission === 'admin' && !(m.isAdmin || isOwner)) return denied(m, m.isGroup ? mess.admin : mess.group);
    if (feature.permission === 'premium' && !isPremium) return denied(m, mess.prem);
    if (feature.botAdmin && !m.isBotAdmin) return denied(m, mess.botAdmin);
    if (config.permission.registerRequired && !user.registered && !isOwner && !feature.noRegister) return denied(m, mess.verifikasi);

    if (!isOwner) {
      const sp = spam.check(m.sender);
      if (!sp.allowed) return;   // spam: diam saja
      const cdKey = `${m.sender}:${feature.id}`;
      const until = cooldowns.get(cdKey);
      if (until && until > Date.now()) return denied(m, mess.cooldown.replace('{s}', Math.ceil((until - Date.now()) / 1000)));
      if (feature.cooldown) cooldowns.set(cdKey, Date.now() + feature.cooldown * 1000, feature.cooldown * 1000);
    }
    const cost = Number(feature.limit || 0);
    if (cost > 0 && !isPremium && user.limit < cost) return denied(m, mess.limit);

    const active = perUser.get(m.sender) || 0;
    if (active >= config.concurrency.commandsPerUser && !isOwner) return denied(m, '⏳ Tunggu command sebelumnya selesai dulu.');
    perUser.set(m.sender, active + 1);

    const ctx = buildContext(m, feature, flags);
    const started = Date.now();
    let timer;
    try {
      await globalSem.run(() => Promise.race([
        Promise.resolve().then(() => feature.run(ctx)),
        new Promise((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'COMMAND_TIMEOUT' })), config.timeout.commandMs); })
      ]));
      if (cost > 0 && !isPremium) { user.limit = Math.max(0, user.limit - cost); db.touch(); }
      const stats = db.raw().stats;
      stats.commands[feature.id] = (stats.commands[feature.id] || 0) + 1;
      stats.totalCommands = (stats.totalCommands || 0) + 1;
      db.touch();
      logger.debug('command ok', { id: feature.id, ms: Date.now() - started });
    } catch (e) {
      if (e instanceof UsageError || e.name === 'UsageError') return denied(m, e.userMessage || e.message);
      if (e.code === 'COMMAND_TIMEOUT') { logger.warn('command timeout', { id: feature.id }); return denied(m, '⌛ Proses terlalu lama, dibatalkan. Coba lagi nanti.'); }
      if (e.userMessage && e.code !== 'NETWORK_ERROR') { logger.info('command ditolak', { id: feature.id, code: e.code }); return denied(m, `❌ ${e.userMessage}`); }
      logger.error(`command ${feature.id} error`, { code: e.code, message: e.message, stack: util.format(e.stack).split('\n').slice(0, 4).join(' | ') });
      return denied(m, mess.error);
    } finally {
      clearTimeout(timer);
      const n = (perUser.get(m.sender) || 1) - 1;
      if (n <= 0) perUser.delete(m.sender); else perUser.set(m.sender, n);
    }
  };
}

module.exports = { createRouter };
