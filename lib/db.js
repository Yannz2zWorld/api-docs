'use strict';

const { neon } = require('@neondatabase/serverless');

let sqlClient;

function getSql() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('Database belum dikonfigurasi. Tambahkan DATABASE_URL pada environment server.');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
}

async function query(text, params = []) {
  try {
    const sql = getSql();
    return await sql.query(text, params);
  } catch (error) {
    // Do not log connection strings, SQL parameters, or provider error details.
    const wrapped = new Error('Operasi database gagal.');
    wrapped.code = error.code || 'DATABASE_QUERY_FAILED';
    wrapped.isDatabaseError = true;
    wrapped.cause = error;
    throw wrapped;
  }
}

async function healthCheck() {
  const rows = await query('SELECT 1 AS ok');
  return Number(rows?.[0]?.ok) === 1;
}

// Tables/columns the application queries. Missing items mean migrations/ was not applied.
const REQUIRED_SCHEMA = {
  users: ['id', 'google_id', 'email', 'name', 'picture', 'tier', 'status', 'daily_usage', 'last_usage_reset', 'created_at', 'updated_at', 'banned_at', 'ban_reason'],
  api_keys: ['id', 'user_id', 'name', 'key_hash', 'key_prefix', 'status', 'idempotency_key', 'last_used_at', 'revoked_at'],
  endpoints: ['id', 'path', 'status', 'locked', 'minimum_tier', 'plugin'],
  daily_quota_counters: ['user_id', 'usage_date', 'request_count'],
  api_usage: ['user_id', 'api_key_id', 'endpoint_id', 'usage_date', 'request_count'],
  orders: ['id', 'user_id', 'order_code', 'tier', 'amount', 'status', 'idempotency_key', 'expires_at', 'paid_at'],
  payments: ['id', 'order_id', 'user_id', 'provider', 'status', 'proof_url', 'provider_reference', 'verified_at'],
  audit_logs: ['id', 'actor_user_id', 'action', 'metadata', 'ip_address'],
  server_settings: ['id', 'maintenance_enabled', 'maintenance_message']
};

async function checkSchema() {
  const rows = await query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
    [Object.keys(REQUIRED_SCHEMA)]
  );
  const present = new Set(rows.map(r => `${r.table_name}.${r.column_name}`));
  const missing = [];
  for (const [table, columns] of Object.entries(REQUIRED_SCHEMA)) {
    for (const column of columns) if (!present.has(`${table}.${column}`)) missing.push(`${table}.${column}`);
  }
  return { ok: missing.length === 0, missing };
}

module.exports = { query, healthCheck, checkSchema, REQUIRED_SCHEMA };
