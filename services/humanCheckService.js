'use strict';
// One "not a robot" check at the door, the way Cloudflare keeps bots off a site: the visitor passes
// it once on the entry page (the sign-in page, a small box, never a full-screen page) and the pass
// (a cookie, PASS_HOURS hours) covers everything after that:
//   - signing in / registering / Google sign-in (no second check there),
//   - the public pages (API Docs, Playground, Pricing, 3D): without a pass they send the visitor to
//     the entry page first and back again once it's passed,
//   - the endpoint list (GET /api/endpoints*): without a pass or a session, 403 for bots.
//
// The challenge is Cloudflare Turnstile when TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY are set,
// otherwise a proof-of-work puzzle the browser solves in a second or two (a plain HTTP client never
// runs it). API calls with an API key are not affected. HUMAN_CHECK=off turns the whole check off.
const crypto = require('crypto');
const turnstile = require('./turnstileService');

const COOKIE = 'yannz_human';
const PASS_HOURS = 12;
const POW_BITS = 15;               // about 30k hashes on average
const CHALLENGE_MINUTES = 10;

const enabled = () => String(process.env.HUMAN_CHECK || 'on').toLowerCase() !== 'off';
const secret = () => 'human:' + (process.env.AUTH_SECRET || '');
const mac = s => crypto.createHmac('sha256', secret()).update(s).digest('base64url');
const uaHash = req => crypto.createHash('sha256').update(String(req.get('user-agent') || '')).digest('base64url').slice(0, 16);
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function challenge() {
  if (turnstile.isEnabled()) return { mode: 'turnstile', siteKey: turnstile.siteKey() };
  const body = `${Date.now() + CHALLENGE_MINUTES * 60000}.${crypto.randomBytes(12).toString('base64url')}`;
  return { mode: 'pow', salt: `${body}.${mac(body)}`, bits: POW_BITS };
}

function leadingZeroBits(buf) {
  let n = 0;
  for (const byte of buf) { if (byte === 0) { n += 8; continue; } n += Math.clz32(byte) - 24; break; }
  return n;
}
const used = new Map();   // solved puzzles (per running instance): each one works once
function powOk(salt, nonce) {
  if (typeof salt !== 'string' || typeof nonce !== 'string' || salt.length > 200 || nonce.length > 32) return false;
  const i = salt.lastIndexOf('.');
  const body = salt.slice(0, i), sig = salt.slice(i + 1);
  if (i < 0 || !same(sig, mac(body)) || Number(body.split('.')[0]) < Date.now() || used.has(salt)) return false;
  if (leadingZeroBits(crypto.createHash('sha256').update(`${salt}:${nonce}`).digest()) < POW_BITS) return false;
  const now = Date.now();
  for (const [k, exp] of used) if (exp < now) used.delete(k);
  used.set(salt, Number(body.split('.')[0]));
  return true;
}

// → { ok: true } | { ok: false, status, error, message }
async function solve(req) {
  const b = req.body || {};
  if (turnstile.isEnabled()) return turnstile.verify(b.turnstileToken, (req.ip || '').replace(/^::ffff:/, '') || undefined);
  if (powOk(b.salt, b.nonce)) return { ok: true };
  return { ok: false, status: 403, error: 'HUMAN_CHECK_FAILED', message: 'Verifikasinya gagal atau udah kedaluwarsa. Coba lagi ya.' };
}

function pass(req) {
  const exp = Date.now() + PASS_HOURS * 3600000;
  return `${exp}.${mac(`${exp}.${uaHash(req)}`)}`;
}
function cookiesOf(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim(); }
  return out;
}
function hasPass(req, cookies = cookiesOf(req)) {
  const v = String(cookies[COOKIE] || '');
  const i = v.indexOf('.');
  if (i < 0) return false;
  const exp = v.slice(0, i);
  return Number(exp) > Date.now() && same(v.slice(i + 1), mac(`${exp}.${uaHash(req)}`));
}

// Middleware for the catalog routes. isSignedIn(req) and cookies(req) come from index.js.
function gate({ isSignedIn, cookies }) {
  return (req, res, next) => {
    if (!enabled() || isSignedIn(req) || hasPass(req, cookies(req))) return next();
    res.set('Cache-Control', 'no-store');
    res.status(403).json({ success: false, error: 'HUMAN_CHECK_REQUIRED', message: 'Buktikan dulu kamu bukan robot.', check: challenge() });
  };
}

// The public pages: without a session or a pass, first the entry page (then back here).
const GUARDED_PAGES = new Set(['/api', '/api/playground', '/pricing', '/3d', '/scythe']);
function pageGate({ isSignedIn }) {
  return (req, res, next) => {
    if (req.method !== 'GET' || !GUARDED_PAGES.has(req.path) || !enabled() || isSignedIn(req) || hasPass(req)) return next();
    res.set('Cache-Control', 'no-store');
    return res.redirect(302, '/?next=' + encodeURIComponent(req.originalUrl));
  };
}

module.exports = { COOKIE, PASS_HOURS, POW_BITS, GUARDED_PAGES, enabled, challenge, solve, pass, hasPass, gate, pageGate, leadingZeroBits };
