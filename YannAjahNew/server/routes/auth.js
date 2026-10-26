'use strict';
// Login website: username/email + password (akun dibuat developer/atasan) dan link login sekali pakai
// dari CLI. Tidak ada login Google. Semua cara login hanya untuk rank RESELLER ke atas; saat maintenance
// web hanya DEVELOPER. Logout mencabut sesi di database.

const express = require('express');
const { parseCookies, setCookie, clearCookie, rateLimiter, clientIp } = require('../lib/security');
const sessions = require('../services/sessionService');
const maintenance = require('../services/maintenanceService');
const links = require('../services/loginLinkService');
const audit = require('../services/auditService');
const access = require('../services/accessControl');
const passwords = require('../services/passwordAuthService');

const SID = 'yan_sid';

module.exports = function authRoutes({ db, cfg }) {
  const r = express.Router();
  const limiter = rateLimiter({ windowMs: 15 * 60000, max: 60, code: 'TOO_MANY_LOGIN_REQUESTS' });
  const cookieOpts = { secure: cfg.secureCookies };

  async function openSession(req, res, accountId, provider) {
    const s = await sessions.create(db, accountId, { provider, ip: clientIp(req), userAgent: req.get('user-agent'), hours: cfg.adminSessionHours });
    setCookie(res, SID, s.token, { ...cookieOpts, maxAge: cfg.adminSessionHours * 3600 });
    await audit.write(db, { actorId: accountId, action: 'auth.login', targetType: 'account', targetId: accountId, details: { provider }, ip: clientIp(req) });
  }

  // Link login: redirect ke halaman login dengan kode pesan kalau ditolak.
  async function startSession(req, res, accountId, provider) {
    const actor = await access.loadActor(db, accountId);
    if (!actor || actor.status !== 'active') return res.redirect('/?auth=restricted');
    try { await passwords.assertWebAccess(db, actor); } catch { return res.redirect('/?auth=member'); }
    try { await maintenance.assertWebOpen(db, actor); } catch { return res.redirect('/?auth=maintenance'); }
    await openSession(req, res, accountId, provider);
    return res.redirect('/dashboard');
  }

  // Email + password (JSON). Origin dicek oleh app.js untuk semua POST /auth.
  r.post('/auth/login', limiter, async (req, res, next) => {
    try {
      const { accountId } = await passwords.login(db, req.body || {}, { ip: clientIp(req) });
      await openSession(req, res, accountId, 'password');
      res.json({ success: true, redirect: '/dashboard' });
    } catch (e) { next(e); }
  });

  // Info publik untuk halaman login (banner maintenance web).
  r.get('/auth/config', async (req, res, next) => {
    try { const m = await maintenance.get(db); res.json({ success: true, maintenance: { web: m.web_enabled, message: m.web_enabled ? m.web_message : null } }); }
    catch (e) { next(e); }
  });

  // Link sekali pakai dari `node server/cli.js login-link --username ...`
  r.get('/auth/link', limiter, async (req, res, next) => {
    try {
      const accountId = await links.consume(db, String(req.query.token || ''), { ip: clientIp(req) });
      if (!accountId) return res.status(400).send('Link login tidak valid atau sudah kedaluwarsa.');
      return startSession(req, res, accountId, 'login_link');
    } catch (e) { next(e); }
  });

  r.post('/auth/logout', async (req, res, next) => {
    try {
      const token = parseCookies(req)[SID];
      if (token) await sessions.revoke(db, token);
      clearCookie(res, SID, cookieOpts);
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  r.limiter = limiter;
  return r;
};

module.exports.SID = SID;
