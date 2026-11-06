'use strict';
const express = require('express');
const crypto = require('crypto');
const db = require('../lib/db');
const users = require('../lib/users');
const keys = require('../lib/keys');
const mailer = require('../lib/mailer');
const { setSession, clearSession, userFromSession, isDevIdentity } = require('../lib/auth');
const { verifyPassword, hashPassword, sha256, safeEqual } = require('../lib/crypto');
const { wrap, fail, limiter } = require('../lib/http');

const r = express.Router();
const authLimit = limiter({ windowMs: 15 * 60000, max: Number(process.env.AUTH_RATE_LIMIT || 30) });

async function afterLogin(req, res, u) {
  if (u.banned) return fail(res, 403, 'BANNED', `Akun kamu diblokir${u.ban_reason ? ': ' + u.ban_reason : '.'}`);
  if (isDevIdentity(u) && u.tier !== 'developer') u = await db.one("UPDATE users SET tier = 'developer', tier_expires_at = NULL WHERE id = $1 RETURNING *", [u.id]);
  await db.q('UPDATE users SET last_login_at = now() WHERE id = $1', [u.id]);
  setSession(req, res, u);
  const next = typeof req.body?.next === 'string' && /^\/(?!\/)/.test(req.body.next) ? req.body.next : '/home';
  res.json({ status: true, redirect: next });
}

r.get('/config', (req, res) => res.json({ status: true, googleClientId: process.env.GOOGLE_CLIENT_ID || null, smtp: mailer.configured() }));

r.post('/register', authLimit, wrap(async (req, res) => {
  const { username, password, phone, email } = req.body || {};
  users.validate({ username: String(username || '').toLowerCase().trim(), password, email, phone });
  if (!email) return fail(res, 400, 'EMAIL_REQUIRED', 'Email wajib diisi (dipakai untuk reset sandi).');
  if (!phone) return fail(res, 400, 'PHONE_REQUIRED', 'Nomor HP wajib diisi.');
  const u = await users.create({ username, password, email, phone });
  await keys.createKey(u, { label: 'Default' }).catch(() => {});
  await afterLogin(req, res, u);
}));

r.post('/login', authLimit, wrap(async (req, res) => {
  const id = String(req.body?.username || '').toLowerCase().trim();
  const password = String(req.body?.password || '');
  if (!id || !password) return fail(res, 400, 'INVALID_INPUT', 'Isi username dan sandi.');
  const u = await db.one('SELECT * FROM users WHERE username = $1 OR email = $1', [id]);
  if (!u || !verifyPassword(password, u.password_hash)) return fail(res, 401, 'WRONG_CREDENTIALS', 'Username atau sandi salah.');
  await afterLogin(req, res, u);
}));

let googleClient = null;
r.post('/google', authLimit, wrap(async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return fail(res, 503, 'GOOGLE_NOT_CONFIGURED', 'Login Google belum diatur.');
  const credential = String(req.body?.credential || '');
  if (!credential) return fail(res, 400, 'INVALID_INPUT', 'Credential Google kosong.');
  if (!googleClient) { const { OAuth2Client } = require('google-auth-library'); googleClient = new OAuth2Client(clientId); }
  let p;
  try { p = (await googleClient.verifyIdToken({ idToken: credential, audience: clientId })).getPayload(); }
  catch { return fail(res, 401, 'INVALID_CREDENTIAL', 'Login Google gagal, coba lagi.'); }
  if (!p?.sub || !p.email || !p.email_verified) return fail(res, 403, 'EMAIL_NOT_VERIFIED', 'Email Google belum terverifikasi.');
  const email = p.email.toLowerCase();
  let u = await db.one('SELECT * FROM users WHERE google_sub = $1 OR email = $2 ORDER BY (google_sub = $1) DESC LIMIT 1', [p.sub, email]);
  if (u && !u.google_sub) u = await db.one('UPDATE users SET google_sub = $2 WHERE id = $1 RETURNING *', [u.id, p.sub]);
  if (!u) {
    let base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14);
    if (base.length < 3) base = 'user' + base;
    for (let i = 0; i < 6 && !u; i++) {
      const name = i ? `${base}${crypto.randomInt(100, 9999)}` : base;
      try { u = await users.create({ username: name, email, googleSub: p.sub }); }
      catch (e) { if (e.code !== 'USERNAME_TAKEN') throw e; }
    }
    if (!u) return fail(res, 500, 'CREATE_FAILED', 'Gagal membuat akun.');
    await keys.createKey(u, { label: 'Default' }).catch(() => {});
  }
  await afterLogin(req, res, u);
}));

r.post('/logout', wrap(async (req, res) => {
  const u = await userFromSession(req).catch(() => null);
  if (u) await db.q('UPDATE users SET session_version = session_version + 1 WHERE id = $1', [u.id]);
  clearSession(res);
  res.json({ status: true, redirect: '/login' });
}));

// Lupa sandi: kode 6 digit ke email (SMTP), berlaku 10 menit, maksimal 5 kali coba.
const forgotLimit = limiter({ windowMs: 15 * 60000, max: 5, key: req => 'f' + req.ip, message: 'Terlalu sering minta kode, tunggu 15 menit.' });
r.post('/forgot', forgotLimit, wrap(async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!users.EMAIL_RE.test(email)) return fail(res, 400, 'INVALID_EMAIL', 'Masukkan email yang terdaftar.');
  if (!mailer.configured()) return fail(res, 503, 'SMTP_NOT_CONFIGURED', 'Reset sandi lewat email belum diaktifkan. Hubungi developer di live chat.');
  const u = await db.one('SELECT * FROM users WHERE email = $1 AND NOT banned', [email]);
  if (u) {
    const code = String(crypto.randomInt(100000, 1000000));
    await db.q(`INSERT INTO reset_codes (user_id, code_hash, expires_at, attempts) VALUES ($1, $2, now() + interval '10 minutes', 0)
      ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0`, [u.id, sha256(code)]);
    try { await mailer.sendResetCode(email, u.username, code); }
    catch (e) { console.error('smtp error:', e.message); return fail(res, 502, 'EMAIL_FAILED', 'Email gagal dikirim, coba lagi nanti.'); }
  }
  res.json({ status: true, message: 'Kalau email itu terdaftar, kode sudah dikirim. Cek inbox/spam.' });
}));

r.post('/reset', authLimit, wrap(async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const code = String(req.body?.code || '').trim();
  const password = String(req.body?.password || '');
  if (password.length < 6) return fail(res, 400, 'INVALID_PASSWORD', 'Sandi baru minimal 6 karakter.');
  const row = await db.one('SELECT r.*, u.id AS uid FROM reset_codes r JOIN users u ON u.id = r.user_id WHERE u.email = $1', [email]);
  if (!row || new Date(row.expires_at) < new Date() || row.attempts >= 5) return fail(res, 400, 'CODE_INVALID', 'Kode salah atau kedaluwarsa. Minta kode baru.');
  if (!safeEqual(sha256(code), row.code_hash)) {
    await db.q('UPDATE reset_codes SET attempts = attempts + 1 WHERE user_id = $1', [row.uid]);
    return fail(res, 400, 'CODE_INVALID', 'Kode salah.');
  }
  await db.q('UPDATE users SET password_hash = $2, session_version = session_version + 1 WHERE id = $1', [row.uid, hashPassword(password)]);
  await db.q('DELETE FROM reset_codes WHERE user_id = $1', [row.uid]);
  res.json({ status: true, message: 'Sandi berhasil diganti. Silakan login.' });
}));

module.exports = r;
