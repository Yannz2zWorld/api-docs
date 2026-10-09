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

// Is this an error that means "this endpoint can't be used right now" rather than a passing hiccup?
function isPlanError({ status, upstreamStatus, code, message }) {
  if (PLAN_CODES.has(code)) return true;
  if ([401, 402, 403].includes(Number(upstreamStatus))) return true;
  const text = String(message || '');
  if (/API Error \((401|402|403)\)/.test(text)) return true;
  return PLAN_WORDS.test(text) && (Number(status) >= 400 || !status);
}

const clip = (v, n) => (v == null ? null : String(v).replace(/[\u0000-\u001f]/g, ' ').slice(0, n));

// Our own note on failed calls ("Kuota nggak dipotong." = the caller's quota wasn't charged) is not
// part of the upstream's error and must not read as a quota problem.
const ownNote = /\s*(Kuota (nggak|tidak) dipotong|Your quota wasn't charged)\.?/gi;

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
    if (hide) {
      const r = await query(`UPDATE endpoints SET status = 'disabled', auto_disabled = true, disabled_reason = $2, disabled_at = now(), updated_at = now()
                              WHERE path = $1 AND status = 'active' RETURNING id`, [path, clip(message || code, 300)]);
      if (r.length) {
        await query("INSERT INTO audit_logs(actor_user_id, action, target_type, target_id, metadata) VALUES (NULL, 'endpoint_auto_hidden', 'endpoint', $1, $2::jsonb)",
          [String(r[0].id), JSON.stringify({ path, status, code, reason: clip(message, 200) })]).catch(() => {});
      }
    }
  } catch (e) { if (!missing(e)) throw e; }
}

// A check passed: an automatically hidden endpoint comes back, its errors are marked fixed.
async function resolved(path) {
  try {
    const r = await query(`UPDATE endpoints SET status = 'active', auto_disabled = false, disabled_reason = NULL, disabled_at = NULL, updated_at = now()
                            WHERE path = $1 AND auto_disabled RETURNING id`, [path]);
    await query('UPDATE endpoint_errors SET resolved_at = now() WHERE path = $1 AND resolved_at IS NULL', [path]);
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
  return r[0] || null;
}
const remove = id => query('DELETE FROM endpoint_errors WHERE id = $1 RETURNING id', [id]);
const clearResolved = () => query('DELETE FROM endpoint_errors WHERE resolved_at IS NOT NULL RETURNING id');

module.exports = { record, resolved, list, showAgain, remove, clearResolved, isPlanError };
