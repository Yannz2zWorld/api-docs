'use strict';
// Announcement cards on the sign-in page and Home (views/announce.js): the maintenance card
// (message + when maintenance started) and the Developer panel's "Pengumuman Dev".
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

let app, owner, user;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  owner = await app.login(h.OWNER_EMAIL);
  user = await app.login('reader@example.test');
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const o = (method, url, body) => app.request(method, url, { cookie: owner, headers: { origin: app.origin }, body });
const view = f => fs.readFileSync(path.join(__dirname, '..', '..', 'views', f), 'utf8');

it('Pengumuman Dev: set in the Developer panel, read by the sign-in page and Home, removed with an empty message', async () => {
  const none = (await app.request('GET', '/auth/announce')).json;
  assert.deepEqual([none.success, none.maintenance, none.announcement], [true, null, null]);
  const saved = await o('PATCH', '/owner/announcement', { message: 'Server pindah malam ini', message2: '', button_label: 'Gabung grup', button_url: 'https://t.me/yannz' });
  assert.equal(saved.status, 200, saved.text);
  const a = (await app.request('GET', '/auth/announce')).json.announcement;
  assert.equal(a.message, 'Server pindah malam ini');
  assert.equal(a.message2, '');
  assert.equal(a.buttonLabel, 'Gabung grup');
  assert.equal(a.buttonUrl, 'https://t.me/yannz');
  assert.match(a.id, /^\d+$/);
  const s = (await o('GET', '/owner/server')).json.settings;
  assert.equal(s.announce_message, 'Server pindah malam ini');
  // A page of this site is fine too; script links and other junk are refused.
  assert.equal((await o('PATCH', '/owner/announcement', { message: 'x', button_url: '/pricing' })).status, 200);
  for (const bad of ['javascript:alert(1)', '//evil.example', 'data:text/html,hi', 'evil.example']) {
    assert.equal((await o('PATCH', '/owner/announcement', { message: 'x', button_url: bad })).json.error, 'INVALID_URL', bad);
  }
  // Only the owner, only from this site.
  assert.equal((await app.request('PATCH', '/owner/announcement', { cookie: user, headers: { origin: app.origin }, body: { message: 'hi' } })).status, 403);
  assert.equal((await app.request('PATCH', '/owner/announcement', { cookie: owner, headers: { origin: 'https://evil.example' }, body: { message: 'hi' } })).status, 403);
  assert.equal((await o('PATCH', '/owner/announcement', { message: '' })).json.announcement, null);
  assert.equal((await app.request('GET', '/auth/announce')).json.announcement, null);
});

it('maintenance: the card gets the message and the start time; the start time stays while it is on', async () => {
  try {
    await o('PATCH', '/owner/server', { maintenance_enabled: true, maintenance_message: 'Upgrade database' });
    const first = (await app.request('GET', '/auth/announce')).json.maintenance;
    assert.equal(first.message, 'Upgrade database');
    assert.ok(!isNaN(Date.parse(first.since)), 'start time');
    await new Promise(r => setTimeout(r, 20));
    await o('PATCH', '/owner/server', { maintenance_enabled: true, maintenance_message: 'Upgrade database, bentar lagi' });
    const again = await app.request('GET', '/auth/announce');
    assert.equal(again.json.maintenance.since, first.since, 'changing the message keeps the start time');
    const page = await app.request('GET', '/', { headers: { accept: 'text/html' } });
    assert.equal(page.status, 503);
    assert.match(page.text, /window\.__yannzAnnounce=/);
    assert.match(page.text, /id="login-form"|class="login/, 'the sign-in page itself, under the card');
  } finally {
    await o('PATCH', '/owner/server', { maintenance_enabled: false });
  }
  assert.equal((await app.request('GET', '/auth/announce')).json.maintenance, null);
  assert.equal((await o('GET', '/owner/server')).json.settings.maintenance_since, null);
});

it('the card is on the sign-in page and Home, flat (no glow), and the Developer panel has the form', () => {
  for (const f of ['login.html', 'index.html']) assert.match(view(f), /<script defer src="\/assets\/announce\.js"><\/script>/, f);
  const js = view('announce.js');
  for (const s of ['Pengumuman Dev', 'Maintenance ON', 'Pesan dev', 'Maintenance dimulai', 'Dimengerti', 'Pesan 2']) assert.ok(js.includes(s), s);
  assert.ok(!/blur\(|text-shadow|drop-shadow|box-shadow:[^;}]*\b0 0 \d+px|radial-gradient/.test(js), 'no glow, blur or soft shadows');
  assert.match(js, /data-no-i18n>\$\{esc\(s\.text\)\}/, 'the developer text is escaped and never translated');
  const ownerPage = view('owner.html');
  for (const id of ['ann-msg', 'ann-msg2', 'ann-label', 'ann-url', 'save-ann', 'clear-ann']) assert.match(ownerPage, new RegExp(`id="${id}"`), id);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '022_announcements.sql'), 'utf8'), /ADD COLUMN IF NOT EXISTS announce_button_url/);
});
