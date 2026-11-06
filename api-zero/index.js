'use strict';
// API Zero — REST API gateway. Endpoint publik: /api/(path)/(fitur)
try { require('dotenv').config(); } catch {}
const path = require('path');
const { Readable } = require('stream');
const express = require('express');
const catalog = require('./lib/catalog');
const { handle } = require('./lib/proxy');
const { unseal, isProviderHost } = require('./lib/hide');

const SITE = process.env.SITE_NAME || 'API Zero';
const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');

// CORS terbuka: REST API publik.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Expose-Headers', 'Content-Type, Content-Length, X-RateLimit-Remaining');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Rate limit sederhana per IP (per instance).
const LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE || 60);
const hits = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v.start > 60000) hits.delete(k); }, 60000).unref();
function rateLimit(req, res, next) {
  if (!LIMIT) return next();
  const now = Date.now();
  let h = hits.get(req.ip);
  if (!h || now - h.start > 60000) { h = { start: now, n: 0 }; hits.set(req.ip, h); }
  h.n++;
  res.set('X-RateLimit-Limit', String(LIMIT));
  res.set('X-RateLimit-Remaining', String(Math.max(0, LIMIT - h.n)));
  if (h.n > LIMIT) return res.status(429).json({ status: false, creator: SITE, error: 'RATE_LIMITED', message: `Maksimal ${LIMIT} request per menit. Coba lagi sebentar.` });
  next();
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.raw({ type: req => !/json|x-www-form-urlencoded/i.test(req.get('content-type') || '') && req.method === 'POST', limit: '8mb' }));

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', index: 'index.html' }));

app.get('/api', (req, res) => res.redirect('/api/list'));
app.get('/api/list', (req, res) => {
  const endpoints = catalog.list();
  const categories = [...new Set(endpoints.map(e => e.category))];
  res.set('Cache-Control', 'public, max-age=600');
  res.json({ status: true, creator: SITE, total: endpoints.length, categories, endpoints });
});
app.get('/api/status', (req, res) => res.json({ status: true, creator: SITE, endpoints: catalog.size(), uptime: Math.round(process.uptime()), time: new Date().toISOString() }));

// File dari provider (gambar/video/audio) lewat domain kita; alamat aslinya terenkripsi di token.
app.get('/api/media/:token', rateLimit, async (req, res) => {
  const href = unseal(req.params.token);
  let u;
  try { u = new URL(href); } catch {}
  if (!u || !isProviderHost(u.hostname)) return res.status(404).json({ status: false, creator: SITE, error: 'NOT_FOUND', message: 'File tidak ditemukan atau link sudah tidak valid.' });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    const headers = {};
    if (req.get('range')) headers.Range = req.get('range');
    const r = await fetch(u, { headers, signal: ctl.signal });
    if (!r.ok && r.status !== 206) return res.status(r.status === 404 ? 404 : 502).json({ status: false, creator: SITE, error: 'MEDIA_UNAVAILABLE', message: 'File sudah tidak tersedia.' });
    res.status(r.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) { const v = r.headers.get(h); if (v) res.set(h, v); }
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Content-Disposition', 'inline');
    await new Promise(resolve => Readable.fromWeb(r.body).on('error', resolve).pipe(res).on('finish', resolve).on('error', resolve));
  } catch {
    if (!res.headersSent) res.status(504).json({ status: false, creator: SITE, error: 'MEDIA_TIMEOUT', message: 'File kelamaan diambil, coba lagi.' });
  } finally { clearTimeout(timer); }
});

app.all('/api/*', rateLimit, async (req, res) => {
  const spec = catalog.find(req.path);
  if (!spec) return res.status(404).json({ status: false, creator: SITE, error: 'NOT_FOUND', message: `Endpoint ${req.path} tidak ada. Lihat daftar lengkap di /api/list` });
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ status: false, creator: SITE, error: 'METHOD_NOT_ALLOWED', message: 'Pakai GET atau POST.' });
  try { await handle(spec, req, res); }
  catch (e) {
    console.error('proxy error', req.path, e && e.message);
    if (!res.headersSent) res.status(500).json({ status: false, creator: SITE, error: 'INTERNAL_ERROR', message: 'Terjadi kesalahan di server.' });
  }
});

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')));

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`${SITE} jalan di http://localhost:${port} — ${catalog.size()} endpoint`));
}
module.exports = app;
