'use strict';
// API Zero — REST API platform. Endpoint publik: /api/(path)/(fitur)?apikey=KEY
try { require('dotenv').config({ quiet: true }); } catch {}
const fs = require('fs');
const path = require('path');
const express = require('express');
const settings = require('./lib/settings');
const { userFromSession, requireUser, requireDev } = require('./lib/auth');
const { sameOrigin, errorHandler, fail } = require('./lib/http');

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.path.startsWith('/api/')) {
    // REST API publik: boleh dipanggil dari mana saja (pakai apikey, tanpa cookie).
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
    res.set('Access-Control-Expose-Headers', 'Content-Type, Content-Length, X-Quota-Limit, X-Quota-Remaining');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  } else res.set('X-Frame-Options', 'DENY');
  next();
});

app.use(express.json({ limit: '600kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.raw({ type: req => req.method === 'POST' && req.path.startsWith('/api/') && !/json|x-www-form-urlencoded/i.test(req.get('content-type') || ''), limit: '8mb' }));

app.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

// Status & profil situs publik (bubble maintenance, nama, logo, link) dipakai semua halaman, termasuk login.
app.get('/site/status', async (req, res) => {
  const [m, site] = await Promise.all([settings.get('maintenance'), settings.get('site')]).catch(() => [{ on: false }, settings.peek('site')]);
  res.json({ status: true, maintenance: m, site: settings.publicSite(site) });
});
const DEFAULT_FAVICON = fs.readFileSync(path.join(__dirname, 'public', 'favicon.svg'));
function sendDataUrl(req, res, dataUrl) {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) return false;
  res.set('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.type(m[1]).send(Buffer.from(m[2], 'base64'));
  return true;
}
app.get(['/site/favicon', '/favicon.ico'], async (req, res) => {
  const site = await settings.get('site').catch(() => settings.peek('site'));
  if (sendDataUrl(req, res, site.favicon)) return;
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('image/svg+xml').send(DEFAULT_FAVICON);
});
app.get('/site/logo', async (req, res) => {
  const site = await settings.get('site').catch(() => settings.peek('site'));
  if (!sendDataUrl(req, res, site.logo)) res.status(404).end();
});

app.use(require('./routes/gateway'));
app.use(sameOrigin);
app.use('/auth', require('./routes/auth'));
app.use('/billing', require('./routes/billing'));
app.use('/chat', require('./routes/chat'));
app.use('/dev', require('./routes/dev'));
app.use(require('./routes/me'));

// ---------------------------------------------------------------- halaman
const HEAD = fs.readFileSync(path.join(__dirname, 'views', '_head.txt'), 'utf8');
const views = new Map();
function view(name) {
  if (!views.has(name) || process.env.NODE_ENV === 'development') views.set(name, fs.readFileSync(path.join(__dirname, 'views', name + '.html'), 'utf8'));
  return views.get(name);
}
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = (c, fallback) => /^#[0-9a-f]{6}$/i.test(c || '') ? c : fallback;
// Halaman diisi profil situs dari Developer panel: nama, favicon, warna, deskripsi, logo.
async function render(name) {
  const site = await settings.get('site').catch(() => settings.peek('site'));
  const pub = settings.publicSite(site);
  const head = HEAD
    .replace('href="/assets/favicon.svg" type="image/svg+xml"', `href="${pub.faviconUrl}"`)
    .replace('content="#ffd84d"', `content="${color(site.color, '#ffd84d')}"`)
    + `\n<meta name="description" content="${escHtml(site.description)}">`
    + `\n<style>:root{--yellow:${color(site.color, '#ffd84d')};--pink:${color(site.accent, '#ff8fb8')}}</style>`
    + `\n<script>window.SITE=${JSON.stringify(pub).replace(/</g, '\\u003c')};</script>`;
  const logo = site.logo ? `<span class="logo-badge logo-img"><img src="${pub.logoUrl}" alt=""></span>` : `<span class="logo-badge">${escHtml(site.logoText || '0')}</span>`;
  return view(name).replace(/<span class="logo-badge">0<\/span>/g, () => logo)
    .replace(/API Zero/g, () => escHtml(site.name)).replace('{{TAGLINE}}', () => escHtml(site.tagline))
    .replace('<!--HEAD-->', () => head);
}
const page = name => (req, res, next) => render(name).then(html => { res.set('Cache-Control', 'no-store'); res.type('html').send(html); }).catch(next);
app.get('/', (req, res, next) => userFromSession(req).then(u => res.redirect(u ? '/home' : '/login')).catch(() => res.redirect('/login')));
app.get('/login', (req, res, next) => userFromSession(req).then(u => u ? res.redirect('/home') : page('login')(req, res, next)).catch(() => page('login')(req, res, next)));
for (const name of ['home', 'playground', 'profile', 'price', 'chat']) app.get('/' + name, requireUser, page(name));
app.get('/developer', requireDev, page('developer'));

app.use((req, res) => {
  if (req.accepts('html') && req.method === 'GET') return render('404').then(html => res.status(404).type('html').send(html)).catch(() => res.status(404).end());
  fail(res, 404, 'NOT_FOUND', 'Halaman tidak ditemukan.');
});
app.use(errorHandler);

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`${settings.peek('site').name} jalan di http://localhost:${port}`));
}
module.exports = app;
