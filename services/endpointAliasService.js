'use strict';
// Developer panel → Endpoints → "Tampilkan": a backup-only endpoint (/api/alt…/…, see
// config/endpointGroups.js) listed as a version of the endpoint it backs up, e.g.
// /api/alt3/anime/anichin/detail → /api/anime/anichin/detail-v2, "Anichin Detail V2".
//
// The backup keeps working as a backup. The version runs the same code under its own path, with
// its own row in `endpoints` (tier, lock, quota, checks, errors). "Sembunyikan" takes it off the
// list again but keeps its path, so showing it later gives the same version. Every running
// instance picks the list up from the database (endpoint_aliases, migration 024) within REFRESH_MS.
const { query } = require('../lib/db');

const REFRESH_MS = 30000;
let state = { at: 0, rows: [] };
const missingTable = e => e && (e.code === '42P01' || e.code === '42703');

async function rows(force = false) {
  if (!force && Date.now() - state.at < REFRESH_MS) return state.rows;
  try { state = { at: Date.now(), rows: await query('SELECT public_path, backup_path, name, shown FROM endpoint_aliases') }; }
  catch (e) { if (!missingTable(e)) throw e; state = { at: Date.now(), rows: [] }; }
  return state.rows;
}

// Puts the shown versions into the app's maps (served, checked, listed) and takes hidden ones out.
async function sync(app, force = false) {
  const list = await rows(force);
  const loaded = app.locals.loadedPluginPaths, runs = app.locals.pluginRuns, files = app.locals.pluginFiles;
  const shown = app.locals.endpointAliases || (app.locals.endpointAliases = new Map());   // version path -> backup path
  const names = app.locals.endpointAliasNames || (app.locals.endpointAliasNames = new Map());
  const uploads = app.locals.uploadPaths || new Set();
  for (const [pub] of shown) { loaded.delete(pub); runs.delete(pub); files.delete(pub); uploads.delete(pub); }
  shown.clear(); names.clear();
  for (const a of list) {
    if (!a.shown || !runs.has(a.backup_path)) continue;   // the backup's code is gone in this deploy
    shown.set(a.public_path, a.backup_path);
    names.set(a.public_path, a.name);
    loaded.add(a.public_path);
    if (uploads.has(a.backup_path)) uploads.add(a.public_path);
    runs.set(a.public_path, runs.get(a.backup_path));
    if (files.has(a.backup_path)) files.set(a.public_path, files.get(a.backup_path));
  }
  return shown;
}

// The endpoint a backup stands in for (its first group), else its path without the /alt… prefix.
function mainOf(backupPath) {
  const groups = require('../config/endpointGroups');
  const g = groups.find(x => (x.backups || []).some(b => (typeof b === 'string' ? b : b.path) === backupPath));
  return g ? g.path : backupPath.replace(/^\/api\/alt\d*\//, '/api/');
}

// The next free version of `main`: /x-v2, /x-v3 … (or /x/v2, /x/v3 when `main` already ends in /vN).
async function freeVersion(app, main) {
  const taken = new Set([...(app.locals.loadedPluginPaths || [])]);
  (await query('SELECT path FROM endpoints')).forEach(r => taken.add(r.path));
  (await rows(true)).forEach(r => taken.add(r.public_path));
  const m = /^(.*)\/v(\d+)$/.exec(main);
  for (let n = 2; n < 100; n++) {
    const p = m ? `${m[1]}/v${n}` : `${main}-v${n}`;
    if (!taken.has(p)) return { path: p, n };
  }
  throw Object.assign(new Error('Nggak ada nomor versi yang kosong.'), { status: 409, code: 'NO_FREE_VERSION' });
}

// Show a backup as a version. Returns { public_path, name, created }.
async function show(app, backupRow) {
  const existing = (await rows(true)).find(r => r.backup_path === backupRow.path);
  let alias = existing;
  if (!alias) {
    const main = mainOf(backupRow.path);
    const mainRow = (await query('SELECT name FROM endpoints WHERE path=$1', [main]))[0];
    const { path, n } = await freeVersion(app, main);
    const base = (mainRow?.name || backupRow.name).replace(/\s*\(cadangan\)\s*$/i, '').replace(/\s+v\d+$/i, '');
    alias = { public_path: path, backup_path: backupRow.path, name: `${base} V${n}` };
    await query('INSERT INTO endpoint_aliases (public_path, backup_path, name, shown) VALUES ($1,$2,$3,true)', [alias.public_path, alias.backup_path, alias.name]);
  } else {
    await query('UPDATE endpoint_aliases SET shown=true, updated_at=now() WHERE backup_path=$1', [backupRow.path]);
  }
  await query(`INSERT INTO endpoints (name, path, description, method, minimum_tier, locked, status, plugin)
               VALUES ($1,$2,$3,'GET',$4,false,'active',$5)
               ON CONFLICT (path) DO UPDATE SET status='active', updated_at=now()`,
  [alias.name, alias.public_path, backupRow.description || '', backupRow.minimum_tier || 'FREE', backupRow.plugin || null]);
  await sync(app, true);
  return { public_path: alias.public_path, name: alias.name, created: !existing };
}

// Hide a shown version again (by its own path or its backup's path).
async function hide(app, path) {
  const a = (await rows(true)).find(r => r.public_path === path || r.backup_path === path);
  if (!a) return null;
  await query('UPDATE endpoint_aliases SET shown=false, updated_at=now() WHERE public_path=$1', [a.public_path]);
  await sync(app, true);
  return a;
}

module.exports = { rows, sync, show, hide, mainOf, freeVersion, REFRESH_MS, _reset: () => { state = { at: 0, rows: [] }; } };
