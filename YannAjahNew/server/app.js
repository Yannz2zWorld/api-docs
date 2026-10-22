'use strict';
// Express app backend lisensi + dashboard YannAjahNew. createApp() dipakai server/index.js dan test.

const path = require('path');
const express = require('express');
const { securityHeaders } = require('./lib/security');
const { HttpError, fromDatabase } = require('./lib/errors');
const { pending } = require('./lib/migrate');
const { createGoogle } = require('./lib/google');

function createApp({ db, cfg, googleClient = createGoogle(cfg.google), logger = console } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', cfg.trustProxy ? 1 : false);
  app.use(securityHeaders);
  app.use(express.json({ limit: '64kb' }));

  // Request yang mengubah data dari browser wajib dari origin dashboard sendiri (lapisan CSRF kedua).
  app.use(['/auth', '/api/dash'], (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (!origin || origin !== cfg.origin) return res.status(403).json({ success: false, error: 'ORIGIN_REJECTED', message: 'Origin request tidak diizinkan.' });
    next();
  });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/favicon.ico', (req, res) => res.status(204).end());
  app.get('/health/ready', async (req, res) => {
    const dbh = await db.healthCheck().catch(() => ({ ok: false }));
    const waiting = dbh.ok ? await pending(db).catch(() => null) : null;
    const ready = dbh.ok && Array.isArray(waiting) && waiting.length === 0;
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', database: dbh.ok, migrations_pending: waiting ? waiting.length : null });
  });

  app.use(require('./routes/botApi')({ db, cfg }));
  app.use(require('./routes/auth')({ db, cfg, googleClient }));
  app.use(require('./routes/dashboardApi')({ db, cfg }));

  const pub = path.join(__dirname, 'public');
  app.use('/assets', express.static(path.join(pub, 'assets'), { maxAge: '1h', index: false }));
  app.get('/', (req, res) => res.sendFile(path.join(pub, 'index.html')));
  app.get('/dashboard', (req, res) => res.sendFile(path.join(pub, 'dashboard.html')));

  app.use('/api', (req, res) => res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Endpoint tidak ada.' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const e = err instanceof HttpError ? err : fromDatabase(err) || (err.type === 'entity.parse.failed' ? new HttpError(400, 'INVALID_JSON', 'Body JSON tidak valid.') : err.type === 'entity.too.large' ? new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Body terlalu besar.') : null);
    if (e) return res.status(e.status).json({ success: false, error: e.code, message: e.message, ...e.extra });
    logger.error('Server error:', { path: req.path, code: err.code || err.name || 'ERROR' });
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Terjadi kesalahan di server.' });
  });
  return app;
}

module.exports = { createApp };
