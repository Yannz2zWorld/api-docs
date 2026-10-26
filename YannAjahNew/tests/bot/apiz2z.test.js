'use strict';
// APIZ2Z: klien (library/apiz2z.js), renderer, dan SETIAP command endpoint — semuanya dengan transport
// tiruan (tidak ada request keluar, tidak memakai kuota). Status "tested" untuk command APIZ2Z di laporan
// berarti lolos uji MOCK (path, parameter, method, autentikasi, render) — bukan uji live ke server.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Apiz2zClient } = require('../../library/apiz2z');
const { render } = require('../../library/apiz2z-render');
const { loadRegistry, mockCtx, freshStore } = require('./feature-harness');

const BASE_CFG = { baseUrl: 'https://apiz2z.web.id', apiKey: 'test-key-123', allowedHosts: ['apiz2z.web.id'], timeoutMs: 1000, retries: 2, perMinute: 1000, concurrency: 4, maxResponseBytes: 1 << 20, cacheTtlMs: 60000 };
const json = (status, obj, headers = {}) => ({ status, headers: { 'content-type': 'application/json', ...headers }, body: Buffer.from(JSON.stringify(obj)) });
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

function client(handler, cfg = {}) {
  const calls = [];
  const transport = async (url, opts) => { calls.push({ url: new URL(url), opts }); return handler(new URL(url), opts, calls.length); };
  return { api: new Apiz2zClient({ ...BASE_CFG, ...cfg }, { transport }), calls };
}

test('key dikirim lewat header Authorization: Bearer, tidak pernah di URL', async () => {
  const { api, calls } = client(() => json(200, { status: true, result: 'ok' }));
  await api.get('/api/search/google', { q: 'halo' });
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer test-key-123');
  assert.ok(!calls[0].url.href.includes('test-key-123'));
  assert.equal(calls[0].url.searchParams.get('q'), 'halo');
  assert.ok(calls[0].opts.allowHosts.has('apiz2z.web.id'));
});

test('endpoint di luar katalog & endpoint yang dikecualikan ditolak tanpa request', async () => {
  const { api, calls } = client(() => json(200, {}));
  await assert.rejects(api.get('/api/ngarang/endpoint', {}), e => e.code === 'UNKNOWN_ENDPOINT');
  await assert.rejects(api.get('/api/ai/deepnude-ai', {}), e => e.code === 'ENDPOINT_EXCLUDED');
  assert.equal(calls.length, 0);
});

test('validasi parameter: wajib, pilihan, tidak dikenal, karakter kontrol', async () => {
  const { api, calls } = client(() => json(200, { status: true }));
  await assert.rejects(api.get('/api/search/google', {}), e => e.code === 'PARAM_REQUIRED');
  await assert.rejects(api.get('/api/download/ytmp3', { url: 'https://youtu.be/x', bitrate: '999k' }), e => e.code === 'PARAM_INVALID');
  await assert.rejects(api.get('/api/search/google', { q: 'a', evil: '1' }), e => e.code === 'PARAM_UNKNOWN');
  await assert.rejects(api.get('/api/search/google', { q: 'a\u0000b' }), e => e.code === 'PARAM_INVALID');
  assert.equal(calls.length, 0);
});

test('tanpa API key -> NEEDS_API_KEY, tidak ada request', async () => {
  const { api, calls } = client(() => json(200, {}), { apiKey: '' });
  await assert.rejects(api.get('/api/search/google', { q: 'x' }), e => e.code === 'NEEDS_API_KEY');
  assert.equal(calls.length, 0);
});

test('retry terbatas untuk 503 lalu sukses; kuota habis tidak di-retry', async () => {
  let { api, calls } = client((u, o, n) => (n < 3 ? json(503, { status: false, error: 'UPSTREAM_FAILED', message: 'x' }) : json(200, { status: true, result: 'ok' })));
  const r = await api.get('/api/search/google', { q: 'retry' }, { cache: false });
  assert.equal(r.data.result, 'ok'); assert.equal(calls.length, 3);
  ({ api, calls } = client(() => json(429, { success: false, error: 'QUOTA_EXCEEDED', message: 'habis' })));
  await assert.rejects(api.get('/api/search/google', { q: 'q' }), e => e.code === 'QUOTA_EXCEEDED' && /Kuota harian/.test(e.userMessage));
  assert.equal(calls.length, 1);
});

test('timeout / error jaringan di-retry lalu gagal dengan error yang jelas', async () => {
  const { api, calls } = client(() => { throw Object.assign(new Error('timeout'), { code: 'TIMEOUT' }); });
  await assert.rejects(api.get('/api/search/google', { q: 't' }), e => e.code === 'TIMEOUT');
  assert.equal(calls.length, 3, '1 percobaan + 2 retry');
});

test('respons tidak valid: JSON rusak, status:false, HTTP 401', async () => {
  let { api } = client(() => ({ status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from('{rusak') }));
  await assert.rejects(api.get('/api/search/google', { q: 'a' }), e => e.code === 'INVALID_RESPONSE');
  ({ api } = client(() => json(200, { status: false, error: 'ENDPOINT_UNAVAILABLE', message: 'x' })));
  await assert.rejects(api.get('/api/search/google', { q: 'b' }), e => e.code === 'ENDPOINT_UNAVAILABLE');
  ({ api } = client(() => json(401, { success: false, error: 'INVALID_API_KEY', message: 'API key-nya nggak valid.' })));
  await assert.rejects(api.get('/api/search/google', { q: 'c' }), e => e.code === 'INVALID_API_KEY' && e.userMessage === 'API key APIZ2Z tidak valid.');
});

test('media biner diparse dari magic bytes; teks biasa tetap teks', async () => {
  let { api } = client(() => ({ status: 200, headers: { 'content-type': 'image/png' }, body: PNG }));
  const r = await api.get('/api/maker/brat', { text: 'hai' });
  assert.equal(r.kind, 'media'); assert.equal(r.mime, 'image/png');
  ({ api } = client(() => ({ status: 200, headers: { 'content-type': 'text/plain' }, body: Buffer.from('halo') })));
  assert.deepEqual(await api.get('/api/search/google', { q: 'x' }), { kind: 'text', text: 'halo' });
});

test('rate limit per menit & cache GET JSON', async () => {
  const { api, calls } = client(() => json(200, { status: true, result: 1 }), { perMinute: 2 });
  await api.get('/api/search/google', { q: 'a' });
  await api.get('/api/search/google', { q: 'a' });   // cache, tidak menghitung
  await api.get('/api/search/google', { q: 'b' });
  await assert.rejects(api.get('/api/search/google', { q: 'c' }), e => e.code === 'RATE_LIMITED');
  assert.equal(calls.length, 2);
  assert.equal(api.stats.cached, 1);
});

test('upload: POST body file mentah dengan Content-Type file', async () => {
  const { api, calls } = client(() => ({ status: 200, headers: { 'content-type': 'image/png' }, body: PNG }));
  await api.post('/api/tools/removebg', {}, { buffer: PNG, mime: 'image/png' });
  assert.equal(calls[0].opts.method, 'POST'); assert.equal(calls[0].opts.headers['Content-Type'], 'image/png'); assert.equal(calls[0].opts.body, PNG);
  await assert.rejects(api.post('/api/search/google', { q: 'x' }, { buffer: PNG, mime: 'image/png' }), e => e.code === 'UPLOAD_NOT_SUPPORTED');
});

test('net.request menolak host di luar allowlist dan IP privat (anti-SSRF)', async () => {
  const { request, download } = require('../../library/net');
  await assert.rejects(request('https://evil.example/x', { allowHosts: new Set(['apiz2z.web.id']) }), e => e.code === 'HOST_NOT_ALLOWED');
  await assert.rejects(download('http://127.0.0.1:1/x'), e => e.code === 'BLOCKED_HOST');
  await assert.rejects(download('http://169.254.169.254/latest/meta-data'), e => e.code === 'BLOCKED_HOST');
  await assert.rejects(download('file:///etc/passwd'), e => e.code === 'INVALID_URL');
});

test('renderer: downloader JSON -> media utama (video > thumbnail); AI -> teks; berita -> ringkasan', () => {
  const dl = render({ kind: 'json', data: { status: true, result: { title: 'Video', thumbnail: 'https://cdn.x/t.jpg', video: 'https://apiz2z.web.id/media/abc123' } } }, { category: 'downloader', title: 'TikTok' });
  assert.equal(dl.files[0].url, 'https://apiz2z.web.id/media/abc123');
  assert.match(dl.text, /Video/);
  const ai = render({ kind: 'json', data: { status: true, result: 'Jawaban AI' } }, { category: 'ai' });
  assert.deepEqual(ai, { files: [], text: 'Jawaban AI' });
  const news = render({ kind: 'json', data: { status: true, result: [{ title: 'A', link: 'https://n/1' }, { title: 'B', link: 'https://n/2' }] } }, { category: 'news', title: 'CNN' });
  assert.equal(news.files.length, 0); assert.match(news.text, /1\. \*A\*/);
  const media = render({ kind: 'media', buffer: PNG, mime: 'image/png' }, { category: 'maker' });
  assert.equal(media.files[0].mime, 'image/png');
});

// ---------------------------------------------------------------- setiap command APIZ2Z
const { registry } = loadRegistry();
const results = {};
const sample = p => (p.options ? p.options[0] : /url|link/i.test(p.name) ? 'https://example.com/contoh' : /^(no|count|limit|page|year|month|tahun|bulan|tanggal|tgl|bln|thn|days|level|grid|width|height|quality|resolution|zone|uid|id|nomor|number|amount|percentage|memberCount|currentxp|requiredxp|rank|exp|requiredExp|total_match|wr_now|wr_target|speed|volume|degrees|x|y|factor|resolusi|count)\d*$/i.test(p.name) ? '1' : /date|birth/i.test(p.name) ? '2000-01-01' : 'contoh');

for (const f of registry.features.values()) {
  if (f.source !== 'apiz2z') continue;
  test(`command ${f.name} -> ${f.dependencies.apiz2z}`, async () => {
    const ep = f.endpoint;
    const fileParam = ep.params.find(p => p.file);
    const req = ep.params.filter(p => p.required && !p.file);
    const text = req.map(sample).join('|');
    const calls = [];
    const api = new Apiz2zClient(BASE_CFG, { transport: async (url, opts) => { calls.push({ url: new URL(url), opts }); return json(200, { status: true, creator: 'Yannz', result: `OK ${ep.path}` }); } });
    const media = fileParam ? { mime: 'image/png', type: 'imageMessage', download: async () => PNG } : null;
    const { ctx, replies, files } = mockCtx({ feature: f, text, store: freshStore(), api, media, isGroup: true, extra: { m: { groupMetadata: { subject: 'Grup Test', participants: [{ id: '1@s.whatsapp.net' }] } } } });
    ctx.args = text ? text.split(/\s+/) : [];
    await f.run(ctx);
    const c = calls[0];
    const ok = calls.length === 1 && c.url.pathname === ep.path && c.opts.headers.Authorization === 'Bearer test-key-123'
      && req.every(p => c.url.searchParams.has(p.name) || (p.aliases || []).some(a => c.url.searchParams.has(a)))
      && (fileParam ? c.opts.method === 'POST' && c.opts.body === PNG : c.opts.method === 'GET')
      && (replies.join('\n').includes(`OK ${ep.path}`) || files.length > 0);
    results[f.id] = { passed: ok ? 1 : 0, failed: ok ? 0 : 1, cases: 1, kind: 'mock' };
    assert.ok(ok, JSON.stringify({ calls: calls.map(x => ({ path: x.url.pathname, q: Object.fromEntries(x.url.searchParams), m: x.opts.method })), replies: replies.slice(0, 2) }));
  });
}

test('command APIZ2Z: parameter kurang -> pesan penggunaan, tanpa request', async () => {
  const f = registry.resolve('tiktok');
  const calls = [];
  const api = new Apiz2zClient(BASE_CFG, { transport: async u => { calls.push(u); return json(200, {}); } });
  const { ctx } = mockCtx({ feature: f, text: '', store: freshStore(), api });
  await assert.rejects(f.run(ctx), e => e.name === 'UsageError' && /Parameter kurang: url/.test(e.message));
  assert.equal(calls.length, 0);
});

test('command APIZ2Z: key=value untuk parameter opsional', async () => {
  const f = registry.resolve('ytmp3');
  const calls = [];
  const api = new Apiz2zClient(BASE_CFG, { transport: async (u, o) => { calls.push(new URL(u)); return json(200, { status: true, result: 'ok' }); } });
  const { ctx } = mockCtx({ feature: f, text: 'https://youtu.be/abc bitrate=320k', store: freshStore(), api });
  await f.run(ctx);
  assert.equal(calls[0].searchParams.get('url'), 'https://youtu.be/abc');
  assert.equal(calls[0].searchParams.get('bitrate'), '320k');
});

after(() => {
  const file = path.join(__dirname, '..', '..', 'reports', 'feature-tests.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(file, 'utf8')).results || {}; } catch {}
  fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), results: { ...prev, ...results } }, null, 1));
});
