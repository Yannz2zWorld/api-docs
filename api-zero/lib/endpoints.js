'use strict';
// Registry endpoint: bawaan + endpoint buatan developer (custom_endpoints), ditambah pengaturan
// developer per endpoint (plan, kunci, sembunyi, hapus) dari endpoint_settings. Cache 15 detik.
const db = require('./db');
const { BUILTIN, publicView, guessOutput } = require('./catalog');

const TTL = 15000;
let cache = null;

async function load() {
  if (cache && Date.now() - cache.at < TTL) return cache;
  const [overrides, customs] = await Promise.all([
    db.q('SELECT path, plan, locked, hidden, deleted FROM endpoint_settings'),
    db.q('SELECT path, spec FROM custom_endpoints')
  ]);
  const ov = new Map(overrides.map(o => [o.path, o]));
  const all = new Map();
  for (const s of BUILTIN) all.set(s.path.toLowerCase(), { ...s, source: 'builtin' });
  for (const c of customs) all.set(c.path.toLowerCase(), { ...c.spec, path: c.path, source: 'custom', output: c.spec.output || guessOutput(c.spec) });
  for (const s of all.values()) {
    const o = ov.get(s.path);
    if (!o) continue;
    if (o.plan) s.plan = o.plan;
    s.locked = o.locked; s.hidden = o.hidden; s.deleted = o.deleted;
  }
  cache = { at: Date.now(), all };
  return cache;
}
const invalidate = () => { cache = null; };

async function find(path) {
  const { all } = await load();
  const s = all.get(String(path).toLowerCase().replace(/\/+$/, ''));
  return s && !s.deleted ? s : null;
}
// includeHidden: developer melihat yang disembunyikan juga.
async function list({ includeHidden = false } = {}) {
  const { all } = await load();
  return [...all.values()]
    .filter(s => !s.deleted && (includeHidden || !s.hidden))
    .map(publicView)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
// Untuk Developer panel: semua, termasuk yang dihapus, plus sumbernya.
async function listForDeveloper() {
  const { all } = await load();
  return [...all.values()].map(s => ({ ...publicView(s), deleted: Boolean(s.deleted), source: s.source, server: s.server, upstream: s.server === 'custom' ? s.url : s.upstream }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
const builtinPaths = () => new Set(BUILTIN.map(s => s.path.toLowerCase()));

module.exports = { find, list, listForDeveloper, invalidate, builtinPaths };
