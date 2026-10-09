'use strict';
// Live status for the ~/endpoints monitor on the dashboard: for every endpoint, the most recent
// real HTTP status we know of and how long it took.
//   - real calls through the gateway (activity_log, last 24 hours), and
//   - endpoint checks (endpoint_checks): the developer's self-test and the daily automatic check.
// Calls rejected for the caller's own reasons (bad/missing parameter, no key, wrong tier: 400,
// 401, 403, 422) say nothing about the endpoint itself and are skipped. Endpoints with no data
// yet are reported as such: nothing is made up.
const { query } = require('../lib/db');

const CLIENT_SIDE = [400, 401, 403, 422];
const CACHE_MS = 30 * 1000;
let cache = null;

const REASON = { 200: 'OK', 201: 'Created', 204: 'No Content', 206: 'Partial Content', 301: 'Moved', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 408: 'Timeout', 413: 'Too Large', 415: 'Unsupported Media',
  422: 'Unprocessable', 429: 'Too Many Requests', 500: 'Server Error', 502: 'Bad Gateway', 503: 'Unavailable', 504: 'Gateway Timeout' };
const reason = code => REASON[code] || (code >= 500 ? 'Server Error' : code >= 400 ? 'Error' : code >= 200 && code < 300 ? 'OK' : '');

const missing = e => e && (e.code === '42P01' || e.code === '42703');
const safe = p => p.catch(e => { if (missing(e)) return []; throw e; });

function stateOf(code) {
  if (code == null) return 'down';
  if (code >= 200 && code < 400) return 'ok';
  if (code === 429 || code === 408 || code === 404) return 'warn';
  return code >= 500 ? 'down' : 'warn';
}

async function list() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const [endpoints, traffic, checks] = await Promise.all([
    query('SELECT path, method, status, locked FROM endpoints ORDER BY path'),
    safe(query(`SELECT DISTINCT ON (path) path, status, duration_ms, created_at FROM activity_log
                 WHERE kind = 'api' AND status IS NOT NULL AND created_at > now() - interval '24 hours' AND NOT (status = ANY($1::int[]))
                 ORDER BY path, created_at DESC`, [CLIENT_SIDE])),
    safe(query('SELECT path, status, ok, ms, checked_at FROM endpoint_checks'))
  ]);
  const live = new Map(traffic.map(r => [r.path, { code: r.status, ms: r.duration_ms, at: new Date(r.created_at), source: 'live' }]));
  // A check whose upstream answered 2xx but with an error body ("status": false) is a failure: our
  // gateway turns that into 502 for callers, so that's the code shown.
  const checked = new Map(checks.map(r => [r.path, { code: !r.ok && r.status && r.status < 400 ? 502 : r.status, ms: r.ms, at: new Date(r.checked_at), source: 'check' }]));
  const out = endpoints.map(e => {
    const base = { path: e.path, method: (e.method || 'GET').toUpperCase() };
    if (e.status && e.status !== 'active') return { ...base, state: 'off', code: null, text: 'OFF', ms: null, at: null, source: null };
    const a = live.get(e.path), b = checked.get(e.path);
    const pick = a && b ? (a.at >= b.at ? a : b) : a || b;
    if (!pick) return { ...base, state: 'idle', code: null, text: 'IDLE', ms: null, at: null, source: null, locked: !!e.locked };
    return { ...base, state: stateOf(pick.code), code: pick.code, text: pick.code ? `${pick.code} ${reason(pick.code)}` : 'NO RESPONSE', ms: pick.ms, at: pick.at.toISOString(), source: pick.source, locked: !!e.locked };
  });
  const summary = out.reduce((m, r) => (m[r.state] = (m[r.state] || 0) + 1, m), { total: out.length });
  const value = { generatedAt: new Date().toISOString(), summary, endpoints: out };
  cache = { at: Date.now(), value };
  return value;
}

// Self-test / daily check results: [{ path, result: 'ok'|'error'|'manual'|'not_configured', status, ms, error }].
// 'manual' (needs a real link/photo) and 'not_configured' are not checks and are not stored.
async function saveChecks(results) {
  const rows = results.filter(r => r.result === 'ok' || r.result === 'error');
  if (!rows.length) return 0;
  try {
    await query(`INSERT INTO endpoint_checks (path, status, ok, ms, error, checked_at)
                 SELECT * , now() FROM unnest($1::text[], $2::int[], $3::bool[], $4::int[], $5::text[])
                 ON CONFLICT (path) DO UPDATE SET status = EXCLUDED.status, ok = EXCLUDED.ok, ms = EXCLUDED.ms, error = EXCLUDED.error, checked_at = now()`,
    [rows.map(r => r.path), rows.map(r => (r.status ? Number(r.status) : null)), rows.map(r => r.result === 'ok'), rows.map(r => (r.ms != null ? Math.round(r.ms) : null)), rows.map(r => (r.error ? String(r.error).slice(0, 300) : null))]);
  } catch (e) { if (missing(e)) return 0; throw e; }
  cache = null;
  return rows.length;
}

const reset = () => { cache = null; };
module.exports = { list, saveChecks, reset, reason, CLIENT_SIDE };
