'use strict';
// Owner panel: every user's API keys — search (incl. by full key), revoke and delete.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app, owner;
const made = {};
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  owner = await app.login(h.OWNER_EMAIL);
  for (const who of ['kalpha', 'kbeta']) {
    const email = `${who}@example.test`;
    await app.login(email);
    await h.setTier(email, 'SULTAN');
    const cookie = await app.login(email);
    const r = await app.request('POST', '/api/keys', { cookie, headers: { origin: app.origin }, body: { name: `${who} bot` } });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    made[who] = { cookie, key: r.json.key, id: r.json.record.id };
  }
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const search = (body, cookie = owner) => app.request('POST', '/owner/keys/search', { cookie, headers: { origin: app.origin }, body });
const ping = key => app.request('GET', '/api/tools/ping', { headers: { authorization: `Bearer ${key}` } });

it('lists every user\'s keys with their owner, never the key value or hash', async () => {
  const r = await search({});
  assert.equal(r.status, 200);
  const emails = r.json.keys.map(k => k.user_email);
  assert.ok(emails.includes('kalpha@example.test') && emails.includes('kbeta@example.test'));
  assert.ok(r.json.totals.active >= 2);
  const text = JSON.stringify(r.json);
  assert.doesNotMatch(text, /key_hash/);
  for (const m of Object.values(made)) assert.ok(!text.includes(m.key), 'full key never returned');
});

it('searches by owner email, key name and prefix; LIKE wildcards are literal', async () => {
  assert.deepEqual((await search({ q: 'kbeta@' })).json.keys.map(k => k.user_email), ['kbeta@example.test']);
  assert.deepEqual((await search({ q: 'alpha bot' })).json.keys.map(k => k.id), [made.kalpha.id]);
  const prefix = (await search({ q: 'kalpha' })).json.keys[0].key_prefix;
  assert.deepEqual((await search({ q: prefix })).json.keys.map(k => k.id), [made.kalpha.id], 'the visible prefix finds its key');
  assert.ok((await search({ q: 'yannz_live_' })).json.keys.length >= 2);
  assert.equal((await search({ q: '%' })).json.keys.length, 0);
});

it('a pasted full key finds exactly its owner', async () => {
  const r = await search({ q: made.kbeta.key });
  assert.equal(r.json.keys.length, 1);
  assert.equal(r.json.keys[0].id, made.kbeta.id);
  assert.equal(r.json.keys[0].exact_match, true);
});

it('owner can revoke and delete any key; both stop the key at once and are audited', async () => {
  assert.equal((await ping(made.kalpha.key)).status, 200);
  const rv = await app.request('POST', `/owner/keys/${made.kalpha.id}/revoke`, { cookie: owner, headers: { origin: app.origin } });
  assert.equal(rv.status, 200);
  assert.notEqual((await ping(made.kalpha.key)).status, 200);
  const again = await app.request('POST', `/owner/keys/${made.kalpha.id}/revoke`, { cookie: owner, headers: { origin: app.origin } });
  assert.equal(again.json.error, 'KEY_ALREADY_REVOKED');
  assert.deepEqual((await search({ q: 'kalpha', status: 'revoked' })).json.keys.map(k => k.id), [made.kalpha.id]);

  assert.equal((await ping(made.kbeta.key)).status, 200);
  const del = await app.request('DELETE', `/owner/keys/${made.kbeta.id}`, { cookie: owner, headers: { origin: app.origin } });
  assert.equal(del.status, 200);
  assert.notEqual((await ping(made.kbeta.key)).status, 200);
  assert.equal((await search({ q: 'kbeta' })).json.keys.length, 0);
  assert.equal((await app.request('DELETE', `/owner/keys/${made.kbeta.id}`, { cookie: owner, headers: { origin: app.origin } })).json.error, 'KEY_NOT_FOUND');

  const audit = await h.db().query("SELECT action FROM audit_logs WHERE target_id IN ($1,$2) ORDER BY created_at", [made.kalpha.id, made.kbeta.id]);
  assert.deepEqual(audit.rows.map(r => r.action).filter(a => a.startsWith('owner_')), ['owner_api_key_revoke', 'owner_api_key_delete']);
});

it('only the owner can list, revoke or delete other users\' keys; cross-site calls are refused', async () => {
  const user = made.kalpha.cookie;
  assert.equal((await search({}, user)).json.error, 'OWNER_REQUIRED');
  const r = await app.request('DELETE', `/owner/keys/${made.kalpha.id}`, { cookie: user, headers: { origin: app.origin } });
  assert.equal(r.json.error, 'OWNER_REQUIRED');
  const csrf = await app.request('POST', '/owner/keys/search', { cookie: owner, headers: { origin: 'https://evil.example' }, body: {} });
  assert.equal(csrf.status, 403);
});
