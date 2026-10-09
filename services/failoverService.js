'use strict';
// Failover between endpoints that do the same thing (config/endpointGroups.js).
// A call to a group's public endpoint tries its members in order, healthy ones first, and answers
// with the first one that works. A member that fails (5xx: server error, timeout, plan / quota / key
// problem) is logged in the Developer Panel's Error tab under its own path and the next one is tried.
// The caller's own mistakes (4xx, e.g. a missing parameter) are answered right away: another member
// would say the same. The public endpoint is only hidden when every member is broken (see
// services/errorLogService.js hiddenPaths()).
const { query } = require('../lib/db');
const errorLog = require('./errorLogService');
const GROUPS = require('../config/endpointGroups');

const PROVIDER_TIMEOUT_MS = 60000;
const groups = new Map();
for (const g of GROUPS) {
  groups.set(g.path, [{ path: g.path, query: null }, ...(g.backups || []).map(b => (typeof b === 'string' ? { path: b, query: null } : { path: b.path, query: b.query || null }))]);
}
const membersOf = path => groups.get(path) || null;
const groupPaths = () => [...groups.keys()];

// Builds the query a member expects from the caller's query.
function mapQuery(original, map) {
  if (!map) return original;
  const out = {};
  for (const [name, from] of Object.entries(map)) {
    if (typeof from === 'string') { if (original[from] != null) out[name] = original[from]; }
    else if (from && Object.prototype.hasOwnProperty.call(from, 'value')) out[name] = from.value;
  }
  return out;
}

let healthCache = null;
async function health() {
  if (healthCache && Date.now() - healthCache.at < 15000) return healthCache;
  let failing = new Set(), disabled = new Set();
  try { failing = new Set((await query('SELECT path FROM endpoint_checks WHERE checked_at IS NOT NULL AND NOT ok')).map(r => r.path)); } catch {}
  try { disabled = new Set((await query("SELECT path FROM endpoints WHERE status <> 'active' AND NOT COALESCE(auto_disabled, false)")).map(r => r.path)); }
  catch { try { disabled = new Set((await query("SELECT path FROM endpoints WHERE status <> 'active'")).map(r => r.path)); } catch {} }
  healthCache = { at: Date.now(), failing, disabled };
  return healthCache;
}
const reset = () => { healthCache = null; };

// A backup whose upstream key isn't set in Vercel can't work: don't even try it.
function configured(path) {
  const theresav = require('../lib/theresav');
  const apiproxy = require('../lib/apiproxy');
  if (theresav.registry().some(e => e.path === path)) return Boolean(process.env.THERESAV_API_KEY);
  const a = apiproxy.registry().find(e => e.path === path);
  if (a) { const srv = apiproxy.SERVERS[a.server] || {}; return a.keyOptional || srv.keyMode === 'none' || Boolean(process.env[srv.keyEnv]); }
  return true;   // local plugins
}

// Members to try for `path`, best first; null when `path` has no backups.
async function chain(app, path) {
  const members = membersOf(path);
  if (!members) return null;
  const runs = app.locals.pluginRuns || new Map();
  const [{ failing, disabled }, hidden] = await Promise.all([health(), errorLog.rawHiddenPaths().catch(() => new Set())]);
  const rank = m => (hidden.has(m.path) ? 2 : failing.has(m.path) ? 1 : 0);
  return members
    .filter(m => runs.has(m.path) && (m.path === path || (!disabled.has(m.path) && configured(m.path))))   // backups switched off by the developer or without a key are skipped
    .map((m, i) => ({ ...m, run: runs.get(m.path), i }))
    .sort((a, b) => rank(a) - rank(b) || a.i - b.i);
}

// Runs one member into a stand-in response and returns what it answered.
function runMember(req, member) {
  return new Promise(resolve => {
    const out = { status: 200, headers: {}, kind: null, body: undefined };
    let settled = false;
    const finish = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(out); } };
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve({ status: 504, headers: {}, kind: 'json', body: { status: false, error: 'UPSTREAM_TIMEOUT', message: 'Layanan sumbernya kelamaan jawab.' } }); } }, PROVIDER_TIMEOUT_MS);
    const res = {
      locals: {},
      get statusCode() { return out.status; }, set statusCode(v) { out.status = v; },
      status(code) { out.status = code; return res; },
      sendStatus(code) { out.status = code; out.kind = 'end'; finish(); return res; },
      set(k, v) { if (k && typeof k === 'object') Object.assign(out.headers, k); else out.headers[k] = v; return res; },
      header(k, v) { return res.set(k, v); },
      setHeader(k, v) { out.headers[k] = v; return res; },
      get(k) { return out.headers[k]; },
      getHeader(k) { return out.headers[k]; },
      type(t) { out.headers['Content-Type'] = t; return res; },
      json(b) { out.kind = 'json'; out.body = b; finish(); return res; },
      send(b) { out.kind = Buffer.isBuffer(b) ? 'buffer' : b && typeof b === 'object' ? 'json' : 'text'; out.body = b; finish(); return res; },
      end(b) { out.kind = 'end'; out.body = b; finish(); return res; }
    };
    const sub = Object.create(req);
    sub.query = mapQuery(req.query || {}, member.query);
    Promise.resolve()
      .then(() => member.run(sub, res))
      .then(() => { if (!settled) setTimeout(finish, 0); },
        e => { out.status = 500; out.kind = 'json'; out.body = { status: false, error: 'INTERNAL_ERROR', message: e?.message || 'error' }; finish(); });
  });
}

function replay(res, out, member, primary) {
  if (member.path !== primary) res.set('X-Yannz-Backup', member.path);
  res.status(out.status);
  for (const [k, v] of Object.entries(out.headers)) res.set(k, v);
  if (out.kind === 'json') return res.json(out.body);
  if (out.kind === 'end') return res.end(out.body);
  return res.send(out.body);
}

// Tries the members until one works; logs each failure under the member's own path.
async function execute(req, res, primary, members) {
  let last = null;
  for (const member of members) {
    const out = await runMember(req, member);
    if (out.status < 500) return replay(res, out, member, primary);
    const body = out.kind === 'json' && out.body && typeof out.body === 'object' ? out.body : null;
    await errorLog.record({ path: member.path, status: out.status, code: body?.error || null, message: body?.message || body?.error || null, source: 'live' })
      .catch(e => console.error('Error log failed:', { code: e?.code || null }));
    last = { out, member };
  }
  return replay(res, last.out, last.member, primary);
}

module.exports = { chain, execute, membersOf, groupPaths, mapQuery, configured, reset };
