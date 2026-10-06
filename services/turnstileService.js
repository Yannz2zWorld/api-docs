'use strict';
// Cloudflare Turnstile: bot check on the email/password forms (login, register, forgot password,
// resend code). Off until both keys are set in the environment, so the forms keep working before
// setup. Config: TURNSTILE_SITE_KEY (public, shown to the browser) and TURNSTILE_SECRET_KEY (server
// only, never logged or returned). Google sign-in has Google's own bot protection and is not gated.
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
    return { ok: false, status: 403, error: 'TURNSTILE_FAILED', message: 'Verifikasi keamanan gagal atau kedaluwarsa. Coba lagi.' };
  } catch {
    // Fail closed: without a verdict the request is refused.
    return { ok: false, status: 503, error: 'TURNSTILE_UNAVAILABLE', message: 'Verifikasi keamanan sedang tidak bisa dihubungi. Coba lagi sebentar lagi.' };
  } finally {
    clearTimeout(timer);
  }
}

// Express middleware: reads the token from the JSON body ("turnstileToken") and drops it after use.
function guard() {
  return async (req, res, next) => {
    if (req.method !== 'POST' || !isEnabled()) return next();
    const token = req.body && req.body.turnstileToken;
    if (req.body) delete req.body.turnstileToken;
    const ip = (req.ip || '').replace(/^::ffff:/, '') || undefined;
    const result = await verify(token, ip);
    if (result.ok) return next();
    res.status(result.status).json({ success: false, error: result.error, message: result.message });
  };
}

module.exports = { siteKey, isEnabled, verify, guard };
