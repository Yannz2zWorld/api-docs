'use strict';
// Sesi login (cookie bertanda tangan HMAC) + middleware.
const db = require('./db');
const { hmac, safeEqual } = require('./crypto');
const tiers = require('./tiers');

const COOKIE = 'zero_session';
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

const devList = name => String(process.env[name] || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
// Akun developer ditentukan dari env DEVELOPER_EMAILS / DEVELOPER_USERNAMES, atau tier 'developer' di DB.
const isDevIdentity = u => Boolean(u && ((u.email && devList('DEVELOPER_EMAILS').includes(u.email.toLowerCase())) || devList('DEVELOPER_USERNAMES').includes(String(u.username).toLowerCase())));
const isDev = u => Boolean(u && (u.tier === 'developer' || isDevIdentity(u)));

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setSession(req, res, user) {
  const payload = Buffer.from(JSON.stringify({ u: String(user.id), v: user.session_version, e: Date.now() + MAX_AGE_MS })).toString('base64url');
  const value = `${payload}.${hmac('session', payload)}`;
  const secure = req.secure || req.get('x-forwarded-proto') === 'https';
  res.append('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_MS / 1000}${secure ? '; Secure' : ''}`);
}
function clearSession(res) { res.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`); }

async function userFromSession(req) {
  if (req._user !== undefined) return req._user;
  req._user = null;
  const raw = parseCookies(req)[COOKIE];
  if (!raw || !raw.includes('.')) return null;
  const [payload, sig] = raw.split('.');
  if (!safeEqual(sig, hmac('session', payload))) return null;
  let data; try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
  if (!data || data.e < Date.now()) return null;
  const u = await db.one('SELECT * FROM users WHERE id = $1', [data.u]).catch(() => null);
  if (!u || u.banned || u.session_version !== data.v) return null;
  req._user = u;
  return u;
}

// Data user yang aman dikirim ke browser.
function publicUser(u, { self = false } = {}) {
  const t = tiers.effectiveTier(u);
  const out = {
    id: u.public_id,
    username: u.username,
    tier: isDev(u) ? 'developer' : t.id,
    tierName: isDev(u) ? 'Developer' : t.name,
    avatar: u.avatar ? `/u/${u.public_id}/avatar?v=${u.avatar_v}` : null,
    joinedAt: u.created_at
  };
  if (self) Object.assign(out, {
    email: u.email, phone: u.phone, balance: Number(u.balance), hasPassword: Boolean(u.password_hash), google: Boolean(u.google_sub),
    tierExpiresAt: tiers.isPaid(t.id) ? u.tier_expires_at : null, isDeveloper: isDev(u)
  });
  return out;
}

const wantsHtml = req => req.method === 'GET' && /text\/html/.test(req.get('accept') || '');
function requireUser(req, res, next) {
  userFromSession(req).then(u => {
    if (u) return next();
    if (wantsHtml(req)) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
    res.status(401).json({ status: false, error: 'LOGIN_REQUIRED', message: 'Silakan login dulu.' });
  }).catch(next);
}
function requireDev(req, res, next) {
  userFromSession(req).then(u => {
    if (isDev(u)) return next();
    if (wantsHtml(req)) return res.redirect(u ? '/home' : '/login');
    res.status(403).json({ status: false, error: 'DEVELOPER_ONLY', message: 'Khusus developer.' });
  }).catch(next);
}

module.exports = { setSession, clearSession, userFromSession, publicUser, requireUser, requireDev, isDev, isDevIdentity, parseCookies };
