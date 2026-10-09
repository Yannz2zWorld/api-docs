'use strict';
// "Are you human?" check in front of the endpoint list, so a bot or scraper can't just download the
// catalog (GET /api/endpoints, /api/endpoints/status) the way Cloudflare keeps bots off other sites.
//
// Who gets the list: signed-in visitors (sign-in already has its own check) and visitors holding a
// pass cookie. Everyone else gets 403 HUMAN_CHECK_REQUIRED with a challenge; the page shows a small
// check box (views/human-check.js, never a full-screen page), and a solved challenge
// (POST /human-check) gives the pass for PASS_HOURS hours.
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
function hasPass(req, cookies) {
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

module.exports = { COOKIE, PASS_HOURS, POW_BITS, enabled, challenge, solve, pass, hasPass, gate, leadingZeroBits };
