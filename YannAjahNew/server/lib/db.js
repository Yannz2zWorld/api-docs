'use strict';
// Akses PostgreSQL untuk backend YannAjahNew (pola sama dengan lib/db.js platform APIZ2Z:
// error dibungkus tanpa connection string / parameter SQL). Berbeda dari driver HTTP Neon,
// di sini dipakai `pg` Pool agar transaksi interaktif (SELECT ... FOR UPDATE) bisa dipakai
// untuk menjaga kuota tetap benar saat request bersamaan. `pg` juga bisa tersambung ke Neon.

const { Pool } = require('pg');

function wrapError(error) {
  if (error && error.isDatabaseError) return error;
  const wrapped = new Error('Operasi database gagal.');
  wrapped.code = error?.code || 'DATABASE_QUERY_FAILED';
  wrapped.constraint = error?.constraint;   // nama constraint aman ditampilkan, berguna untuk pesan 409
  wrapped.isDatabaseError = true;
  wrapped.cause = error;
  return wrapped;
}

function createDb({ connectionString, schema = null, max = 10, ssl } = {}) {
  if (!connectionString) {
    const e = new Error('DATABASE_URL belum diatur.');
    e.code = 'DATABASE_NOT_CONFIGURED';
    throw e;
  }
  if (schema && !/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Nama schema tidak valid');
  const needSsl = ssl ?? /sslmode=require|neon\.tech/.test(connectionString);
  const pool = new Pool({
    connectionString,
    max,
    ...(needSsl ? { ssl: { rejectUnauthorized: true } } : {}),
    ...(schema ? { options: `-c search_path=${schema},public` } : {})
  });
  pool.on('error', () => {});   // klien idle yang putus: jangan crash proses

  async function query(text, params = []) {
    try { return (await pool.query(text, params)).rows; }
    catch (e) { throw wrapError(e); }
  }

  // fn(tx) dengan tx.query(); COMMIT kalau sukses, ROLLBACK kalau melempar error.
  async function withTransaction(fn, { isolation = 'READ COMMITTED' } = {}) {
    let client;
    try { client = await pool.connect(); } catch (e) { throw wrapError(e); }
    const tx = { query: async (text, params = []) => { try { return (await client.query(text, params)).rows; } catch (e) { throw wrapError(e); } } };
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
      const out = await fn(tx);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  async function healthCheck() {
    const started = Date.now();
    const rows = await query('SELECT 1 AS ok');
    return { ok: Number(rows?.[0]?.ok) === 1, ms: Date.now() - started };
  }

  return { query, withTransaction, healthCheck, pool, close: () => pool.end() };
}

module.exports = { createDb, wrapError };
