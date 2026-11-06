'use strict';
const SITE = () => require('./settings').peek('site').creator;
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (res, status, error, message, extra = {}) => res.status(status).json({ status: false, creator: SITE(), error, message, ...extra });

// Rate limit sederhana per instance (key -> jendela waktu).
function limiter({ windowMs, max, key = req => req.ip, message = 'Terlalu banyak percobaan, tunggu sebentar.' }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const k = key(req), now = Date.now();
    let h = hits.get(k);
    if (!h || now - h.start > windowMs) { h = { start: now, n: 0 }; hits.set(k, h); }
    if (++h.n > max) return fail(res, 429, 'RATE_LIMITED', message);
    next();
  };
}

// Tolak POST/PATCH/DELETE dari situs lain (CSRF) untuk route yang pakai cookie.
function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const site = req.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return fail(res, 403, 'CSRF_BLOCKED', 'Request ditolak.');
  const origin = req.get('origin');
  if (origin) { try { if (new URL(origin).host !== req.get('host')) return fail(res, 403, 'CSRF_BLOCKED', 'Request ditolak.'); } catch { return fail(res, 403, 'CSRF_BLOCKED', 'Request ditolak.'); } }
  next();
}

function errorHandler(e, req, res, next) {
  if (res.headersSent) return next(e);
  if (e.type === 'entity.too.large') return fail(res, 413, 'TOO_LARGE', 'Data terlalu besar.');
  if (e.type === 'entity.parse.failed') return fail(res, 400, 'INVALID_JSON', 'Body JSON tidak valid.');
  if (e.status && e.code) return fail(res, e.status, e.code, e.message);
  if (e.code === 'DB_NOT_CONFIGURED' || e.code === 'AUTH_NOT_CONFIGURED') return fail(res, 503, e.code, e.message);
  if (e.code === 'ECONNREFUSED' || /connect|ENOTFOUND|timeout/i.test(e.message || '')) return fail(res, 503, 'DATABASE_UNAVAILABLE', 'Database tidak bisa dihubungi.');
  console.error('error', req.method, req.path, e);
  fail(res, 500, 'INTERNAL_ERROR', 'Terjadi kesalahan di server.');
}

module.exports = { wrap, fail, limiter, sameOrigin, errorHandler, SITE };
