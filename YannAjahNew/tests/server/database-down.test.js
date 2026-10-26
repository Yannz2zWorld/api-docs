'use strict';
// PostgreSQL mati / tidak bisa dihubungi: API membalas 503 DATABASE_UNAVAILABLE (bukan 500), supaya bot
// tahu ini gangguan sementara (terkunci + cek ulang, token tidak dibuang) dan dashboard menampilkan pesan jelas.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('crypto');
const { createDb, wrapError } = require('../../server/lib/db');
const { createApp } = require('../../server/app');

test('error koneksi database ditandai unavailable; error query biasa tidak', () => {
  for (const code of ['ECONNREFUSED', 'ETIMEDOUT', '57P01', '08006', '53300']) assert.equal(wrapError(Object.assign(new Error('x'), { code })).unavailable, true, code);
  assert.equal(wrapError(new Error('Connection terminated unexpectedly')).unavailable, true);
  assert.equal(wrapError(Object.assign(new Error('x'), { code: '42P01' })).unavailable, false);
});

test('database mati: /api/bot/* dan /health/ready membalas 503', async () => {
  const db = createDb({ connectionString: 'postgres://u:p@127.0.0.1:1/none', max: 1 });
  const cfg = { production: false, host: '127.0.0.1', port: 0, publicUrl: 'http://127.0.0.1', origin: null, secureCookies: false, trustProxy: false,
    sessionSecret: crypto.randomBytes(32).toString('hex'), adminSessionHours: 12, botSessionDays: 30, bcryptCost: 10, backupKey: 'test-backup-key-0123456789' };
  const server = http.createServer(createApp({ db, cfg, logger: { error() {} } }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const r = await fetch(`${base}/api/bot/heartbeat`, { method: 'POST', headers: { authorization: `Bearer yab_${'x'.repeat(43)}`, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error, 'DATABASE_UNAVAILABLE');
    assert.equal((await fetch(`${base}/health/ready`)).status, 503);
  } finally { server.close(); await db.close(); }
});
