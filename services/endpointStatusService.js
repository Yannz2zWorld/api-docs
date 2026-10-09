'use strict';
// Live status for the ~/endpoints monitor on the dashboard: for every endpoint the most recent real
// HTTP code we know: 200 when it works, otherwise the error code (red on the page).
//   - automatic checks / self-test (endpoint_checks, see services/endpointCheckService.js), and
//   - real calls through the gateway (activity_log, last 24 hours).
// Calls rejected for the caller's own reasons (bad/missing parameter, no key, wrong tier: 400, 401,
// 403, 422) say nothing about the endpoint and are skipped. Disabled / hidden endpoints aren't listed.
// One that hasn't been checked yet is 'pending' until the automatic check reaches it.
const { query } = require('../lib/db');

const CLIENT_SIDE = [400, 401, 403, 422];
const CACHE_MS = 15 * 1000;
let cache = null;

const missing = e => e && (e.code === '42P01' || e.code === '42703');
const safe = p => p.catch(e => { if (missing(e)) return []; throw e; });
const norm = code => (code >= 200 && code < 400 ? 200 : code);

// `loaded`: paths of the endpoints that really exist (loaded plugins); leftover rows of removed
// plugins in the endpoints table (e.g. the old CDN upload endpoint) are not endpoints.
async function list(loaded = null) {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const [endpoints, traffic, checks] = await Promise.all([
    query('SELECT path, method, status FROM endpoints ORDER BY path'),
    safe(query(`SELECT DISTINCT ON (path) path, status, duration_ms, created_at FROM activity_log
                 WHERE kind = 'api' AND status IS NOT NULL AND created_at > now() - interval '24 hours' AND NOT (status = ANY($1::int[]))
                 ORDER BY path, created_at DESC`, [CLIENT_SIDE])),
    safe(query('SELECT path, status, ms, checked_at FROM endpoint_checks WHERE checked_at IS NOT NULL'))
  ]);
  const live = new Map(traffic.map(r => [r.path, { code: norm(r.status), ms: r.duration_ms, at: new Date(r.created_at), source: 'live' }]));
  const checked = new Map(checks.map(r => [r.path, { code: r.status ? norm(r.status) : 503, ms: r.ms, at: new Date(r.checked_at), source: 'check' }]));
  // Disabled endpoints (by the developer, or hidden automatically after a plan/quota error) are not shown.
  const hidden = await require('./errorLogService').hiddenPaths().catch(() => new Set());
  const out = endpoints.filter(e => (!loaded || loaded.has(e.path)) && (!e.status || e.status === 'active') && !hidden.has(e.path)).map(e => {
    const base = { path: e.path, method: (e.method || 'GET').toUpperCase() };
    const a = live.get(e.path), b = checked.get(e.path);
    const pick = a && b ? (a.at >= b.at ? a : b) : a || b;
    if (!pick) return { ...base, state: 'pending', code: null, ms: null, at: null, source: null };
    return { ...base, state: pick.code === 200 ? 'ok' : 'down', code: pick.code, ms: pick.ms, at: pick.at.toISOString(), source: pick.source };
  });
  const summary = out.reduce((m, r) => (m[r.state] = (m[r.state] || 0) + 1, m), { total: out.length, ok: 0, down: 0, pending: 0 });
  const value = { generatedAt: new Date().toISOString(), summary, endpoints: out };
  cache = { at: Date.now(), value };
  return value;
}

const reset = () => { cache = null; };
module.exports = { list, reset, CLIENT_SIDE };
