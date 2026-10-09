'use strict';
// Cloudflare Turnstile: every way of signing in (email/password, register, email code, password
// reset, Google button and Google redirect) needs a passed Turnstile check. Off until both keys are
// set in the environment, so sign-in keeps working before setup. Config: TURNSTILE_SITE_KEY (public,
// shown to the browser) and TURNSTILE_SECRET_KEY (server only, never logged or returned).
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const siteKey = () => process.env.TURNSTILE_SITE_KEY || '';
const isEnabled = () => Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

// → { ok: true } | { ok: false, status, error, message }
async function verify(token, remoteIp) {
  if (typeof token !== 'string' || !token || token.length > 2048) {
    return { ok: false, status: 400, error: 'TURNSTILE_REQUIRED', message: 'Selesaikan verifikasi keamanan (Cloudflare) dulu.' };
  }
  const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
  if (remoteIp) form.set('remoteip', remoteIp);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(VERIFY_URL, { method: 'POST', body: form, signal: controller.signal });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.success === true) return { ok: true };
    return { ok: false, status: 403, error: 'TURNSTILE_FAILED', message: 'Verifikasi keamanan gagal atau udah kedaluwarsa. Coba lagi ya.' };
  } catch {
    // Fail closed: without a verdict the request is refused.
    return { ok: false, status: 503, error: 'TURNSTILE_UNAVAILABLE', message: 'Verifikasi keamanan lagi nggak bisa dihubungi. Coba lagi bentar ya.' };
  } finally {
    clearTimeout(timer);
  }
}

// Express middleware: reads the token from the JSON body ("turnstileToken") and drops it after use.
// A visitor who passed the entry check (services/humanCheckService.js) isn't asked again.
const passed = req => { const h = require('./humanCheckService'); return h.enabled() && h.hasPass(req); };
function guard() {
  return async (req, res, next) => {
    if (req.method !== 'POST' || !isEnabled() || passed(req)) { if (req.body) delete req.body.turnstileToken; return next(); }
    const token = req.body && req.body.turnstileToken;
    if (req.body) delete req.body.turnstileToken;
    const ip = (req.ip || '').replace(/^::ffff:/, '') || undefined;
    const result = await verify(token, ip);
    if (result.ok) return next();
    res.status(result.status).json({ success: false, error: result.error, message: result.message });
  };
}

// For the Google redirect flow (GET /auth/google?ts=<token>): without a passed check the browser is
// sent back to the login page instead of to Google, so no OAuth state is ever issued.
function redirectGuard(back = '/?auth=turnstile') {
  return async (req, res, next) => {
    if (!isEnabled() || passed(req)) return next();
    const ip = (req.ip || '').replace(/^::ffff:/, '') || undefined;
    const result = await verify(req.query.ts, ip);
    if (result.ok) return next();
    res.redirect(back);
  };
}

module.exports = { siteKey, isEnabled, verify, guard, redirectGuard };
