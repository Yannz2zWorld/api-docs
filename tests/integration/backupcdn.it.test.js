'use strict';
// "Kirim ke Gmail" with large-file storage (B2/R2) set up: what cannot be an attachment (the web zip,
// anything past the email size) goes to this site's own CDN as a 30-day link. R2, GitHub and the mail
// provider are never contacted: fetch and emailService.sendMail are stubbed.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const h = require('./helpers');
const emailService = require('../../services/emailService');

const R2_HOST = 'acct123.r2.cloudflarestorage.com';
const ZIP = Buffer.from('PK\x03\x04 fake zip of the website');
const CODELOAD = 'https://codeload.github.com/Yannz2zWorld/api-docs/legacy.zip/refs/heads/main?token=TEMP';
const realFetch = global.fetch;
const realSend = emailService.sendMail;
const objects = new Map();
let sent = [], failPut = false, refuseMail = 0;

let app, owner;
before(async () => {
  if (h.skip) return;
  global.fetch = async (input, init = {}) => {
    const req = typeof input === 'string' || input instanceof URL ? new Request(String(input), init) : input;
    const u = new URL(req.url);
    if (u.hostname === 'api.github.com') return new Response(null, { status: 302, headers: { location: CODELOAD } });
    if (u.hostname === 'codeload.github.com') return new Response(ZIP, { status: 200 });
    if (u.hostname !== R2_HOST) return realFetch(input, init);
    const key = decodeURIComponent(u.pathname.split('/').pop());
    if (req.method === 'PUT') {
      if (failPut) return new Response(null, { status: 500 });
      const body = Buffer.from(await req.arrayBuffer());
      objects.set(key, { size: body.length, contentType: req.headers.get('content-type') || '' });
      return new Response(null, { status: 200 });
    }
    if (req.method === 'HEAD') {
      const o = objects.get(key);
      return o ? new Response(null, { status: 200, headers: { 'content-length': String(o.size), 'content-type': o.contentType } }) : new Response(null, { status: 404 });
    }
    if (req.method === 'DELETE') { objects.delete(key); return new Response(null, { status: 204 }); }
    return new Response(null, { status: 405 });
  };
  emailService.sendMail = async msg => {
    if (refuseMail && msg.attachments.length) { refuseMail--; throw Object.assign(new Error('Email gagal dikirim.'), { code: 'EMAIL_SEND_FAILED', reason: 'Lampirannya kegedean buat Gmail.' }); }
    sent.push(msg);
  };
  await h.setupDatabase();
  app = await h.startApp({ GITHUB_TOKEN: 'gh-test-token', EMAIL_FROM: 'bot@example.test', SMTP_HOST: 'smtp.example.test', PUBLIC_BASE_URL: 'https://apiz2z.test',
    R2_ACCOUNT_ID: 'acct123', R2_ACCESS_KEY_ID: 'AKIDTEST', R2_SECRET_ACCESS_KEY: 'secret-not-real', R2_BUCKET: 'yannz-cdn', R2_PUBLIC_URL: 'https://pub-test.r2.dev/' });
  owner = await app.login(h.OWNER_EMAIL);
});
after(async () => { global.fetch = realFetch; emailService.sendMail = realSend; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { sent = []; failPut = false; refuseMail = 0; });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const email = parts => app.request('POST', '/owner/backup/email', { cookie: owner, headers: { origin: app.origin }, body: parts ? { parts } : {} });
const cdnRow = url => h.db().query("SELECT storage, ready, owner_id, data, expires_at FROM cdn_files WHERE id=$1", [url.split('/cdn/')[1]]).then(r => r.rows[0]);

it('the web zip goes as a link to the site\'s own CDN, stored in the bucket, expiring in 30 days', async () => {
  const st = await app.request('GET', '/owner/backup/status', { cookie: owner });
  assert.equal(st.json.cdn.configured, true);
  const r = await email();
  assert.equal(r.status, 200, r.text);
  const web = r.json.parts.find(p => p.key === 'web');
  assert.match(web.cdn, /^https:\/\/apiz2z\.test\/cdn\/[a-f0-9]{32}\.zip$/);
  assert.equal(web.attached, false);
  const row = await cdnRow(web.cdn);
  assert.deepEqual([row.storage, row.ready, row.owner_id, row.data], ['r2', true, null, null], 'in the bucket, not in the database');
  const hours = (new Date(row.expires_at) - Date.now()) / 3600e3;
  assert.ok(hours > 719 && hours <= 720, String(hours));
  const m = sent[0];
  assert.deepEqual(m.attachments.map(a => a.filename.replace(/\d{4}-\d{2}-\d{2}/, 'D')), ['yannz-db-D.sql', 'yannz-db-D.json']);
  assert.match(m.text, /File web \(\.zip\): yannz-web-.*\.zip .*unduh lewat CDN, berlaku sampai .* WIB: https:\/\/apiz2z\.test\/cdn\//);
  assert.match(m.html, /<a href="https:\/\/apiz2z\.test\/cdn\/[a-f0-9]{32}\.zip">/);
});

it('when the bucket refuses the upload, the web files fall back to the panel link', async () => {
  failPut = true;
  const r = await email(['web']);
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.parts[0].cdn, r.json.parts[0].link], [null, 'https://apiz2z.test/owner/backup/web']);
});

it('when the mail server refuses the attachments, every file is resent as a CDN link', async () => {
  refuseMail = 1;
  const r = await email(['database', 'json']);
  assert.equal(r.status, 200, r.text);
  assert.ok(r.json.parts.every(p => p.cdn && !p.attached), JSON.stringify(r.json.parts));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].attachments.length, 0);
});

it('a database past the email size goes as a CDN link instead of "too big"', async () => {
  // Random base64, as CDN files are kept in the database: barely shrinks when gzipped.
  await h.db().query("INSERT INTO cdn_files(id, name, mime, data, size) VALUES($1, 'big.bin', 'application/octet-stream', $2, 1)", [crypto.randomBytes(16).toString('hex') + '.bin', crypto.randomBytes(17 * 1024 * 1024).toString('base64')]);
  const r = await email(['database']);
  assert.equal(r.status, 200, r.text);
  const p = r.json.parts[0];
  assert.match(p.filename, /^yannz-db-.*\.sql\.gz$/);
  assert.ok(p.size > 15 * 1024 * 1024 && p.cdn && !p.error, JSON.stringify(p));
  assert.equal(sent[0].attachments.length, 0);
});
