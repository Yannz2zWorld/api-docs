'use strict';
// Login website: email + password (akun dibuat developer/atasan), Google OAuth/OIDC (opsional;
// state + nonce di cookie HttpOnly 10 menit), dan link login sekali pakai dari CLI.
// Semua cara login hanya untuk rank RESELLER ke atas. Logout mencabut sesi di database.

const express = require('express');
const { newId, safeEqual, parseCookies, setCookie, clearCookie, rateLimiter, clientIp } = require('../lib/security');
const sessions = require('../services/sessionService');
const google = require('../services/googleAuthService');
const links = require('../services/loginLinkService');
const audit = require('../services/auditService');
const access = require('../services/accessControl');
const passwords = require('../services/passwordAuthService');

const SID = 'yan_sid';
const OAUTH = 'yan_oauth';

module.exports = function authRoutes({ db, cfg, googleClient }) {
  const r = express.Router();
  const limiter = rateLimiter({ windowMs: 15 * 60000, max: 60, code: 'TOO_MANY_LOGIN_REQUESTS' });
  const cookieOpts = { secure: cfg.secureCookies };

  async function openSession(req, res, accountId, provider) {
    const s = await sessions.create(db, accountId, { provider, ip: clientIp(req), userAgent: req.get('user-agent'), hours: cfg.adminSessionHours });
    setCookie(res, SID, s.token, { ...cookieOpts, maxAge: cfg.adminSessionHours * 3600 });
    await audit.write(db, { actorId: accountId, action: 'auth.login', targetType: 'account', targetId: accountId, details: { provider }, ip: clientIp(req) });
  }

  // Google & link login: redirect ke halaman login dengan kode pesan kalau ditolak.
  async function startSession(req, res, accountId, provider) {
    const actor = await access.loadActor(db, accountId);
    if (!actor || actor.status !== 'active') return res.redirect('/?auth=restricted');
    try { await passwords.assertWebAccess(db, actor); } catch { return res.redirect('/?auth=member'); }
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

  r.get('/auth/config', (req, res) => res.json({ success: true, google: googleClient.enabled }));

  r.get('/auth/google', limiter, (req, res) => {
    if (!googleClient.enabled) return res.status(503).send('Google OAuth belum dikonfigurasi di server.');
    const state = newId(24), nonce = newId(24);
    setCookie(res, OAUTH, `${state}.${nonce}`, { ...cookieOpts, maxAge: 600 });
    res.redirect(googleClient.authUrl({ state, nonce }));
  });

  r.get('/auth/google/callback', limiter, async (req, res) => {
    const cookie = parseCookies(req)[OAUTH] || '';
    clearCookie(res, OAUTH, cookieOpts);
    const [state, nonce] = cookie.split('.');
    if (req.query.error) return res.redirect('/?auth=denied');
    if (!state || !nonce || typeof req.query.state !== 'string' || !safeEqual(req.query.state, state) || typeof req.query.code !== 'string') {
      return res.status(400).send('State OAuth tidak valid. Coba login lagi.');
    }
    try {
      const payload = await googleClient.exchange(req.query.code, nonce);
      const result = await google.signIn(db, payload, { openSignup: cfg.openSignup, ip: clientIp(req) });
      return startSession(req, res, result.accountId, 'google');
    } catch (e) {
      if (e.status === 403) return res.redirect(`/?auth=${e.code === 'SIGNUP_CLOSED' ? 'closed' : 'restricted'}`);
      console.error('Google OAuth gagal:', { code: e.code || 'OAUTH_FAILED' });
      return res.redirect('/?auth=error');
    }
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
