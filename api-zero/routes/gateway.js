'use strict';
// /api/(path)/(fitur): cek apikey -> maintenance -> kunci -> plan -> kuota -> teruskan ke sumber.
const express = require('express');
const { Readable } = require('stream');
const endpoints = require('../lib/endpoints');
const keys = require('../lib/keys');
const tiers = require('../lib/tiers');
const settings = require('../lib/settings');
const { handle } = require('../lib/proxy');
const { unseal, isProviderHost } = require('../lib/hide');
const { isDev, userFromSession } = require('../lib/auth');
const { wrap, fail, limiter } = require('../lib/http');

const r = express.Router();
const perIp = limiter({ windowMs: 60000, max: Number(process.env.RATE_LIMIT_PER_MINUTE || 120), message: 'Terlalu banyak request per menit dari IP ini.' });

r.get('/api', (req, res) => res.redirect('/api/list'));
r.get('/api/list', wrap(async (req, res) => {
  const viewer = await userFromSession(req).catch(() => null);
  const list = await endpoints.list({ includeHidden: isDev(viewer) });
  res.set('Cache-Control', 'private, max-age=30');
  res.json({ status: true, creator: settings.peek('site').creator, total: list.length, categories: [...new Set(list.map(e => e.category))].sort(), plans: tiers.ENDPOINT_PLANS, endpoints: list });
}));
r.get('/api/status', wrap(async (req, res) => {
  const m = await settings.get('maintenance').catch(() => ({ on: false }));
  res.json({ status: true, creator: settings.peek('site').creator, maintenance: Boolean(m.on), uptime: Math.round(process.uptime()), time: new Date().toISOString() });
}));

// File dari provider lewat domain kita; alamat aslinya terenkripsi di token.
r.get('/api/media/:token', perIp, async (req, res) => {
  const href = unseal(req.params.token);
  let u; try { u = new URL(href); } catch {}
  if (!u || !isProviderHost(u.hostname)) return fail(res, 404, 'NOT_FOUND', 'File tidak ditemukan atau link sudah tidak valid.');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    const headers = {};
    if (req.get('range')) headers.Range = req.get('range');
    const up = await fetch(u, { headers, signal: ctl.signal });
    if (!up.ok && up.status !== 206) return fail(res, up.status === 404 ? 404 : 502, 'MEDIA_UNAVAILABLE', 'File sudah tidak tersedia.');
    res.status(up.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) { const v = up.headers.get(h); if (v) res.set(h, v); }
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Content-Disposition', 'inline');
    await new Promise(resolve => Readable.fromWeb(up.body).on('error', resolve).pipe(res).on('finish', resolve).on('error', resolve));
  } catch {
    if (!res.headersSent) fail(res, 504, 'MEDIA_TIMEOUT', 'File kelamaan diambil, coba lagi.');
  } finally { clearTimeout(timer); }
});

r.all('/api/*', perIp, wrap(async (req, res) => {
  if (!['GET', 'POST'].includes(req.method)) return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Pakai GET atau POST.');
  const spec = await endpoints.find(req.path);
  if (!spec) return fail(res, 404, 'NOT_FOUND', `Endpoint ${req.path} tidak ada. Lihat daftar di /api/list`);

  const key = String(req.query.apikey || req.get('x-api-key') || '').trim();
  if (!key) return fail(res, 401, 'APIKEY_REQUIRED', 'Tambahkan ?apikey=KEY_KAMU. Ambil key gratis di halaman Profile.');
  const user = await keys.userByKey(key);
  if (!user) return fail(res, 401, 'INVALID_APIKEY', 'API key tidak valid.');
  if (user.banned) return fail(res, 403, 'BANNED', 'Akun pemilik key ini diblokir.');
  const dev = isDev(user);

  const [m] = await Promise.all([settings.get('maintenance'), settings.get('site')]);
  if (m.on && !dev) return fail(res, 503, 'MAINTENANCE', m.message);
  if (spec.locked && !dev) return fail(res, 403, 'ENDPOINT_LOCKED', 'Endpoint ini sedang dikunci developer.');
  if (!dev && !tiers.canUse(user, spec.plan)) {
    const need = tiers.tier(spec.plan);
    return fail(res, 403, 'PLAN_REQUIRED', `Endpoint ini khusus plan ${need.name} ke atas. Upgrade di /price`, { requiredPlan: need.id });
  }
  const quota = await keys.consume(user);
  if (!quota.ok) return fail(res, 429, 'QUOTA_EXCEEDED', `Kuota harian ${quota.limit} request sudah habis. Reset jam 00:00 WIB, atau upgrade plan.`);
  res.set('X-Quota-Limit', quota.limit === null ? 'unlimited' : String(quota.limit));
  res.set('X-Quota-Remaining', quota.limit === null ? 'unlimited' : String(Math.max(0, quota.limit - quota.used)));
  // Gagal = kuota dikembalikan.
  res.on('finish', () => { if (res.statusCode >= 400) keys.refund(user); });
  delete req.query.apikey;
  await handle(spec, req, res);
}));

module.exports = r;
