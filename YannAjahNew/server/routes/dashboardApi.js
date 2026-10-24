'use strict';
// API dashboard. Setiap request: sesi cookie -> akun dibaca ulang dari DB (status/rank terbaru)
// -> CSRF (header X-CSRF-Token = HMAC sesi) untuk request yang mengubah data -> service
// (permission + cakupan + kuota + validasi + transaksi + audit). Respons tidak pernah memuat
// hash password, token, google_sub, atau session_ref.

const express = require('express');
const { parseCookies, csrfFor, safeEqual, rateLimiter, clientIp } = require('../lib/security');
const { unauthorized, forbidden } = require('../lib/errors');
const v = require('../lib/validate');
const sessions = require('../services/sessionService');
const access = require('../services/accessControl');
const accounts = require('../services/accountService');
const bots = require('../services/botService');
const maintenance = require('../services/maintenanceService');
const audit = require('../services/auditService');
const quota = require('../services/quotaService');
const backup = require('../services/backupService');
const passwords = require('../services/passwordAuthService');
const { sha256 } = require('../lib/security');
const { pending } = require('../lib/migrate');
const { SID } = require('./auth');

module.exports = function dashboardApi({ db, cfg }) {
  const r = express.Router();
  const mutationLimiter = rateLimiter({ windowMs: 60000, max: 120, keyFn: req => 'acct:' + (req.actor?.id || req.ip) });

  r.use('/api/dash', async (req, res, next) => {
    try {
      const token = parseCookies(req)[SID];
      const s = token ? await sessions.resolve(db, token) : null;
      if (!s) throw unauthorized('AUTH_REQUIRED', 'Sesi tidak ada atau sudah berakhir. Login lagi.');
      const actor = await access.loadActor(db, s.accountId);
      if (!actor) throw unauthorized('AUTH_REQUIRED', 'Akun tidak ditemukan.');
      if (actor.status !== 'active') throw forbidden('ACCOUNT_RESTRICTED', 'Akun kamu sedang tidak aktif.');
      await passwords.assertWebAccess(db, actor);   // website khusus RESELLER ke atas (dicek tiap request)
      req.actor = actor;
      req.sessionToken = token;
      if (!['GET', 'HEAD'].includes(req.method)) {
        if (!safeEqual(req.get('x-csrf-token') || '', csrfFor(cfg.sessionSecret, token))) throw forbidden('CSRF_FAILED', 'Token CSRF tidak valid. Muat ulang halaman.');
        return mutationLimiter(req, res, next);
      }
      next();
    } catch (e) { next(e); }
  });

  const h = fn => (req, res, next) => Promise.resolve(fn(req, res)).then(out => { if (!res.headersSent) res.json({ success: true, ...out }); }).catch(next);
  const ip = req => ({ ip: clientIp(req) });

  r.get('/api/dash/me', h(async req => {
    const a = req.actor;
    return {
      account: { id: a.id, username: a.username, display_name: a.displayName, email: a.email, rank: a.rank, status: a.status },
      permissions: [...a.perms].sort(),
      quota: await quota.usage(db, a.id, a.rank),
      maintenance: await maintenance.get(db),
      csrfToken: csrfFor(cfg.sessionSecret, req.sessionToken)
    };
  }));

  r.get('/api/dash/ranks', h(async () => {
    const ranks = await access.loadRanks(db);
    return { ranks: [...ranks.values()].map(x => ({ code: x.code, level: x.level, max_numbers: x.max_numbers, max_managed_users: x.max_managed_users, assignable: x.assignable, description: x.description, permissions: [...x.perms].sort() })) };
  }));

  r.get('/api/dash/stats', h(async req => {
    const all = req.actor.perms.has('user.view_all');
    const rows = all
      ? await db.query(`SELECT
          (SELECT count(*)::int FROM accounts WHERE deleted_at IS NULL) AS accounts,
          (SELECT count(*)::int FROM accounts WHERE deleted_at IS NULL AND status <> 'active') AS restricted_accounts,
          (SELECT count(*)::int FROM bots WHERE deleted_at IS NULL) AS bots,
          (SELECT count(*)::int FROM bots WHERE deleted_at IS NULL AND connection_status = 'connected' AND enabled AND NOT banned) AS bots_connected,
          (SELECT count(*)::int FROM bots WHERE deleted_at IS NULL AND banned) AS bots_banned,
          (SELECT count(*)::int FROM login_attempts WHERE success = false AND created_at > now() - interval '24 hours') AS failed_logins_24h`)
      : null;
    if (rows) return { scope: 'global', stats: rows[0] };
    const mine = await bots.list(db, req.actor).catch(() => []);
    return { scope: 'own', stats: { bots: mine.length, bots_connected: mine.filter(b => b.status === 'connected').length, bots_banned: mine.filter(b => b.banned).length } };
  }));

  // ---------------------------------------------------------------- akun
  r.get('/api/dash/accounts', h(async req => ({ accounts: await accounts.list(db, req.actor, { q: req.query.q || null, rank: req.query.rank || null, status: req.query.status || null }) })));
  r.post('/api/dash/accounts', h(async req => ({ account: await accounts.create(db, req.actor, req.body || {}, { ...ip(req), bcryptCost: cfg.bcryptCost }) })));
  r.get('/api/dash/accounts/:id', h(async req => ({ account: await accounts.get(db, req.actor, v.id(req.params.id)) })));
  r.patch('/api/dash/accounts/:id', h(async req => ({ account: await accounts.update(db, req.actor, v.id(req.params.id), req.body || {}, ip(req)) })));
  r.post('/api/dash/accounts/:id/rank', h(async req => accounts.changeRank(db, req.actor, v.id(req.params.id), req.body?.rank, ip(req))));
  r.post('/api/dash/accounts/:id/status', h(async req => accounts.setStatus(db, req.actor, v.id(req.params.id), String(req.body?.status || ''), req.body?.reason, ip(req))));
  r.delete('/api/dash/accounts/:id', h(async req => accounts.remove(db, req.actor, v.id(req.params.id), ip(req))));
  r.post('/api/dash/accounts/:id/password', h(async req => passwords.setPassword(db, req.actor, v.id(req.params.id), req.body?.password, { ...ip(req), bcryptCost: cfg.bcryptCost })));
  r.post('/api/dash/me/password', h(async req => passwords.changeOwn(db, req.actor, req.body || {}, { ...ip(req), bcryptCost: cfg.bcryptCost, keepSessionHash: sha256(req.sessionToken) })));

  // ---------------------------------------------------------------- bot / nomor
  r.get('/api/dash/bots', h(async req => ({ bots: await bots.list(db, req.actor) })));
  r.post('/api/dash/bots', h(async req => ({ bot: await bots.create(db, req.actor, req.body || {}, { ...ip(req), bcryptCost: cfg.bcryptCost }) })));
  r.patch('/api/dash/bots/:id', h(async req => ({ bot: await bots.update(db, req.actor, v.id(req.params.id), req.body || {}, ip(req)) })));
  r.post('/api/dash/bots/:id/enabled', h(async req => ({ bot: await bots.setEnabled(db, req.actor, v.id(req.params.id), req.body?.enabled, req.body?.reason, ip(req)) })));
  r.post('/api/dash/bots/:id/ban', h(async req => ({ bot: await bots.setBanned(db, req.actor, v.id(req.params.id), v.bool(req.body?.banned, 'banned'), req.body?.reason, ip(req)) })));
  r.post('/api/dash/bots/:id/maintenance', h(async req => ({ bot: await bots.setMaintenance(db, req.actor, v.id(req.params.id), req.body?.enabled, req.body?.message, ip(req)) })));
  r.post('/api/dash/bots/:id/password', h(async req => bots.setPassword(db, req.actor, v.id(req.params.id), req.body?.password, { ...ip(req), bcryptCost: cfg.bcryptCost })));
  r.post('/api/dash/bots/:id/revoke', h(async req => bots.revoke(db, req.actor, v.id(req.params.id), ip(req))));
  r.get('/api/dash/bots/:id/sessions', h(async req => ({ sessions: await bots.sessions(db, req.actor, v.id(req.params.id)) })));
  r.delete('/api/dash/bots/:id', h(async req => bots.remove(db, req.actor, v.id(req.params.id), ip(req))));

  // ---------------------------------------------------------------- maintenance, audit, keamanan, sistem
  r.get('/api/dash/maintenance', h(async () => ({ maintenance: await maintenance.get(db) })));
  r.put('/api/dash/maintenance', h(async req => ({ maintenance: await maintenance.setGlobal(db, req.actor, req.body || {}, ip(req)) })));

  r.get('/api/dash/audit', h(async req => {
    if (!req.actor.perms.has('audit.view') && !req.actor.perms.has('audit.view_all')) throw forbidden('PERMISSION_DENIED', 'Butuh permission audit.view.');
    const { limit, before } = v.pageParams(req.query);
    const action = req.query.action ? v.str(String(req.query.action), { field: 'action', max: 60, pattern: /^[a-z_.]+$/ }) : null;
    return { logs: await audit.list(db, req.actor, { limit, before, action }) };
  }));

  r.get('/api/dash/login-attempts', h(async req => {
    access.require(req.actor, 'security.view');
    const { limit } = v.pageParams(req.query);
    return { attempts: await db.query('SELECT id, kind, success, reason, ip, created_at FROM login_attempts ORDER BY id DESC LIMIT $1', [limit]) };
  }));

  r.get('/api/dash/health', h(async req => {
    access.require(req.actor, 'system.view');
    const dbh = await db.healthCheck().catch(() => ({ ok: false }));
    return { database: dbh, pending_migrations: await pending(db).catch(() => null), uptime_s: Math.round(process.uptime()), memory_mb: Math.round(process.memoryUsage().rss / 1048576), node: process.version };
  }));

  r.post('/api/dash/sessions/revoke-all', h(async req => {
    const n = await sessions.revokeAll(db, req.actor.id);
    await audit.write(db, { actorId: req.actor.id, action: 'auth.sessions_revoked', targetType: 'account', targetId: req.actor.id, details: { count: n }, ip: clientIp(req) });
    return { revoked: n };
  }));

  // Backup terenkripsi (hanya ciphertext yang dikirim; kunci tetap di server).
  r.get('/api/dash/backup', async (req, res, next) => {
    try {
      access.require(req.actor, 'backup.manage');
      if (!cfg.backupKey) throw forbidden('BACKUP_KEY_MISSING', 'BACKUP_ENCRYPTION_KEY belum diatur di server.');
      const data = await backup.exportData(db);
      await audit.write(db, { actorId: req.actor.id, action: 'backup.export', details: { counts: data.counts }, ip: clientIp(req) });
      res.set('Content-Type', 'application/json');
      res.set('Content-Disposition', `attachment; filename="yannajah-backup-${new Date().toISOString().slice(0, 10)}.json.enc"`);
      res.set('Cache-Control', 'no-store');
      res.send(backup.encrypt(data, cfg.backupKey));
    } catch (e) { next(e); }
  });

  return r;
};
