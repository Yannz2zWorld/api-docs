'use strict';
// API Zero — REST API platform. Endpoint publik: /api/(path)/(fitur)?apikey=KEY
try { require('dotenv').config({ quiet: true }); } catch {}
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
app.get('/favicon.ico', (req, res) => res.redirect(301, '/assets/favicon.svg'));
app.get('/favicon.svg', (req, res) => res.redirect(301, '/assets/favicon.svg'));

// Status situs publik (bubble maintenance di semua halaman, termasuk login).
app.get('/site/status', (req, res, next) => settings.get('maintenance').then(m => res.json({ status: true, maintenance: m, site: process.env.SITE_NAME || 'API Zero' })).catch(() => res.json({ status: true, maintenance: { on: false }, site: process.env.SITE_NAME || 'API Zero' })));

app.use(require('./routes/gateway'));
app.use(sameOrigin);
app.use('/auth', require('./routes/auth'));
app.use('/billing', require('./routes/billing'));
app.use('/chat', require('./routes/chat'));
app.use('/dev', require('./routes/dev'));
app.use(require('./routes/me'));

// ---------------------------------------------------------------- halaman
const fs = require('fs');
const HEAD = fs.readFileSync(path.join(__dirname, 'views', '_head.txt'), 'utf8');
const pages = new Map();
function render(name) {
  if (!pages.has(name) || process.env.NODE_ENV === 'development') pages.set(name, fs.readFileSync(path.join(__dirname, 'views', name + '.html'), 'utf8').replace('<!--HEAD-->', HEAD));
  return pages.get(name);
}
const page = name => (req, res) => { res.set('Cache-Control', 'no-store'); res.type('html').send(render(name)); };
app.get('/', (req, res, next) => userFromSession(req).then(u => res.redirect(u ? '/home' : '/login')).catch(() => res.redirect('/login')));
app.get('/login', (req, res, next) => userFromSession(req).then(u => u ? res.redirect('/home') : page('login')(req, res)).catch(() => page('login')(req, res)));
for (const name of ['home', 'playground', 'profile', 'price', 'chat']) app.get('/' + name, requireUser, page(name));
app.get('/developer', requireDev, page('developer'));

app.use((req, res) => {
  if (req.accepts('html') && req.method === 'GET') return res.status(404).type('html').send(render('404'));
  fail(res, 404, 'NOT_FOUND', 'Halaman tidak ditemukan.');
});
app.use(errorHandler);

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`${process.env.SITE_NAME || 'API Zero'} jalan di http://localhost:${port}`));
}
module.exports = app;
