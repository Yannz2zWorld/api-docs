'use strict';
// Memuat .env web database (KEY=VALUE per baris, # komentar). Nilai yang sudah ada di environment
// proses (mis. dari pm2 / systemd) tidak ditimpa. Isi .env tidak pernah dicatat ke log.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function loadDotEnv(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return 0;
  let n = 0;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    if (process.env[m[1]] === undefined) { process.env[m[1]] = value; n++; }
  }
  return n;
}

module.exports = { loadDotEnv };
