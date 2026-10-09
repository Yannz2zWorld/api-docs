'use strict';

const { neon } = require('@neondatabase/serverless');

let sqlClient;

function getSql() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('Database belum diatur. Tambahin DATABASE_URL di environment server.');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
}

function wrapError(error) {
  // Do not log connection strings, SQL parameters, or provider error details.
  const wrapped = new Error('Operasi database gagal.');
  wrapped.code = error.code || 'DATABASE_QUERY_FAILED';
  wrapped.isDatabaseError = true;
  wrapped.cause = error;
  return wrapped;
}

async function query(text, params = []) {
  try {
    const sql = getSql();
    return await sql.query(text, params);
  } catch (error) {
    throw wrapError(error);
  }
}

// Runs [{text, params}] as one non-interactive transaction (READ COMMITTED: each
// statement sees rows committed before it starts). Returns one row array per statement.
async function transaction(statements) {
  try {
    const sql = getSql();
    return await sql.transaction(statements.map(s => sql.query(s.text, s.params || [])));
  } catch (error) {
    throw wrapError(error);
  }
}

async function healthCheck() {
  const rows = await query('SELECT 1 AS ok');
  return Number(rows?.[0]?.ok) === 1;
}

// Tables/columns the application queries. Missing items mean migrations/ was not applied.
const REQUIRED_SCHEMA = {
  users: ['id', 'google_id', 'email', 'name', 'picture', 'tier', 'status', 'daily_usage', 'last_usage_reset', 'created_at', 'updated_at', 'banned_at', 'ban_reason', 'session_version', 'password_hash', 'password_updated_at', 'email_verified', 'failed_login_count', 'locked_until', 'tier_expires_at'],
  api_keys: ['id', 'user_id', 'name', 'key_hash', 'key_prefix', 'status', 'idempotency_key', 'last_used_at', 'created_at', 'revoked_at', 'custom'],
  endpoints: ['id', 'name', 'path', 'description', 'method', 'status', 'locked', 'minimum_tier', 'plugin', 'created_at', 'updated_at'],
  daily_quota_counters: ['user_id', 'usage_date', 'request_count', 'updated_at'],
  api_usage: ['id', 'user_id', 'api_key_id', 'endpoint_id', 'usage_date', 'request_count', 'created_at', 'updated_at'],
  orders: ['id', 'user_id', 'order_code', 'tier', 'amount', 'status', 'idempotency_key', 'created_at', 'updated_at', 'expires_at', 'paid_at', 'duration_days'],
  payments: ['id', 'order_id', 'user_id', 'provider', 'payment_method', 'transaction_id', 'provider_reference', 'amount', 'proof_url', 'status', 'verified_at', 'created_at', 'updated_at', 'payment_url', 'qr_string', 'va_number', 'gateway_expires_at', 'owner_notified'],
  audit_logs: ['id', 'actor_user_id', 'action', 'target_type', 'target_id', 'metadata', 'ip_address', 'created_at'],
  server_settings: ['id', 'maintenance_enabled', 'maintenance_message', 'updated_at', 'updated_by', 'payment_dana_number', 'payment_dana_name', 'payment_gopay_number', 'payment_gopay_name'],
  auth_codes: ['id', 'user_id', 'purpose', 'code_hash', 'attempts', 'expires_at', 'consumed_at', 'created_at'],
  payment_proofs: ['payment_id', 'mime', 'size_bytes', 'sha256', 'data', 'created_at'],
  api_key_failures: ['ip', 'bucket', 'count']
};

// Unique indexes that ON CONFLICT clauses depend on. Without them inserts fail at runtime.
const REQUIRED_UNIQUE = [
  ['users', ['google_id']], ['api_keys', ['key_hash']], ['endpoints', ['path']],
  ['daily_quota_counters', ['user_id', 'usage_date']], ['api_usage', ['user_id', 'endpoint_id', 'usage_date']],
  ['orders', ['order_code']], ['orders', ['user_id', 'idempotency_key']], ['api_keys', ['user_id', 'idempotency_key']],
  ['payments', ['provider', 'transaction_id']], ['server_settings', ['id']],
  ['payment_proofs', ['payment_id']], ['api_key_failures', ['ip', 'bucket']]
];

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
  const indexes = await query(
    `SELECT t.relname AS table_name, array_agg(a.attname ORDER BY k.ord)::text[] AS columns
       FROM pg_index i
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = current_schema()
       CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE i.indisunique AND t.relname = ANY($1::text[])
      GROUP BY i.indexrelid, t.relname`,
    [[...new Set(REQUIRED_UNIQUE.map(([t]) => t))]]
  );
  const unique = new Set(indexes.map(r => `${r.table_name}(${[...r.columns].sort().join(',')})`));
  for (const [table, columns] of REQUIRED_UNIQUE) {
    const key = `${table}(${[...columns].sort().join(',')})`;
    if (!unique.has(key)) missing.push(`unique:${table}(${columns.join(',')})`);
  }
  return { ok: missing.length === 0, missing };
}

module.exports = { query, transaction, healthCheck, checkSchema, REQUIRED_SCHEMA };
