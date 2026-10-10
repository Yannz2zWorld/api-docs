'use strict';
// Developer panel → Endpoints → "Edit": an endpoint's name, path, description and category as the
// site shows them (endpoints.custom_*, migration 025). Empty = what the endpoint's code says.
//
// A new path only changes the address callers use. Internally it is still the same endpoint, under
// its original path: tier, lock, quota, checks, the Error tab and backups (config/endpointGroups.js)
// all keep working. The old address answers 404 ENDPOINT_MOVED with the new one. Every running
// instance picks edits up within REFRESH_MS.
const { query } = require('../lib/db');

const REFRESH_MS = 30000;
let state = { at: 0, to: new Map(), from: new Map(), meta: new Map() };
const missing = e => e && (e.code === '42P01' || e.code === '42703');
const clean = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

async function load(force = false) {
  if (!force && Date.now() - state.at < REFRESH_MS) return state;
  let rows = [];
  try {
    rows = await query(`SELECT path, custom_name, custom_description, custom_path, custom_category FROM endpoints
                        WHERE custom_name IS NOT NULL OR custom_description IS NOT NULL OR custom_path IS NOT NULL OR custom_category IS NOT NULL`);
  } catch (e) { if (!missing(e)) throw e; }
  const next = { at: Date.now(), to: new Map(), from: new Map(), meta: new Map() };
  for (const r of rows) {
    if (r.custom_path) { next.to.set(r.path, r.custom_path); next.from.set(r.custom_path, r.path); }
    next.meta.set(r.path, { name: r.custom_name, desc: r.custom_description, category: r.custom_category });
  }
  state = next;
  return state;
}

// The address callers use for an endpoint, and the endpoint behind an address.
const publicPath = path => state.to.get(path) || path;
const originalOf = path => state.from.get(path) || null;
const movedTo = path => state.to.get(path) || null;
const metaOf = path => state.meta.get(path) || null;

const PATH_RE = /^\/api\/[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/;
// Paths the app already answers (plugin routes and the site's own /api pages), so a new path can't hide them.
function routeTaken(app, p) {
  const seen = layers => layers.some(l => (l.route && l.route.path === p) || (l.handle && l.handle.stack && seen(l.handle.stack)));
  return seen((app._router || app.router)?.stack || []);
}

// Validates and saves an edit. fields: { name, description, path, category } ('' or null = back to the code's).
async function save(app, row, fields) {
  const name = clean(fields.name), description = clean(fields.description), category = clean(fields.category);
  let path = clean(fields.path);
  if (path === row.path) path = null;
  const bad = (code, message) => Object.assign(new Error(message), { status: 400, code });
  if (name && name.length > 80) throw bad('INVALID_NAME', 'Nama maksimal 80 karakter.');
  if (description && description.length > 300) throw bad('INVALID_DESCRIPTION', 'Deskripsi maksimal 300 karakter.');
  if (category && (category.length > 30 || !/^[\p{L}\p{N} &-]+$/u.test(category))) throw bad('INVALID_CATEGORY', 'Kategori cuma boleh huruf, angka, spasi, & dan -, maksimal 30 karakter.');
  if (path) {
    path = path.toLowerCase().replace(/\/+$/, '');
    if (!PATH_RE.test(path) || path.length > 100) throw bad('INVALID_PATH', 'Path harus diawali /api/, cuma huruf kecil, angka, - _ . dan /, maksimal 100 karakter.');
    if (/^\/api\/alt\d*\//.test(path)) throw bad('INVALID_PATH', 'Path /api/alt… dipakai buat cadangan.');
    const loaded = app.locals.loadedPluginPaths || new Set();
    const other = (await query('SELECT path FROM endpoints WHERE path=$1 OR (custom_path=$1 AND path<>$2)', [path, row.path]).catch(e => { if (missing(e)) return query('SELECT path FROM endpoints WHERE path=$1', [path]); throw e; }));
    if (loaded.has(path) || other.length || routeTaken(app, path)) throw Object.assign(new Error(`Path ${path} udah dipakai endpoint lain.`), { status: 409, code: 'PATH_TAKEN' });
  }
  await query('UPDATE endpoints SET custom_name=$2, custom_description=$3, custom_path=$4, custom_category=$5, updated_at=now() WHERE id=$1', [row.id, name, description, path, category]);
  await load(true);
  return { name, description, path, category };
}

module.exports = { load, save, publicPath, originalOf, movedTo, metaOf, missing, REFRESH_MS, _reset: () => { state = { at: 0, to: new Map(), from: new Map(), meta: new Map() }; } };
