'use strict';
// Owner panel: new endpoint + uploaded .js, committed to plugin/ through the GitHub API.
// GitHub is never contacted: global fetch is stubbed for api.github.com.
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const h = require('./helpers');
const pluginService = require('../../services/githubPluginService');

let app, owner;
const realFetch = global.fetch;
let github = [];          // recorded GitHub calls
let respond = () => ({ status: 404, json: {} });
delete process.env.GITHUB_TOKEN;   // never use a token from the machine running the tests

before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  owner = await app.login(h.OWNER_EMAIL);
  global.fetch = async (url, opts = {}) => {
    if (!String(url).startsWith('https://api.github.com/')) return realFetch(url, opts);
    const call = { url: String(url), method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body ? JSON.parse(opts.body) : null };
    github.push(call);
    const { status, json } = respond(call);
    return new Response(JSON.stringify(json || {}), { status, headers: { 'content-type': 'application/json' } });
  };
});
afterEach(() => { github = []; delete process.env.GITHUB_TOKEN; });
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

const SCRIPT = "module.exports = async (req, res) => res.json({ status: true, result: String(req.query.text || '').toUpperCase() });";
const create = body => app.request('POST', '/owner/api/endpoints', { cookie: owner, headers: { origin: app.origin }, body: { name: 'Upper', path: '/api/tools/upper', description: 'Huruf besar', minimum_tier: 'SULTAN', code: SCRIPT, sample: { text: 'halo' }, ...body } });
const row = p => h.db().query('SELECT * FROM endpoints WHERE path=$1', [p]).then(r => r.rows[0]);

it('without GITHUB_TOKEN the upload is refused and nothing is stored', async () => {
  const r = await create({});
  assert.deepEqual([r.status, r.json.error], [503, 'GITHUB_NOT_CONFIGURED']);
  assert.equal(await row('/api/tools/upper'), undefined);
  assert.equal(github.length, 0);
});

it('rejects bad paths, empty or broken scripts, and scripts without an export', async () => {
  process.env.GITHUB_TOKEN = 'test-token';
  for (const [body, error] of [
    [{ path: '/api/Tools/upper' }, 'INVALID_ENDPOINT'],
    [{ path: '/api/upper' }, 'INVALID_ENDPOINT'],
    [{ code: '   ' }, 'SCRIPT_REQUIRED'],
    [{ code: 'module.exports = async (req, res) => {' }, 'SCRIPT_SYNTAX'],
    [{ code: 'const x = 1;' }, 'SCRIPT_NO_EXPORT'],
    [{ minimum_tier: 'GOD' }, 'INVALID_TIER']
  ]) {
    const r = await create(body);
    assert.equal(r.json.error, error, JSON.stringify(body));
    assert.ok(r.status >= 400 && r.status < 500);
  }
  assert.equal(github.length, 0, 'invalid input never reaches GitHub');
});

it('commits plugin/<kategori>-<nama>.js and stores the tier before the deploy', async () => {
  process.env.GITHUB_TOKEN = 'test-token';
  respond = call => call.method === 'GET' ? { status: 404 } : { status: 201, json: { commit: { sha: 'abc123', html_url: 'https://github.com/x/y/commit/abc123' } } };
  const r = await create({});
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.commit.sha, 'abc123');
  assert.equal(r.json.commit.file, 'plugin/tools-upper.js');
  assert.match(r.json.message, /deploy/);

  const put = github.find(c => c.method === 'PUT');
  assert.match(put.url, /\/repos\/Yannz2zWorld\/api-docs\/contents\/plugin\/tools-upper\.js$/);
  assert.equal(put.headers.Authorization, 'Bearer test-token');
  assert.equal(put.body.branch, 'main');
  assert.doesNotMatch(JSON.stringify(r.json), /test-token/, 'the token is never returned');

  const saved = await row('/api/tools/upper');
  assert.deepEqual([saved.minimum_tier, saved.plugin, saved.status, saved.description], ['SULTAN', 'tools-upper', 'active', 'Huruf besar']);

  // The committed file is a loadable plugin: metadata from the form, handler from the script.
  const source = Buffer.from(put.body.content, 'base64').toString('utf8');
  assert.ok(source.includes(SCRIPT));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-'));
  fs.writeFileSync(path.join(dir, 'tools-upper.js'), source);
  const plugin = require(path.join(dir, 'tools-upper.js'));
  assert.deepEqual([plugin.name, plugin.desc, plugin.category, plugin.path], ['Upper', 'Huruf besar', 'Tools', '/api/tools/upper']);
  let sent;
  await plugin.run({ query: { text: 'halo' } }, { json: v => { sent = v; } });
  assert.deepEqual(sent, { status: true, result: 'HALO' });

  const dup = await create({});
  assert.deepEqual([dup.status, dup.json.error], [409, 'ENDPOINT_EXISTS']);
  const list = await app.request('GET', '/owner/api/endpoints', { cookie: owner });
  assert.equal(list.json.endpoints.find(e => e.path === '/api/tools/upper').handler_loaded, false, 'live only after the deploy');
});

it('a failed commit removes the registry row; an existing file is never overwritten', async () => {
  process.env.GITHUB_TOKEN = 'test-token';
  respond = call => call.method === 'GET' ? { status: 404 } : { status: 401, json: { message: 'Bad credentials' } };
  let r = await create({ path: '/api/tools/fail-auth' });
  assert.deepEqual([r.status, r.json.error], [502, 'GITHUB_AUTH']);
  assert.equal(await row('/api/tools/fail-auth'), undefined);

  github = [];
  respond = () => ({ status: 200, json: { sha: 'existing' } });
  r = await create({ path: '/api/tools/exists' });
  assert.deepEqual([r.status, r.json.error], [409, 'PLUGIN_FILE_EXISTS']);
  assert.equal(github.filter(c => c.method === 'PUT').length, 0);
  assert.equal(await row('/api/tools/exists'), undefined);
});

it('only the owner can upload plugins', async () => {
  process.env.GITHUB_TOKEN = 'test-token';
  const user = await app.login('notowner@example.test');
  const r = await app.request('POST', '/owner/api/endpoints', { cookie: user, headers: { origin: app.origin }, body: { name: 'x', path: '/api/tools/x', code: SCRIPT } });
  assert.deepEqual([r.status, r.json.error], [403, 'OWNER_REQUIRED']);
  assert.equal(github.length, 0);
});

test('the generated plugin also accepts { run } and exports.run scripts', () => {
  for (const code of ['module.exports = { run(req, res) { res.json(1); } };', 'exports.run = (req, res) => res.json(1);']) {
    const src = pluginService.buildPluginFile({ name: 'N', desc: 'D', category: 'C', path: '/api/c/n', code });
    const m = { exports: {} };
    new Function('module', 'exports', 'require', src)(m, m.exports, require);
    let v; m.exports.run({}, { json: x => { v = x; } });
    assert.equal(v, 1);
  }
});
