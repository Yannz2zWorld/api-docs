'use strict';
// Endpoint errors for the "Error" tab of the Developer Panel, from real requests (the gateway, any
// 5xx answer) and from the automatic checks. The same error on the same endpoint is one row with a
// count. When the upstream says the endpoint can't be used on our plan (plan limit, quota or
// credits used up, key refused, service not set up), the endpoint is hidden automatically: off the
// API catalog, Playground, API Docs and the status monitor. It keeps being checked, and as soon as a
// check passes it is shown again by itself.
const crypto = require('crypto');
const { query } = require('../lib/db');

const missing = e => e && (e.code === '42P01' || e.code === '42703');
const PLAN_WORDS = /\b(quota|plan|credits?|subscription|upgrade|expired|insufficient|balance|billing|payment required|premium|top ?up|limit (?:reached|exceeded)|kuota|saldo|langganan|kredit|invalid (?:api ?)?key|api ?key (?:invalid|expired|salah|tidak valid|nggak valid)|unauthori[sz]ed|forbidden|not configured|belum diatur)\b/i;
const PLAN_CODES = new Set(['UPSTREAM_NOT_CONFIGURED']);
// Our own note on failed calls ("Kuota nggak dipotong." = the caller's quota wasn't charged) is not
// part of the upstream's error and must not read as a quota problem.
const ownNote = /\s*(Kuota (nggak|tidak) dipotong|Your quota wasn't charged)\.?/gi;


// Is this an error that means "this endpoint can't be used right now" rather than a passing hiccup?
function isPlanError({ status, upstreamStatus, code, message }) {
  if (PLAN_CODES.has(code)) return true;
  if ([401, 402, 403].includes(Number(upstreamStatus))) return true;
  const text = String(message || '').replace(ownNote, '');
  if (/API Error \((401|402|403)\)/.test(text)) return true;
  return PLAN_WORDS.test(text) && (Number(status) >= 400 || !status);
}

const clip = (v, n) => (v == null ? null : String(v).replace(/[\u0000-\u001f]/g, ' ').slice(0, n));


async function record({ path, status = null, upstreamStatus = null, code = null, message = null, source = 'live' }) {
  if (!path) return;
  if (message) message = String(message).replace(ownNote, '').trim() || null;
  const hide = isPlanError({ status, upstreamStatus, code, message });
  const msg = clip(message, 600);
  // Same endpoint + same code + same message (numbers stripped) = same row.
  const fingerprint = crypto.createHash('sha1').update(`${status}|${code}|${String(msg || '').replace(/\d+/g, '#').slice(0, 200)}`).digest('hex').slice(0, 20);
  try {
    await query(`INSERT INTO endpoint_errors (path, fingerprint, status, code, message, source, hidden)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (path, fingerprint) DO UPDATE SET count = endpoint_errors.count + 1, last_seen = now(), message = EXCLUDED.message,
                   source = EXCLUDED.source, hidden = endpoint_errors.hidden OR EXCLUDED.hidden, resolved_at = NULL`,
    [path, fingerprint, status, clip(code, 60), msg, source, hide]);
  } catch (e) { if (!missing(e)) throw e; problem = { at: new Date().toISOString(), step: 'log', code: e.code || null }; return; }
  hiddenCache = null;
  if (!hide) return;
  const members = groupMembers(path);
  if (members) {
    const raw = await rawHiddenPaths();
    if (members.some(m => !raw.has(m))) return;   // a backup still works: the gateway uses it, the endpoint stays
  }
  // Hide it in the endpoints table too. Even if this fails, the open "hidden" error above already
  // keeps the endpoint out of every list and the gateway (hiddenPaths()); the failure is shown to
  // the developer instead of being swallowed.
  try {
    const r = await query(`UPDATE endpoints SET status = 'disabled', auto_disabled = true, disabled_reason = $2, disabled_at = now(), updated_at = now()
                            WHERE path = $1 AND status = 'active' RETURNING id`, [path, clip(message || code, 300)]);
    if (r.length) {
      await query("INSERT INTO audit_logs(actor_user_id, action, target_type, target_id, metadata) VALUES (NULL, 'endpoint_auto_hidden', 'endpoint', $1, $2::jsonb)",
        [String(r[0].id), JSON.stringify({ path, status, code, reason: clip(message, 200) })]).catch(() => {});
    }
  } catch (e) {
    problem = { at: new Date().toISOString(), step: 'hide', path, code: e.code || null };
    console.error('Auto-hide failed:', { path, code: e.code || null });
  }
}

// Paths hidden because of an open plan/quota/key error (cached briefly; reset on every change).
let hiddenCache = null;
let problem = null;   // last failure to log/hide, shown in the Error tab
// Raw: every endpoint with an open plan/quota/key error (also backups that aren't listed themselves).
async function rawHiddenPaths() {
  if (hiddenCache && Date.now() - hiddenCache.at < 15000) return hiddenCache.set;
  let set = new Set();
  try { set = new Set((await query('SELECT DISTINCT path FROM endpoint_errors WHERE hidden AND resolved_at IS NULL')).map(r => r.path)); }
  catch (e) { if (!missing(e)) throw e; }
  hiddenCache = { at: Date.now(), set };
  return set;
}
// What callers don't get to see: a raw-hidden endpoint, except one that still has a working backup
// in its group (config/endpointGroups.js); that one stays and the gateway switches to the backup.
async function hiddenPaths() {
  const raw = await rawHiddenPaths();
  const out = new Set();
  for (const path of raw) {
    const members = groupMembers(path);
    if (members && members.some(m => !raw.has(m))) continue;
    out.add(path);
  }
  return out;
}
let GROUPS = null;
function groupMembers(path) {
  if (!GROUPS) {
    GROUPS = new Map();
    for (const g of require('../config/endpointGroups')) GROUPS.set(g.path, [g.path, ...(g.backups || []).map(b => (typeof b === 'string' ? b : b.path))]);
  }
  return GROUPS.get(path) || null;
}
const lastProblem = () => problem;
const resetHidden = () => { hiddenCache = null; };

// Is the database ready for this feature (migration 019)?
async function schemaReady() {
  try { await query('SELECT auto_disabled, disabled_reason, disabled_at FROM endpoints LIMIT 0'); await query('SELECT id, hidden FROM endpoint_errors LIMIT 0'); return true; }
  catch (e) { if (missing(e)) return false; throw e; }
}

// A check passed: an automatically hidden endpoint comes back, its errors are marked fixed.
async function resolved(path) {
  try {
    const r = await query(`UPDATE endpoints SET status = 'active', auto_disabled = false, disabled_reason = NULL, disabled_at = NULL, updated_at = now()
                            WHERE path = $1 AND auto_disabled RETURNING id`, [path]);
    await query('UPDATE endpoint_errors SET resolved_at = now() WHERE path = $1 AND resolved_at IS NULL', [path]);
    hiddenCache = null;
    if (r.length) {
      await query("INSERT INTO audit_logs(actor_user_id, action, target_type, target_id, metadata) VALUES (NULL, 'endpoint_auto_shown', 'endpoint', $1, $2::jsonb)",
        [String(r[0].id), JSON.stringify({ path })]).catch(() => {});
    }
    return r.length > 0;
  } catch (e) { if (missing(e)) return false; throw e; }
}

async function list({ includeResolved = true } = {}) {
  try {
    return await query(`SELECT e.id, e.path, e.status, e.code, e.message, e.source, e.hidden, e.count, e.first_seen, e.last_seen, e.resolved_at,
                               n.id AS endpoint_id, n.name, n.status AS endpoint_status, n.auto_disabled, n.disabled_reason
                          FROM endpoint_errors e LEFT JOIN endpoints n ON n.path = e.path
                         WHERE ($1 OR e.resolved_at IS NULL)
                         ORDER BY (e.resolved_at IS NULL) DESC, e.last_seen DESC LIMIT 300`, [includeResolved]);
  } catch (e) { if (missing(e)) return []; throw e; }
}

// Developer: show an endpoint again by hand (it may get hidden again if the upstream still refuses).
async function showAgain(path) {
  const r = await query(`UPDATE endpoints SET status = 'active', auto_disabled = false, disabled_reason = NULL, disabled_at = NULL, updated_at = now()
                          WHERE path = $1 RETURNING id`, [path]);
  if (r.length) await query('UPDATE endpoint_errors SET resolved_at = now() WHERE path = $1 AND resolved_at IS NULL', [path]).catch(() => {});
  hiddenCache = null;
  return r[0] || null;
}
const remove = async id => { const r = await query('DELETE FROM endpoint_errors WHERE id = $1 RETURNING id', [id]); hiddenCache = null; return r; };
const clearResolved = () => query('DELETE FROM endpoint_errors WHERE resolved_at IS NOT NULL RETURNING id');

// ---- Where the error happens and why, in short, for the Error tab.
// Which server an endpoint really runs on, and the Vercel variable holding its key.
const LOCAL = {
  '/api/download/tiktok': { name: 'TikTok (tikwm.com)', host: 'www.tikwm.com', keyEnv: null },
  '/api/maker/fakecall': { name: 'Website kita (gambar latar dari cdn-alip.clutch.web.id)', host: 'cdn-alip.clutch.web.id', keyEnv: null },
  '/api/tools/ping': { name: 'Website kita (Vercel)', host: null, keyEnv: null }
};
function originOf(path) {
  const theresav = require('../lib/theresav');
  const apiproxy = require('../lib/apiproxy');
  const t = theresav.registry().find(e => e.path === path);
  if (t) return { name: 'theresav', host: (process.env.THERESAV_BASE_URL || 'https://api.theresav.eu').replace(/^https?:\/\//, '').replace(/\/+$/, ''), keyEnv: 'THERESAV_API_KEY', upstream: t.upstream };
  const a = apiproxy.registry().find(e => e.path === path);
  if (a) {
    const srv = apiproxy.SERVERS[a.server] || {};
    return { name: a.server, host: String(process.env[srv.baseEnv] || srv.base || '').replace(/^https?:\/\//, '').replace(/\/+$/, ''), keyEnv: srv.keyEnv || null, upstream: a.upstream };
  }
  return LOCAL[path] || { name: 'Website kita (Vercel)', host: null, keyEnv: null };
}

// { where, why } in casual Indonesian, plus whereEn / whyEn for the English page.
function explain({ path, status, code, message }) {
  const o = originOf(path);
  const local = !o.host;
  const srvId = local ? 'Server website kita' : `Server ${o.host}`;
  const srvEn = local ? 'Our website' : `The server ${o.host}`;
  const where = local ? o.name.replace('Website kita', 'Website kita') : `Server sumber: ${o.host}${o.upstream ? ` (${o.upstream})` : ''}`;
  const whereEn = local ? o.name.replace('Website kita', 'Our website').replace('gambar latar dari', 'background image from') : `Upstream server: ${o.host}${o.upstream ? ` (${o.upstream})` : ''}`;
  const key = o.keyEnv || 'server API';
  const text = String(message || '');
  const st = Number(status) || 0;
  const up = Number((/API Error \((\d{3})\)/.exec(text) || [])[1]) || null;
  let id, en;
  if (code === 'UPSTREAM_NOT_CONFIGURED') {
    id = `Key ${key} belum diisi di Vercel, jadi endpoint ini belum bisa jalan. Isi di Vercel → Environment Variables, terus redeploy.`;
    en = `The ${key} key isn't set in Vercel, so this endpoint can't run yet. Add it under Vercel → Environment Variables, then redeploy.`;
  } else if (/\b(quota|plan|credits?|top ?up|subscription|upgrade|kuota|kredit|langganan|saldo|insufficient|balance|payment)\b/i.test(text) || up === 402 || st === 402) {
    id = `Kuota/plan akun kita di ${srvId.toLowerCase().replace('server ', 'server ')} habis. Endpoint-nya disembunyikan sampai kuotanya reset atau plan-nya di-upgrade di sana.`;
    en = `Our account's quota/plan on ${local ? 'our website' : `the server ${o.host}`} is used up. The endpoint stays hidden until the quota resets or the plan is upgraded there.`;
  } else if (up === 401 || up === 403 || /\b(invalid (api ?)?key|unauthori[sz]ed|forbidden|api ?key)\b/i.test(text)) {
    id = `API key kita ditolak ${srvId.toLowerCase()}. Cek key ${key} di Vercel masih aktif dan bener.`;
    en = `${srvEn} refused our API key. Check that ${key} in Vercel is still valid.`;
  } else if (code === 'TIMEOUT' || st === 504 || /timeout|timed out/i.test(text)) {
    id = `${srvId} kelamaan jawab, jadi request-nya diputus. Biasanya cuma sementara.`;
    en = `${srvEn} took too long to answer, so the request was cut off. Usually temporary.`;
  } else if (st === 429 || up === 429 || /too many|rate limit/i.test(text)) {
    id = `${srvId} nolak karena kebanyakan request dalam waktu singkat.`;
    en = `${srvEn} refused because of too many requests in a short time.`;
  } else if (st === 404 || up === 404 || /not found/i.test(text)) {
    id = `Alamat endpoint-nya udah nggak ada di ${srvId.toLowerCase()} (mungkin dipindah atau dihapus di sana).`;
    en = `The endpoint no longer exists on ${local ? 'our website' : `the server ${o.host}`} (maybe moved or removed there).`;
  } else if (st === 503 && local) {
    id = 'Ada masalah di website kita sendiri (Vercel atau database), bukan di server sumber.';
    en = 'Something is wrong on our own website (Vercel or the database), not on an upstream server.';
  } else if (st === 503 || /nggak bisa dihubungi|ECONN|ENOTFOUND|fetch failed/i.test(text)) {
    id = `${srvId} nggak bisa dihubungi, kemungkinan lagi down.`;
    en = `${srvEn} can't be reached; it's probably down.`;
  } else if (/sample file|file kosong|bukan JSON/i.test(text)) {
    id = `${srvId} jawab, tapi hasilnya kosong atau formatnya nggak sesuai.`;
    en = `${srvEn} answered, but the result was empty or in the wrong format.`;
  } else if (st >= 500 && !local) {
    id = `${srvId} lagi error (jawabannya gagal). Kalau terus-terusan, berarti endpoint di sana lagi rusak.`;
    en = `${srvEn} is failing (it answered with an error). If it keeps happening, the endpoint there is broken.`;
  } else {
    id = 'Ada error di website kita waktu ngejalanin endpoint ini.';
    en = 'Our website hit an error while running this endpoint.';
  }
  return { where, why: id, whereEn, whyEn: en };
}

// What a caller sees instead of the upstream's plan/quota error (the real one is in the Error tab).
const UNAVAILABLE_MESSAGE = 'Endpoint ini lagi nggak tersedia untuk sementara. Coba lagi nanti atau pakai endpoint lain dulu ya.';

module.exports = { record, resolved, list, showAgain, remove, clearResolved, isPlanError, explain, originOf, hiddenPaths, rawHiddenPaths, groupMembers, resetHidden, lastProblem, schemaReady, UNAVAILABLE_MESSAGE };
