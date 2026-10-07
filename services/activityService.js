'use strict';
// Site activity for the owner panel: API calls ('api') and page visits ('page') in activity_log
// (migration 009). Account events (logins, key changes, payments, ...) stay in audit_logs.
// Writing is best effort: a missing table or a failed insert never breaks the request.
const { query } = require('../lib/db');

let tableReady = true;          // false after the first 42P01 (migration 009 not applied)
const lastPage = new Map();     // userId|path -> ms, so a reload storm logs one visit per 10 min
const PAGE_EVERY_MS = 10 * 60 * 1000;

async function insert(row) {
  if (!tableReady) return;
  try {
    await query('INSERT INTO activity_log(user_id,api_key_id,kind,path,status,duration_ms,ip_address) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [row.userId || null, row.keyId || null, row.kind, String(row.path).slice(0, 300), row.status ?? null, row.ms ?? null, row.ip || null]);
    // Keep about 30 days.
    if (Math.random() < 0.002) await query("DELETE FROM activity_log WHERE created_at < now() - interval '30 days'");
  } catch (e) {
    if (e.code === '42P01') tableReady = false;
  }
}

const logApi = r => insert({ ...r, kind: 'api' });

function logPage({ userId, path, ip }) {
  if (!userId) return Promise.resolve();
  const key = userId + '|' + path, now = Date.now();
  if (now - (lastPage.get(key) || 0) < PAGE_EVERY_MS) return Promise.resolve();
  lastPage.set(key, now);
  if (lastPage.size > 5000) lastPage.clear();
  return insert({ userId, path, ip, kind: 'page' });
}

// Account events + API calls + page visits, newest first. q filters by user email or name.
async function recent({ kind = '', q = '', limit = 200 } = {}) {
  const like = `%${String(q).replace(/[\\%_]/g, m => '\\' + m)}%`;
  const parts = [];
  if (!kind || kind === 'account') parts.push(`SELECT 'account' AS kind,a.created_at,a.action AS what,a.actor_user_id AS user_id,regexp_replace(a.ip_address::text,'/(32|128)$','') AS ip_address,a.metadata,a.target_type,a.target_id::text AS target_id,NULL::int AS status,NULL::int AS duration_ms FROM audit_logs a`);
  if (tableReady && (!kind || kind === 'api' || kind === 'page')) parts.push(`SELECT l.kind,l.created_at,l.path AS what,l.user_id,l.ip_address,NULL::jsonb AS metadata,NULL AS target_type,NULL AS target_id,l.status,l.duration_ms FROM activity_log l${kind ? ` WHERE l.kind='${kind === 'api' ? 'api' : 'page'}'` : ''}`);
  const sql = `SELECT x.*,u.email,u.name FROM (${parts.join(' UNION ALL ')}) x LEFT JOIN users u ON u.id=x.user_id
    WHERE ($1='' OR u.email ILIKE $2 OR u.name ILIKE $2) ORDER BY x.created_at DESC LIMIT $3`;
  try {
    return await query(sql, [String(q), like, limit]);
  } catch (e) {
    if (e.code === '42P01' && tableReady) { tableReady = false; return recent({ kind, q, limit }); }
    throw e;
  }
}

module.exports = { logApi, logPage, recent };
