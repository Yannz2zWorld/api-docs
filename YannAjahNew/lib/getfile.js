'use strict';
// Ambil file source bot (owner, Lena AI .getfile). Hanya file teks di folder bot; secret & data
// runtime TIDAK pernah ikut: .env, session WhatsApp, database lokal (termasuk token lisensi), log.
const fs = require('fs');
const path = require('path');
const { UsageError } = require('../library/errors');

const ROOT = fs.realpathSync(path.resolve(__dirname, '..'));
const SKIP_DIRS = new Set(['node_modules', '.git', 'session', 'sessions', 'dist', 'reports', 'logs', 'tmp', 'temp', '.cache']);
const SKIP_PATHS = ['library/database'];
const SKIP_FILES = new Set(['.env', 'creds.json', 'license-session.json']);
const EXT = new Set(['.js', '.json', '.md', '.txt', '.sql', '.html', '.css', '.yml', '.yaml']);
const MAX_FILES = 3000;
const MAX_BYTES = 5 * 1024 * 1024;

const allowedName = name => !SKIP_FILES.has(name) && (EXT.has(path.extname(name)) || name === '.env.example');

// Daftar file (path relatif bergaya POSIX), urut alfabet.
function listFiles() {
  const out = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (out.length >= MAX_FILES) return;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !SKIP_PATHS.includes(r)) walk(path.join(dir, e.name), r); }
      else if (e.isFile() && allowedName(e.name)) out.push(r);
    }
  })(ROOT, '');
  return out;
}

// Nomor dari daftar atau path relatif yang ADA di daftar (jadi pengecualian di atas selalu berlaku).
function resolveFile(input) {
  const files = listFiles();
  const arg = String(input || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
  const rel = /^\d+$/.test(arg) ? files[Number(arg) - 1] : files.find(f => f === arg);
  if (!rel) return null;
  const abs = path.join(ROOT, rel);
  const real = fs.realpathSync(abs);
  if (real !== abs || !real.startsWith(ROOT + path.sep)) throw new UsageError('File ini tidak bisa diambil.');
  if (fs.statSync(real).size > MAX_BYTES) throw new UsageError('File terlalu besar (maks 5 MB).');
  return { rel, abs: real };
}

// Teks daftar: semua file, atau yang path-nya mengandung kata kunci.
function renderList(filter = '') {
  const files = listFiles();
  const q = filter.toLowerCase();
  const rows = files.map((f, i) => [i + 1, f]).filter(([, f]) => !q || f.toLowerCase().includes(q));
  if (!rows.length) return null;
  return rows.map(([n, f]) => `${n}. ${f}`).join('\n');
}

const mimeOf = rel => (rel.endsWith('.json') ? 'application/json' : rel.endsWith('.js') ? 'application/javascript' : 'text/plain');

module.exports = { ROOT, listFiles, resolveFile, renderList, mimeOf };
