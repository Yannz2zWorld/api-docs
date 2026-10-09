'use strict';
// Automatic endpoint checks for the ~/endpoints monitor and the developer's self-test.
//   - theresav and third-party server endpoints: lib/theresav.js / lib/apiproxy.js probe() (run with
//     a sample input, or, without one, see whether the upstream answers properly);
//   - local plugins (ping, fake call, TikTok): their own run() with a sample request.
// Results are stored in endpoint_checks with the HTTP code: 200 when it works, else the error code.
// checkStale() picks the endpoints whose last check is old (OK after 6 hours, failures after 30
// minutes), claims them so two visitors never check the same one at once, and checks a few.
const { query } = require('../lib/db');
const theresav = require('../lib/theresav');
const apiproxy = require('../lib/apiproxy');

const OK_STALE_MS = 6 * 60 * 60 * 1000;
const FAIL_STALE_MS = 30 * 60 * 1000;
const AUTO_TIMEOUT_MS = 25000;
const missing = e => e && (e.code === '42P01' || e.code === '42703');

const sampleImage = theresav.checkSampleImage;
const LOCAL_SAMPLES = {
  '/api/tools/ping': () => ({}),
  '/api/maker/fakecall': () => ({ name: 'Yannz', time: '12.00', photo: sampleImage() }),
  '/api/download/tiktok': () => ({ url: 'https://vt.tiktok.com/ZSbpMHCBM/' })
};

// The HTTP code a check result stands for: 200 = works; otherwise the error code.
function codeOf(r) {
  if (r.result === 'ok') return 200;
  if (r.result === 'not_configured') return 503;
  if (r.timeout) return 504;
  if (!r.status) return 503;
  if (r.status < 400) return 502;          // answered 2xx but with an error body / empty file
  return r.status;
}

// Calls a local plugin's run() with a fake request and records the status it answers with.
async function localProbe(run, sample, timeoutMs = theresav.UPSTREAM_TIMEOUT_MS) {
  const started = Date.now();
  return new Promise(resolve => {
    let code = 200, settled = false, body;
    const finish = () => {
      if (settled) return; settled = true; clearTimeout(timer);
      const ms = Date.now() - started;
      if (code >= 200 && code < 300 && !(body && typeof body === 'object' && body.status === false)) resolve({ result: 'ok', status: code, ms, kind: 'sample' });
      else resolve({ result: 'error', status: code, error: body && typeof body === 'object' ? String(body.message || body.error || 'gagal') : 'gagal', ms });
    };
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve({ result: 'error', status: 0, timeout: true, error: 'timeout', ms: Date.now() - started }); } }, timeoutMs);
    const res = {
      statusCode: 200,
      status(c) { code = c; this.statusCode = c; return this; },
      set() { return this; }, setHeader() { return this; }, type() { return this; }, header() { return this; },
      json(b) { body = b; finish(); return this; },
      send(b) { body = b; finish(); return this; },
      end() { finish(); return this; }
    };
    const req = { query: sample, body: null, headers: {}, get: () => undefined, method: 'GET',
      apiAuth: { tier: 'OWNER', keyId: null, quota: { used: 0, limit: null, remaining: null, resetAt: null } } };
    Promise.resolve().then(() => run(req, res)).then(() => { if (!settled) finish(); }, e => { code = 500; body = { message: e?.message || 'error' }; finish(); });
  });
}

// What can be checked: the proxied endpoints plus local plugins with a sample.
function checkable(app) {
  const loaded = app.locals.loadedPluginPaths || new Set();
  const runs = app.locals.pluginRuns || new Map();
  const map = new Map();
  for (const e of [...theresav.registry(), ...apiproxy.registry()]) if (loaded.has(e.path)) map.set(e.path, { path: e.path, name: e.name, category: e.category, kind: 'proxy', entry: e });
  for (const [path, sample] of Object.entries(LOCAL_SAMPLES)) if (loaded.has(path) && runs.has(path) && !map.has(path)) map.set(path, { path, name: path.split('/').pop(), category: 'Local', kind: 'local', run: runs.get(path), sample });
  return map;
}

async function probeOne(item, timeoutMs) {
  try {
    if (item.kind === 'local') return await localProbe(item.run, item.sample(), timeoutMs);
    return await (item.entry.server ? apiproxy : theresav).probe(item.entry, { timeoutMs });
  } catch (err) {
    return { result: 'error', status: 0, error: err?.message || 'gagal' };
  }
}

async function save(results) {
  const rows = results.filter(r => r.result !== 'manual');
  if (!rows.length) return;
  try {
    await query(`INSERT INTO endpoint_checks (path, status, ok, ms, error, kind, checked_at, claimed_at)
                 SELECT p, s, o, m, e, k, now(), NULL FROM unnest($1::text[], $2::int[], $3::bool[], $4::int[], $5::text[], $6::text[]) AS t(p, s, o, m, e, k)
                 ON CONFLICT (path) DO UPDATE SET status = EXCLUDED.status, ok = EXCLUDED.ok, ms = EXCLUDED.ms, error = EXCLUDED.error, kind = EXCLUDED.kind, checked_at = now(), claimed_at = NULL`,
    [rows.map(r => r.path), rows.map(codeOf), rows.map(r => r.result === 'ok'), rows.map(r => (r.ms != null ? Math.round(r.ms) : null)),
      rows.map(r => (r.result === 'ok' ? null : String(r.error || 'gagal').slice(0, 300))), rows.map(r => r.kind || null)]);
  } catch (e) { if (!missing(e)) throw e; }
  require('./endpointStatusService').reset();
}

async function runAll(items, timeoutMs, concurrency = 3) {
  const queue = items.slice(), out = [];
  const worker = async () => { for (let it = queue.shift(); it; it = queue.shift()) out.push({ path: it.path, name: it.name, category: it.category, ...(await probeOne(it, timeoutMs)) }); };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

// Self-test / daily check: every checkable endpoint (or only `only`).
async function checkAll(app, { only = null, timeoutMs = theresav.UPSTREAM_TIMEOUT_MS } = {}) {
  const items = [...checkable(app).values()].filter(i => !only || only.has(i.path));
  const out = await runAll(items, timeoutMs);
  await save(out);
  return out.map(r => ({ ...r, code: codeOf(r) }));
}

// Automatic check: up to `limit` endpoints whose last check is old, oldest first. The pick and the
// claim are one statement with SKIP LOCKED, so visitors asking at the same time get different ones.
async function checkStale(app, limit = 6, { okAfterMs = OK_STALE_MS, failAfterMs = FAIL_STALE_MS } = {}) {
  const items = checkable(app);
  if (!items.size) return [];
  let claimed;
  try {
    const active = new Set((await query("SELECT path FROM endpoints WHERE status = 'active'")).map(r => r.path));
    const paths = [...items.keys()].filter(p => active.has(p));
    if (!paths.length) return [];
    await query('INSERT INTO endpoint_checks (path) SELECT unnest($1::text[]) ON CONFLICT (path) DO NOTHING', [paths]);
    claimed = (await query(`WITH due AS (
        SELECT path FROM endpoint_checks
         WHERE path = ANY($1::text[])
           AND (claimed_at IS NULL OR claimed_at < now() - interval '3 minutes')
           AND (checked_at IS NULL OR checked_at < now() - CASE WHEN ok THEN $3::interval ELSE $4::interval END)
         ORDER BY checked_at NULLS FIRST, path
         LIMIT $2
         FOR UPDATE SKIP LOCKED)
      UPDATE endpoint_checks c SET claimed_at = now() FROM due WHERE c.path = due.path RETURNING c.path`,
    [paths, limit, `${Math.round(okAfterMs / 1000)} seconds`, `${Math.round(failAfterMs / 1000)} seconds`])).map(r => r.path);
  } catch (e) { if (missing(e)) return []; throw e; }
  const mine = claimed.map(p => items.get(p)).filter(Boolean);
  if (!mine.length) return [];
  const out = await runAll(mine, AUTO_TIMEOUT_MS, mine.length);
  await save(out);
  return out.map(r => ({ path: r.path, code: codeOf(r), ms: r.ms ?? null }));
}

// "Refresh" on the dashboard: check everything again, except what was checked in the last 5 minutes.
const FORCE_AFTER_MS = 5 * 60 * 1000;

module.exports = { checkAll, checkStale, codeOf, sampleImage, LOCAL_SAMPLES, FORCE_AFTER_MS };
