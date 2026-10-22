'use strict';
// Primitif keamanan: token acak + hash, HMAC CSRF, perbandingan waktu-konstan, cookie,
// rate limiter in-memory, header keamanan, dan hashing password (bcrypt).

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const newToken = prefix => `${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
const newId = (bytes = 18) => crypto.randomBytes(bytes).toString('base64url');

function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// CSRF token diturunkan dari token sesi: tidak perlu disimpan, tidak bisa ditebak tanpa SESSION_SECRET.
const csrfFor = (secret, sessionToken) => crypto.createHmac('sha256', secret).update('csrf:' + sessionToken).digest('base64url');

// Hash dummy agar waktu respons login sama ketika nomor tidak terdaftar (anti user-enumeration).
let dummyHash = null;
async function hashPassword(password, cost = 12) { return bcrypt.hash(String(password), cost); }
async function verifyPassword(password, hash) {
  if (!hash) {
    dummyHash = dummyHash || await bcrypt.hash('dummy-password-for-timing', 10);
    await bcrypt.compare(String(password), dummyHash);
    return false;
  }
  return bcrypt.compare(String(password), hash);
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* cookie rusak diabaikan */ }
  }
  return out;
}

function setCookie(res, name, value, { maxAge, secure, sameSite = 'Lax', path = '/' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', `SameSite=${sameSite}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${Math.floor(maxAge)}`);
  if (secure) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [prev] : []), parts.join('; ')]);
}
const clearCookie = (res, name, opts = {}) => setCookie(res, name, '', { ...opts, maxAge: 0 });

// Rate limiter sliding-window per key (dipakai sebagai lapisan pertama; brute force juga dicek di DB).
function rateLimiter({ windowMs, max, keyFn = req => req.ip, code = 'RATE_LIMITED' }) {
  const hits = new Map();
  const mw = (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const list = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (list.length >= max) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - list[0])) / 1000)));
      return res.status(429).json({ success: false, error: code, message: 'Terlalu banyak request. Coba lagi nanti.' });
    }
    list.push(now);
    hits.set(key, list);
    if (hits.size > 10000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
    next();
  };
  mw.reset = () => hits.clear();
  return mw;
}

function securityHeaders(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'same-origin');
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https://lh3.googleusercontent.com; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

const clientIp = req => String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '').slice(0, 64) || null;

module.exports = { sha256, newToken, newId, safeEqual, csrfFor, hashPassword, verifyPassword, parseCookies, setCookie, clearCookie, rateLimiter, securityHeaders, clientIp };
