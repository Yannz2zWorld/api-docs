'use strict';
// CDN server for a VPS (deploy/cdn-vps.md): serves the website's /cdn/<id> links with whole files,
// without Vercel's ~4.5 MB answer limit. Files stay where the website keeps them (Postgres for small
// ones, the R2/B2 bucket for big ones); this server only reads them. Uploads still go through the
// website. Needs DATABASE_URL and the bucket settings (S3_* or R2_*) in .env; PORT (default 3000).
require('dotenv').config({ quiet: true });
const express = require('express');
const cdnHttp = require('./services/cdnHttp');
const { healthCheck } = require('./lib/db');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use((req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); next(); });
app.get('/cdn/:id', cdnHttp.handler({ pieces: false }));
app.get('/', async (req, res) => {
  let db = false;
  try { db = Boolean(await healthCheck()); } catch {}
  res.json({ status: true, service: 'cdn', database: db });
});
app.use((req, res) => res.status(404).json({ status: false, error: 'NOT_FOUND' }));

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => console.log(`CDN server on port ${port}`));
}
module.exports = app;
