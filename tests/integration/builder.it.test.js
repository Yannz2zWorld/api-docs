'use strict';
// Developer panel → add endpoint from any code (services/endpointBuilder.js): "Sempurnakan & tes",
// the test run, deploy only after a passing test, edit and delete an endpoint's own code file.
// Nothing leaves the machine: the upstream API and the AI are local servers, GitHub is stubbed.
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');
const builder = require('../../services/endpointBuilder');

let app, owner, user, upstream, ai, upstreamUrl, aiUrl;
const aiCalls = [];
let aiReply = () => ({ name: 'Pins Search', desc: 'Cari pin.', category: 'Search', path: '/api/search/pins-ai', params: [{ name: 'q', required: true, placeholder: 'kucing' }], sample: { q: 'kucing' },
  code: "module.exports = async (req, res) => { if (!req.query.q) return res.status(400).json({ status: false, error: 'PARAM_REQUIRED', message: 'q wajib' }); if (!process.env.EP_TEST_KEY) return res.status(503).json({ status: false, error: 'UPSTREAM_NOT_CONFIGURED', message: 'belum aktif' }); res.json({ status: true, result: [{ title: req.query.q }] }); };" });
const realFetch = global.fetch;
let github = [];
let respond = () => ({ status: 404, json: {} });

const listen = handler => new Promise(r => { const s = http.createServer(handler).listen(0, '127.0.0.1', () => r(s)); });
before(async () => {
  if (h.skip) return;
  // A third-party API: answers with data when the key header is right.
  upstream = await listen((req, res) => {
    const u = new URL(req.url, 'http://x');
    res.setHeader('content-type', 'application/json');
    if (req.headers['x-apikey'] !== 'rahasia-123') return res.end(JSON.stringify({ status: false, message: 'bad key' }));
    res.end(JSON.stringify({ status: true, data: [{ name: `pack ${u.searchParams.get('q')}`, url: 'https://cdn.example/x.png' }] }));
  });
  upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
  // An Anthropic-compatible Messages API (like a gateway), streaming or not.
  ai = await listen((req, res) => {
    let raw = ''; req.on('data', c => { raw += c; });
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      aiCalls.push({ url: req.url, headers: req.headers, body });
      const text = body.max_tokens <= 16 ? 'OK' : JSON.stringify(aiReply());
      const msg = { id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } };
      if (!body.stream) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(msg)); }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
      ev('message_start', { message: { ...msg, content: [], stop_reason: null } });
      ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
      ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
      ev('content_block_stop', { index: 0 });
      ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } });
      ev('message_stop', {});
      res.end();
    });
  });
  aiUrl = `http://127.0.0.1:${ai.address().port}/v1`;
  await h.setupDatabase();
  app = await h.startApp();
  owner = await app.login(h.OWNER_EMAIL);
  user = await app.login('builder-user@example.test');
  global.fetch = async (url, opts = {}) => {
    if (!String(url).startsWith('https://api.github.com/')) return realFetch(url, opts);
    const call = { url: String(url), method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null };
    github.push(call);
    const { status, json } = respond(call);
    return new Response(JSON.stringify(json || {}), { status, headers: { 'content-type': 'application/json' } });
  };
});
afterEach(() => { github = []; aiCalls.length = 0; for (const k of ['GITHUB_TOKEN', 'AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL', 'EP_127_0_0_KEY', 'EP_TEST_KEY']) delete process.env[k]; });
after(async () => { global.fetch = realFetch; upstream?.close(); ai?.close(); if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const o = (method, url, body) => app.request(method, url, { cookie: owner, headers: { origin: app.origin }, body });

const BOT = (url, key = 'rahasia-123') => `case 'caristiker':
case 'caristicker': {
 if (!text) return Reply(\`Format: .\${command} <query>\\nContoh: .\${command} jomok\`);
 const axios = require('axios');
 await alip.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
 try {
  const query = encodeURIComponent(text.trim());
  const response = await axios.get(\`${url}?q=\${query}\`, { headers: { 'x-apikey': '${key}' }, timeout: 30000 });
  await alip.sendMessage(m.chat, { image: { url: response.data.data[0].url }, caption: 'hasil' }, { quoted: m });
 } catch (error) { Reply('gagal'); }
}
break;`;

it('a WhatsApp bot case calling theresav becomes a theresav proxy endpoint; the pasted key is never used', async () => {
  const r = await o('POST', '/owner/api/endpoints/convert', { code: BOT('https://api.theresav.eu/api/search/stickerly', 'Yannhebatbgtz2z'), ai: 'never' });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.source, 'rules');
  assert.match(r.json.code, /require\('\.\.\/lib\/theresav'\)/);
  assert.match(r.json.code, /"upstream": "\/api\/search\/stickerly"/);
  assert.doesNotMatch(r.json.code, /Yannhebatbgtz2z|sendMessage|Reply/, 'no key and no bot code in the plugin');
  assert.doesNotMatch(r.text, /Yannhebatbgtz2z/, 'the key never comes back either');
  assert.deepEqual(r.json.secrets.map(s => [s.env, s.known]), [['THERESAV_API_KEY', true]]);
  assert.equal(r.json.meta.sample.q, 'jomok', 'the example from the bot help text becomes the test input');
  assert.equal(r.json.duplicate.path, '/api/search/stickerly', 'this one already exists on the site');
  assert.equal(r.json.meta.path, '/api/search/stickerly-v3', 'v2 is taken (NexRay)');
  assert.equal(r.json.test.ok, false, 'no THERESAV_API_KEY in the tests: the test run reports it');
  assert.match(r.json.test.message, /belum aktif/);
});

it('any other API: a small fetch handler with the key moved to an env; it is tested for real', async () => {
  const r = await o('POST', '/owner/api/endpoints/convert', { code: BOT(`${upstreamUrl}/api/search/pins`), ai: 'never' });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.meta.path, '/api/search/pins');
  assert.deepEqual(r.json.secrets.map(s => s.env), ['EP_127_0_0_KEY']);
  assert.match(r.json.code, /process\.env\.EP_127_0_0_KEY/);
  assert.doesNotMatch(r.json.code, /rahasia-123/);
  assert.equal(r.json.test.ok, false);
  assert.equal(r.json.test.error, 'UPSTREAM_NOT_CONFIGURED', 'until the env is filled in');
  process.env.EP_127_0_0_KEY = 'rahasia-123';
  const t = await o('POST', '/owner/api/endpoints/try', { code: r.json.code, path: r.json.meta.path, sample: { q: 'kucing' } });
  assert.equal(t.json.test.ok, true, JSON.stringify(t.json.test));
  assert.match(t.json.test.preview, /pack kucing/);
  const missing = await o('POST', '/owner/api/endpoints/try', { code: r.json.code, path: r.json.meta.path, sample: {} });
  assert.deepEqual([missing.json.test.ok, missing.json.test.error], [false, 'PARAM_REQUIRED']);
});

it('code the rules cannot handle goes to the AI (any Anthropic-compatible gateway); secrets never reach it', async () => {
  const code = BOT(`${upstreamUrl}/api/search/pins`, 'kunci-rahasia-999').replace('axios.get(', 'axios.post(');
  const noAi = await o('POST', '/owner/api/endpoints/convert', { code });
  assert.deepEqual([noAi.status, noAi.json.error], [422, 'AI_NOT_CONFIGURED']);
  process.env.AI_API_KEY = 'kl_test_key'; process.env.AI_BASE_URL = aiUrl; process.env.AI_MODEL = 'claude-opus-4.7';
  process.env.EP_TEST_KEY = 'x';
  const r = await o('POST', '/owner/api/endpoints/convert', { code });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.source, r.json.model, r.json.meta.path], ['ai', 'claude-opus-4.7', '/api/search/pins-ai']);
  assert.equal(r.json.test.ok, true, JSON.stringify(r.json.test));
  const call = aiCalls.find(c => c.body.stream);
  assert.equal(call.url, '/v1/messages', 'the gateway base URL may end in /v1');
  assert.equal(call.headers['x-api-key'], 'kl_test_key');
  assert.equal(call.headers.authorization, 'Bearer kl_test_key', 'gateways such as KryptonLab read the Bearer header');
  assert.equal(call.body.model, 'claude-opus-4.7');
  assert.doesNotMatch(JSON.stringify(call.body), /kunci-rahasia-999/, 'the key in the pasted code is never sent to the AI');
  assert.match(JSON.stringify(call.body), /__SECRET_1__ → process\.env\.EP_127_0_0_KEY/);
  // A reply that still carries a placeholder is cleaned before anything runs.
  aiReply = () => ({ name: 'X', path: '/api/tools/x', code: "module.exports = (req, res) => res.json({ status: true, result: '__SECRET_1__' + 'ok' });" });
  const r2 = await o('POST', '/owner/api/endpoints/convert', { code, ai: 'only' });
  assert.doesNotMatch(r2.json.code, /__SECRET_1__/);
  aiReply = () => ({ error: 'Ini bukan kode endpoint.' });
  const r3 = await o('POST', '/owner/api/endpoints/convert', { code, ai: 'only' });
  assert.deepEqual([r3.status, r3.json.error, r3.json.message], [422, 'NOT_CONVERTIBLE', 'Ini bukan kode endpoint.']);
});

it('the AI connection test and status', async () => {
  assert.equal((await app.request('GET', '/owner/api/ai', { cookie: owner })).json.ai.configured, false);
  assert.equal((await o('POST', '/owner/api/ai/ping')).status, 503);
  process.env.AI_API_KEY = 'kl_test_key'; process.env.AI_BASE_URL = aiUrl;
  const s = (await app.request('GET', '/owner/api/ai', { cookie: owner })).json.ai;
  assert.deepEqual([s.configured, s.model, s.host], [true, 'claude-opus-4.7', '127.0.0.1']);
  const p = await o('POST', '/owner/api/ai/ping');
  assert.equal(p.status, 200, p.text);
  assert.equal(p.json.reply, 'OK');
  assert.doesNotMatch(p.text, /kl_test_key/);
});

it('a ready plugin is used as it is; broken code is reported, never deployed', async () => {
  const plugin = "module.exports = async (req, res) => res.json({ status: true, result: 'pong' });";
  const r = await o('POST', '/owner/api/endpoints/convert', { code: plugin, ai: 'never' });
  assert.deepEqual([r.json.source, r.json.test.ok], ['plugin', true]);
  const broken = await o('POST', '/owner/api/endpoints/try', { code: "module.exports = async (req, res) => { throw new Error('meledak'); };", path: '/api/tools/boom', sample: {} });
  assert.equal(broken.json.test.ok, false);
  assert.match(broken.json.test.message, /meledak/);
  process.env.GITHUB_TOKEN = 'test-token';
  const deploy = await o('POST', '/owner/api/endpoints', { name: 'Boom', path: '/api/tools/boom', code: "module.exports = async (req, res) => res.status(500).json({ status: false, message: 'rusak' });" });
  assert.deepEqual([deploy.status, deploy.json.error], [422, 'TEST_FAILED']);
  assert.equal(github.length, 0, 'a failing endpoint never reaches GitHub');
});

it('edit and delete an endpoint that has its own code file; files with many endpoints are left alone', async () => {
  const rows = (await app.request('GET', '/owner/api/endpoints', { cookie: owner })).json.endpoints;
  const ping = rows.find(e => e.path === '/api/tools/ping');
  assert.deepEqual([ping.file, ping.file_endpoints, ping.code_editable], ['ping.js', 1, true]);
  const shared = rows.find(e => e.file_endpoints > 1);
  assert.equal(shared.code_editable, false);
  process.env.GITHUB_TOKEN = 'test-token';
  assert.equal((await app.request('GET', `/owner/api/endpoints/${shared.id}/code`, { cookie: owner })).json.error, 'MULTI_ENDPOINT_FILE');

  const pingSource = fs.readFileSync(path.join(__dirname, '..', '..', 'plugin', 'ping.js'), 'utf8');
  const sha = 'a'.repeat(40);
  respond = call => call.method === 'GET' ? { status: 200, json: { content: Buffer.from(pingSource).toString('base64'), sha } }
    : { status: 200, json: { commit: { sha: 'c0ffee', html_url: 'https://github.com/x/y/commit/c0ffee' } } };
  const got = await app.request('GET', `/owner/api/endpoints/${ping.id}/code`, { cookie: owner });
  assert.deepEqual([got.status, got.json.mode, got.json.sha], [200, 'file', sha]);
  assert.match(got.json.code, /\/api\/tools\/ping/);
  const brokenEdit = await o('PUT', `/owner/api/endpoints/${ping.id}/code`, { code: 'module.exports = {', sha, mode: 'file' });
  assert.equal(brokenEdit.json.error, 'SCRIPT_SYNTAX');
  const saved = await o('PUT', `/owner/api/endpoints/${ping.id}/code`, { code: got.json.code.replace('pong: true', 'pong: true, edited: true'), sha, mode: 'file' });
  assert.equal(saved.status, 200, saved.text);
  const put = github.find(c => c.method === 'PUT');
  assert.equal(put.body.sha, sha, 'only replaces the version that was opened');
  assert.match(Buffer.from(put.body.content, 'base64').toString(), /edited: true/);

  github = [];
  const del = await o('DELETE', `/owner/api/endpoints/${ping.id}`);
  assert.equal(del.status, 200, del.text);
  assert.equal(github.find(c => c.method === 'DELETE').body.sha, sha);
  const after = (await h.db().query('SELECT status,plugin FROM endpoints WHERE id=$1', [ping.id])).rows[0];
  assert.deepEqual([after.status, after.plugin], ['disabled', 'deleted:ping.js'], 'switched off right away; gone after the next deploy');
});

it('only the developer, only from this site', async () => {
  for (const [m, u] of [['POST', '/owner/api/endpoints/convert'], ['POST', '/owner/api/endpoints/try'], ['POST', '/owner/api/ai/ping']]) {
    assert.equal((await app.request(m, u, { cookie: user, headers: { origin: app.origin }, body: { code: 'x' } })).status, 403, u);
    assert.equal((await app.request(m, u, { cookie: owner, headers: { origin: 'https://evil.example' }, body: { code: 'x' } })).status, 403, u);
  }
});

it('the panel: paste → Sempurnakan & tes → preview → deploy; Test/Check All API; edit and delete buttons', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'views', 'owner.html'), 'utf8');
  for (const id of ['ep-source', 'ep-convert', 'ep-ai', 'ep-preview', 'ep-test', 'ep-code', 'ep-retest', 'ep-submit', 'ai-ping', 'code-dialog', 'code-save']) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, />Test\/Check All API</);
  assert.doesNotMatch(html, /Tes endpoint theresav/);
  assert.match(html, /id="ep-submit" disabled/, 'deploy stays off until a test passes');
  assert.match(html, /data-ep="code"/);
  assert.match(html, /data-ep="\$\{e\.handler_loaded \? 'delete-code' : 'delete'\}"/);
});

it('rules: secrets are hidden and URLs are read the way the bot wrote them', () => {
  const hid = builder.hideSecrets("const API_KEY = 'abcdef123'; fetch(`https://x.io/a?apikey=zzzzzz99&q=${q}`, { headers: { Authorization: 'Bearer tok_123456' } })");
  assert.deepEqual(hid.secrets.map(s => s.kind).sort(), ['const', 'header', 'query']);
  assert.doesNotMatch(hid.code, /abcdef123|zzzzzz99|tok_123456/);
  assert.match(hid.code, /Bearer __SECRET_/);
  const t = builder.parseTemplateUrl('https://api.x.io/v1/search/pins?q=${encodeURIComponent(text)}&limit=5');
  assert.deepEqual([t.pathname, t.params.map(p => p.key), t.fixed], ['/v1/search/pins', ['q'], { limit: '5' }]);
  assert.equal(builder.parseTemplateUrl('https://api.x.io/user/${name}'), null, 'values in the path go to the AI');
});
