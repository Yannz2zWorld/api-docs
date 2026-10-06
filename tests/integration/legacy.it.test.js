'use strict';
// Production's orders/payments tables predate migration 002 and may keep the old app's CHECK
// constraints. Order expiry must not take the billing page down, and migration 008 must
// remove only the legacy constraints that reject values this application writes.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');

const MIGRATION_008 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '008_legacy_constraints.sql'), 'utf8');
let app;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  const db = h.db();
  // Recreate the legacy shape: only the old app's constraints on status/payment_method.
  for (const [table, column] of [['orders', 'status'], ['payments', 'status'], ['payments', 'payment_method']]) {
    const names = (await db.query(
      `SELECT con.conname FROM pg_constraint con JOIN pg_class r ON r.oid=con.conrelid JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum=con.conkey[1]
        WHERE con.contype='c' AND r.relname=$1 AND a.attname=$2 AND r.relnamespace=(SELECT oid FROM pg_namespace WHERE nspname=current_schema())`, [table, column])).rows;
    for (const { conname } of names) await db.query(`ALTER TABLE ${table} DROP CONSTRAINT ${conname}`);
  }
  await db.query("ALTER TABLE orders ADD CONSTRAINT legacy_order_status CHECK (status IN ('pending','paid','failed'))");
  await db.query("ALTER TABLE payments ADD CONSTRAINT legacy_payment_status CHECK (status IN ('pending','paid','failed','expired','rejected'))");
  await db.query("ALTER TABLE payments ADD CONSTRAINT legacy_payment_method CHECK (payment_method IN ('dana','gopay'))");
  app = await h.startApp();
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const post = (cookie, url, body) => app.request('POST', url, { cookie, body, headers: { origin: app.origin } });

it('legacy constraints: billing still loads, failures carry the SQLSTATE, and 008 repairs them', async () => {
  const cookie = await app.login('legacy@example.test');
  const stale = (await post(cookie, '/api/orders', { tier: 'SULTAN' })).json.order;
  await h.db().query("UPDATE orders SET expires_at=now()-interval '1 hour' WHERE id=$1", [stale.id]);

  const list = await app.request('GET', '/api/orders', { cookie });
  assert.equal(list.status, 200, 'expiry failure does not break the page');
  assert.ok(h.logs.some(l => l.includes('Order expiry skipped') && l.includes('23514')));

  const fresh = (await post(cookie, '/api/orders', { tier: 'SULTAN' })).json.order;
  const blocked = await post(cookie, `/api/orders/${fresh.id}/manual`, { method: 'QRIS', proof_url: 'https://example.test/p.png' });
  assert.deepEqual([blocked.status, blocked.json.error, blocked.json.dbCode], [503, 'DATABASE_UNAVAILABLE', '23514']);

  await h.db().query(MIGRATION_008);
  await h.db().query(MIGRATION_008); // idempotent
  const remaining = (await h.db().query("SELECT conname FROM pg_constraint WHERE conname LIKE 'legacy_%' ORDER BY 1")).rows.map(r => r.conname);
  assert.deepEqual(remaining, ['legacy_payment_status'], 'only constraints that reject needed values are dropped');

  await app.request('GET', '/api/orders', { cookie });
  assert.equal((await h.db().query('SELECT status FROM orders WHERE id=$1', [stale.id])).rows[0].status, 'expired');
  const ok = await post(cookie, `/api/orders/${fresh.id}/manual`, { method: 'QRIS', proof_url: 'https://example.test/p.png' });
  assert.equal(ok.status, 201);
  const bad = h.db().query("UPDATE orders SET status='bogus' WHERE id=$1", [fresh.id]);
  await assert.rejects(bad, /orders_status_chk/, 'the application constraint is back');
});
