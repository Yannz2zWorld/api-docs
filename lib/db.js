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
    wrapped.cause = error;
    throw wrapped;
  }
}

async function healthCheck() {
  const rows = await query('SELECT 1 AS ok');
  return Number(rows?.[0]?.ok) === 1;
}

module.exports = { query, healthCheck };
