'use strict';
// Email + password authentication: register (with email verification), login,
// forgot/reset password via a 6-digit email code sent as "YannApi".
// Responses never reveal whether an email is registered, except where unavoidable
// (registering an address that is already taken).
const express = require('express');
const users = require('../services/userService');
const passwords = require('../services/passwordService');
const codes = require('../services/authCodeService');
const email = require('../services/emailService');
const audit = require('../services/auditService');
const { classifyDatabaseError } = require('../lib/authErrors');
const turnstile = require('../services/turnstileService');

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const GENERIC_SENT = 'Kalau email itu terdaftar, kodenya udah dikirim. Cek inbox atau folder spam ya.';

module.exports = function authRouter({ issueSession }) {
  const router = express.Router();
  const fail = (res, status, error, message, extra = {}) => res.status(status).json({ success: false, error, message, ...extra });
  const ip = req => (req.ip || '').replace(/^::ffff:/, '').slice(0, 45) || null;
  const field = (req, name) => (typeof req.body?.[name] === 'string' ? req.body[name] : '');
  const normalEmail = req => field(req, 'email').trim().toLowerCase();

  // These routes set the session cookie: refuse cross-site callers (login CSRF).
  router.use(['/auth/register', '/auth/login', '/auth/email', '/auth/password'], (req, res, next) => {
    const origin = req.get('origin');
    if (req.method === 'POST' && ((origin && origin !== `${req.protocol}://${req.get('host')}`) || req.get('sec-fetch-site') === 'cross-site')) {
      return fail(res, 403, 'CSRF_BLOCKED', 'Origin ini nggak diizinkan.');
    }
    next();
  });

  // Cloudflare Turnstile on every sign-in form (no-op until the keys are configured).
  router.use(['/auth/login', '/auth/register', '/auth/email/verify', '/auth/email/resend', '/auth/password/forgot', '/auth/password/reset'], turnstile.guard());

  async function sendCode(user, purpose) {
    const issued = await codes.issueCode(user.id, purpose);
    if (issued.throttled) return 'throttled';
    await email.sendCode({ to: user.email, name: user.name, code: issued.code, purpose, minutes: issued.minutes });
    return 'sent';
  }

  function login(res, account, provider) {
    issueSession(res, account.google_id && provider === 'google' ? account.google_id : account.id, {
      id: account.id, email: account.email, name: account.name, picture: account.picture || '', sessionVersion: Number(account.session_version || 0)
    }, provider);
  }

  router.post('/auth/register', async (req, res) => {
    const name = field(req, 'name').trim();
    const address = normalEmail(req);
    const password = field(req, 'password');
    if (name.length < 2 || name.length > 80) return fail(res, 400, 'INVALID_NAME', 'Nama harus 2–80 karakter.');
    if (!EMAIL_RE.test(address) || address.length > 254) return fail(res, 400, 'INVALID_EMAIL', 'Format email-nya nggak valid.');
    const weak = passwords.passwordProblem(password);
    if (weak) return fail(res, 400, 'WEAK_PASSWORD', weak);
    // Accounts must be verified by email; without a mail provider no account could ever activate.
    if (!email.isConfigured()) return fail(res, 503, 'EMAIL_NOT_CONFIGURED', 'Daftar pakai email belum bisa. Pakai login Google aja ya.');
    if (await users.findAuthByEmail(address)) return fail(res, 409, 'EMAIL_TAKEN', 'Email ini udah terdaftar. Login aja, atau pakai Lupa sandi.');
    let account;
    try {
      account = await users.createPasswordUser({ name, email: address, passwordHash: await passwords.hashPassword(password) });
    } catch (e) {
      if (e.code === '23505') return fail(res, 409, 'EMAIL_TAKEN', 'Email ini udah terdaftar. Login aja, atau pakai Lupa sandi.');
      throw e;
    }
    await audit.writeAudit({ actorUserId: account.id, action: 'register', targetType: 'user', targetId: account.id, ipAddress: ip(req) }).catch(() => {});
    try {
      await sendCode(account, 'verify');
    } catch (e) {
      return fail(res, 502, 'EMAIL_SEND_FAILED', 'Akun udah dibuat, tapi email verifikasinya gagal dikirim. Coba "Kirim ulang kode" ya.', { verificationRequired: true });
    }
    res.status(201).json({ success: true, verificationRequired: true, message: `Kode verifikasi udah dikirim ke ${address}.` });
  });

  router.post('/auth/email/resend', async (req, res) => {
    const address = normalEmail(req);
    if (!EMAIL_RE.test(address)) return fail(res, 400, 'INVALID_EMAIL', 'Format email-nya nggak valid.');
    if (!email.isConfigured()) return fail(res, 503, 'EMAIL_NOT_CONFIGURED', 'Pengiriman email belum diatur.');
    const account = await users.findAuthByEmail(address);
    if (account && !account.email_verified && account.password_hash && account.status === 'active') {
      try { await sendCode(account, 'verify'); } catch { return fail(res, 502, 'EMAIL_SEND_FAILED', 'Email gagal dikirim. Coba lagi bentar ya.'); }
    }
    res.json({ success: true, message: GENERIC_SENT });
  });

  router.post('/auth/email/verify', async (req, res) => {
    const account = await users.findAuthByEmail(normalEmail(req));
    if (!account || account.email_verified || !(await codes.consumeCode(account.id, 'verify', field(req, 'code')))) {
      return fail(res, 400, 'INVALID_CODE', 'Kodenya salah atau udah kedaluwarsa. Minta kode baru aja kalau perlu.');
    }
    await users.markEmailVerified(account.id);
    if (account.status !== 'active') return fail(res, 403, 'ACCOUNT_RESTRICTED', 'Akun ini lagi nggak aktif.');
    await audit.writeAudit({ actorUserId: account.id, action: 'email_verify', targetType: 'user', targetId: account.id, ipAddress: ip(req) }).catch(() => {});
    login(res, account, 'password');
    res.json({ success: true, redirect: '/home' });
  });

  router.post('/auth/login', async (req, res) => {
    const address = normalEmail(req);
    const password = field(req, 'password');
    const invalid = () => fail(res, 401, 'INVALID_LOGIN', 'Email atau sandi salah.');
    if (!EMAIL_RE.test(address) || !password || password.length > 128) return invalid();
    const account = await users.findAuthByEmail(address);
    if (!account || !account.password_hash) {
      await passwords.verifyAgainstDummy(password);
      return invalid();
    }
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      return fail(res, 429, 'TOO_MANY_ATTEMPTS', 'Kebanyakan percobaan gagal. Coba lagi 15 menit lagi, atau reset sandi kamu.');
    }
    if (!(await passwords.verifyPassword(password, account.password_hash))) {
      await users.recordFailedLogin(account.id);
      await audit.writeAudit({ actorUserId: account.id, action: 'login_failed', targetType: 'session', ipAddress: ip(req) }).catch(() => {});
      return invalid();
    }
    await users.clearFailedLogins(account.id);
    if (!account.email_verified) return fail(res, 403, 'EMAIL_NOT_VERIFIED', 'Email kamu belum diverifikasi. Masukin kode yang dikirim ke email kamu.', { verificationRequired: true });
    if (account.status !== 'active') return fail(res, 403, 'ACCOUNT_RESTRICTED', 'Akun ini lagi nggak aktif. Hubungi developer kalau menurut kamu ini salah.');
    await audit.writeAudit({ actorUserId: account.id, action: 'login', targetType: 'session', metadata: { provider: 'password' }, ipAddress: ip(req) }).catch(() => {});
    login(res, account, 'password');
    res.json({ success: true, redirect: '/home' });
  });

  router.post('/auth/password/forgot', async (req, res) => {
    const address = normalEmail(req);
    if (!EMAIL_RE.test(address)) return fail(res, 400, 'INVALID_EMAIL', 'Format email-nya nggak valid.');
    if (!email.isConfigured()) return fail(res, 503, 'EMAIL_NOT_CONFIGURED', 'Reset sandi lewat email belum diatur. Hubungi developer ya.');
    const account = await users.findAuthByEmail(address);
    // Google-only accounts may also set a password this way: the code proves inbox ownership.
    if (account && account.status === 'active') {
      try { await sendCode(account, 'reset'); } catch { return fail(res, 502, 'EMAIL_SEND_FAILED', 'Email gagal dikirim. Coba lagi bentar ya.'); }
    }
    res.json({ success: true, message: GENERIC_SENT });
  });

  router.post('/auth/password/reset', async (req, res) => {
    const password = field(req, 'password');
    const weak = passwords.passwordProblem(password);
    if (weak) return fail(res, 400, 'WEAK_PASSWORD', weak);
    const account = await users.findAuthByEmail(normalEmail(req));
    if (!account || !(await codes.consumeCode(account.id, 'reset', field(req, 'code')))) {
      return fail(res, 400, 'INVALID_CODE', 'Kodenya salah atau udah kedaluwarsa. Minta kode baru aja kalau perlu.');
    }
    const updated = await users.setPassword(account.id, await passwords.hashPassword(password));
    await audit.writeAudit({ actorUserId: account.id, action: 'password_reset', targetType: 'user', targetId: account.id, ipAddress: ip(req) }).catch(() => {});
    if (updated.status !== 'active') return fail(res, 403, 'ACCOUNT_RESTRICTED', 'Sandi udah diganti, tapi akun ini lagi nggak aktif.');
    login(res, updated, 'password');
    res.json({ success: true, redirect: '/home', message: 'Sandi udah diganti. Semua perangkat lain udah otomatis logout.' });
  });

  for (const layer of router.stack) {
    if (layer.route) for (const routeLayer of layer.route.stack) {
      const original = routeLayer.handle;
      routeLayer.handle = (req, res, next) => Promise.resolve(original(req, res, next)).catch(next);
    }
  }
  router.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err?.isDatabaseError) {
      const c = classifyDatabaseError(err);
      console.error('Password auth failed:', { path: req.path, error: c.error, code: c.code });
      return fail(res, 503, c.error, 'Layanan akun lagi nggak tersedia. Coba lagi bentar ya.');
    }
    console.error('Password auth failed:', { path: req.path, name: err?.name || null, code: err?.code || null });
    return fail(res, 500, 'INTERNAL_ERROR', 'Ada masalah di server. Coba lagi bentar ya.');
  });
  return router;
};
