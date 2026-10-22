'use strict';
// API untuk proses bot (dipanggil library/license.js). Token bot lewat header Authorization: Bearer.

const express = require('express');
const botAuth = require('../services/botAuthService');
const { rateLimiter, clientIp } = require('../lib/security');
const { unauthorized } = require('../lib/errors');

module.exports = function botApi({ db, cfg }) {
  const r = express.Router();
  const loginLimiter = rateLimiter({ windowMs: 15 * 60000, max: 40, code: 'TOO_MANY_REQUESTS' });
  const tokenLimiter = rateLimiter({ windowMs: 60000, max: 120 });
  const bearer = req => {
    const m = /^Bearer\s+(\S+)$/i.exec(String(req.get('authorization') || ''));
    if (!m) throw unauthorized('AUTH_REQUIRED', 'Header Authorization: Bearer <token> wajib.');
    return m[1];
  };
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).then(out => res.json({ success: true, ...out })).catch(next);
  const options = { sessionDays: cfg.botSessionDays };

  r.post('/api/bot/auth/login', loginLimiter, wrap(req => botAuth.login(db, req.body || {}, { ip: clientIp(req), options })));
  r.post('/api/bot/auth/verify', tokenLimiter, wrap(req => botAuth.verify(db, bearer(req))));
  r.post('/api/bot/heartbeat', tokenLimiter, wrap(req => botAuth.heartbeat(db, bearer(req), req.body || {}, { ip: clientIp(req) })));
  r.post('/api/bot/auth/logout', tokenLimiter, wrap(req => botAuth.logout(db, bearer(req), { ip: clientIp(req) })));
  r.loginLimiter = loginLimiter;
  return r;
};
