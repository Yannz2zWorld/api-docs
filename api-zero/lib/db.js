'use strict';
// PostgreSQL (Neon / Supabase / lokal). Tabel dibuat otomatis dari lib/schema.sql.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool = null;
let ready = null;

function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw Object.assign(new Error('DATABASE_URL belum diisi.'), { code: 'DB_NOT_CONFIGURED' });
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  pool = new Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX || 3),
    idleTimeoutMillis: 10000,
    ssl: local || /sslmode=/.test(url) ? undefined : { rejectUnauthorized: false }
  });
  pool.on('error', e => console.error('db pool error:', e.message));
  return pool;
}

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await getPool().query(sql);
}
function ensure() {
  if (!ready) ready = migrate().catch(e => { ready = null; throw e; });
  return ready;
}

async function q(text, params = []) {
  await ensure();
  return (await getPool().query(text, params)).rows;
}
async function one(text, params = []) { return (await q(text, params))[0] || null; }

async function tx(fn) {
  await ensure();
  const c = await getPool().connect();
  try {
    await c.query('BEGIN');
    const out = await fn((t, p = []) => c.query(t, p).then(r => r.rows));
    await c.query('COMMIT');
    return out;
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
  finally { c.release(); }
}

module.exports = { q, one, tx, ensure, close: () => pool && pool.end().then(() => { pool = null; ready = null; }) };
