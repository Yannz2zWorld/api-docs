'use strict';
// AI endpoints proxied to api.theresav.eu (plugin/theresav-ai.js + lib/theresav.js). The upstream
// is never contacted: global fetch is stubbed for it and for a fake image host.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns');
const h = require('./helpers');

const KEY = 'upstream-test-key-not-real';
const realFetch = global.fetch;
const realLookup = dns.promises.lookup;
let calls = [];
let reply = () => ({ status: 200, json: { status: true, creator: 'Upstream', result: 'ok' } });

let app, user;
before(async () => {
  if (h.skip) return;
  delete process.env.GITHUB_TOKEN;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.theresav.eu/')) {
      const call = { url: new URL(u), method: opts.method || 'GET', headers: opts.headers || {}, form: opts.body instanceof FormData ? opts.body : null };
      calls.push(call);
      const r = reply(call);
      if (r.bytes) return new Response(r.bytes, { status: r.status, headers: { 'content-type': r.type } });
      return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    if (u.startsWith('https://img.example.test/')) return new Response(Buffer.from('PNGDATA'), { status: 200, headers: { 'content-type': 'image/png' } });
    return realFetch(url, opts);
  };
  // img.example.test resolves to a public address; everything else uses the real resolver.
  dns.promises.lookup = async (host, o) => (host === 'img.example.test' ? [{ address: '93.184.216.34', family: 4 }] : realLookup(host, o));
  await h.setupDatabase();
  app = await h.startApp({ THERESAV_API_KEY: KEY });
  user = await app.login('ai@example.test');
});
after(async () => { global.fetch = realFetch; dns.promises.lookup = realLookup; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { calls = []; reply = () => ({ status: 200, json: { status: true, creator: 'Upstream', result: 'ok' } }); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const call = (path) => app.request('GET', path, app.asBrowser(user));
const usedToday = async () => h.usedToday((await h.userByEmail('ai@example.test')).id);

it('the catalog lists the AI endpoints with required/optional parameters', async () => {
  const cat = (await app.request('GET', '/api/endpoints')).json.endpoints.AI;
  assert.equal(cat.length, 16);
  const chat = cat.find(e => e.cleanPath === '/api/ai/chatgpt');
  assert.deepEqual(chat.params.map(p => [p.name, p.required]), [['prompt', true], ['chatId', false]]);
});

it('ChatGPT: forwards prompt and chatId with the key in a header; the reply carries our creator, never the key', async () => {
  reply = () => ({ status: 200, json: { status: true, creator: 'Blckrosé', result: 'Halo!', chatId: 'abc123' } });
  const r = await call('/api/ai/chatgpt?prompt=halo&chatId=prev1');
  assert.equal(r.status, 200, r.text);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/api/ai/chatgpt');
  assert.equal(calls[0].url.searchParams.get('prompt'), 'halo');
  assert.equal(calls[0].url.searchParams.get('chatId'), 'prev1');
  assert.equal(calls[0].headers['x-apikey'], KEY);
  assert.deepEqual([r.json.status, r.json.result, r.json.chatId], [true, 'Halo!', 'abc123']);
  assert.notEqual(r.json.creator, 'Blckrosé');
  assert.ok(!r.text.includes(KEY));
  assert.ok(!h.logs.join('\n').includes(KEY), 'the upstream key is never logged');
});

it('validation: required parameters, choices (case-insensitive) and booleans are checked before calling upstream', async () => {
  assert.deepEqual([(await call('/api/ai/chatgpt')).status, calls.length], [400, 0]);
  const genre = await call('/api/ai/talefy?text=kucing&genre=drama');
  assert.equal(genre.json.error, 'INVALID_PARAMETER');
  assert.ok(genre.json.options.includes('fantasy'));
  assert.equal((await call('/api/ai/voice?prompt=hai&voice=goku')).status, 200);
  assert.equal(calls.at(-1).url.searchParams.get('voice'), 'Goku');
  assert.equal(calls.at(-1).url.pathname, '/api/ai/magichour/voice');
  assert.equal((await call('/api/ai/qwen?text=hai&search=maybe')).json.error, 'INVALID_PARAMETER');
  assert.equal((await call('/api/ai/copilot?prompt=hai')).status, 200);
  assert.equal(calls.at(-1).url.searchParams.get('mode'), 'default');
  assert.equal((await call('/api/ai/google?q=ikan')).status, 200, 'aliases work');
  assert.equal(calls.at(-1).url.searchParams.get('query'), 'ikan');
});

it('upstream failures are refunded: status:false → 502, upstream validation → 400', async () => {
  const before = await usedToday();
  reply = () => ({ status: 200, json: { status: false, error: 'API Error (403): quota' } });
  const r = await call('/api/ai/claude?text=hai');
  assert.deepEqual([r.status, r.json.error], [502, 'UPSTREAM_FAILED']);
  reply = () => ({ status: 400, json: { status: false, error: 'Validation failed', details: { genre: {} } } });
  const v = await call('/api/ai/talefy?text=hai&genre=horror');
  assert.deepEqual([v.status, v.json.error], [400, 'INVALID_PARAMETER']);
  assert.equal(await usedToday(), before, 'failed calls do not use quota');
  reply = () => ({ status: 200, json: { status: true, result: 'ok' } });
  await call('/api/ai/bypassai?text=hai');
  assert.equal(await usedToday(), before + 1, 'a successful call uses one request');
});

it('GPT-4o with imageUrl: the image is fetched and sent as multipart; private or non-https URLs are refused', async () => {
  const r = await call('/api/ai/gpt?text=apa+ini&imageUrl=' + encodeURIComponent('https://img.example.test/meme.png') + '&chatId=c1');
  assert.equal(r.status, 200, r.text);
  const sent = calls[0];
  assert.equal(sent.method, 'POST');
  assert.equal(sent.form.get('text'), 'apa ini');
  assert.equal(sent.form.get('chatId'), 'c1');
  assert.equal(sent.form.get('imageUrl'), null);
  const file = sent.form.get('image');
  assert.equal(file.type, 'image/png');
  assert.equal(Buffer.from(await file.arrayBuffer()).toString(), 'PNGDATA');
  for (const bad of ['http://img.example.test/a.png', 'https://127.0.0.1/a.png', 'https://localhost/a.png', 'https://169.254.169.254/latest']) {
    const b = await call('/api/ai/gpt?text=x&imageUrl=' + encodeURIComponent(bad));
    assert.equal(b.status, 400, bad);
  }
  assert.equal(calls.length, 1, 'refused URLs never reach upstream');
});

it('without THERESAV_API_KEY the endpoints say so and charge nothing', async () => {
  const saved = process.env.THERESAV_API_KEY;
  delete process.env.THERESAV_API_KEY;
  try {
    const r = await call('/api/ai/gemini?prompt=hai');
    assert.deepEqual([r.status, r.json.error], [503, 'UPSTREAM_NOT_CONFIGURED']);
    assert.equal(calls.length, 0);
  } finally {
    process.env.THERESAV_API_KEY = saved;
  }
});

it('Downloader: 30 theresav endpoints next to TikTok; url is forwarded; YouTube options have defaults and choices', async () => {
  const dl = (await app.request('GET', '/api/endpoints')).json.endpoints.Downloader;
  assert.equal(dl.length, 31);
  assert.ok(dl.some(e => e.cleanPath === '/api/download/tiktok'), 'the existing TikTok downloader stays');
  assert.ok(!dl.some(e => /erome/i.test(e.cleanPath)), 'adult-content sources are not offered');
  reply = () => ({ status: 200, json: { status: true, creator: 'Upstream', result: { url: 'https://cdn.example/v.mp4' } } });
  const r = await call('/api/download/instagram?url=' + encodeURIComponent('https://www.instagram.com/reel/abc/'));
  assert.equal(r.status, 200, r.text);
  assert.equal(calls[0].url.pathname, '/api/download/instagram');
  assert.equal(calls[0].url.searchParams.get('url'), 'https://www.instagram.com/reel/abc/');
  await call('/api/download/ytmp3?url=https://youtu.be/x');
  assert.deepEqual([calls[1].url.searchParams.get('format'), calls[1].url.searchParams.get('bitrate')], ['mp3', '128k']);
  assert.equal((await call('/api/download/ytmp4?url=https://youtu.be/x&resolution=999')).json.error, 'INVALID_PARAMETER');
  assert.equal((await call('/api/download/play?q=jj+epep')).status, 200);
  assert.equal(calls.at(-1).url.searchParams.get('query'), 'jj epep');
  assert.equal((await call('/api/download/facebook')).json.error, 'PARAM_REQUIRED');
});

it('Maker: Brat answers with the image itself (passed through), Brat Video defaults to mp4, emoji endpoints answer JSON', async () => {
  const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
  reply = () => ({ status: 200, bytes: PNG, type: 'image/png' });
  const img = await app.request('GET', '/api/maker/brat?text=hi', app.asBrowser(user));
  assert.equal(img.status, 200);
  assert.match(img.headers['content-type'], /^image\/png/);
  assert.equal(calls[0].url.pathname, '/api/maker/brat');
  reply = () => ({ status: 200, bytes: Buffer.from('MP4DATA'), type: 'video/mp4' });
  const vid = await call('/api/maker/bratvid?text=hi');
  assert.match(vid.headers['content-type'], /^video\/mp4/);
  assert.equal(calls[1].url.searchParams.get('format'), 'mp4');
  assert.equal((await call('/api/maker/bratvid?text=hi&format=webm')).json.error, 'INVALID_PARAMETER');
  reply = () => ({ status: 200, json: { status: true, creator: 'X', result: { emoji1: '😂', emoji2: '😭', url: 'https://www.gstatic.com/x.png' } } });
  const mix = await call('/api/maker/emojimix?emoji1=' + encodeURIComponent('😂') + '&emoji2=' + encodeURIComponent('😭'));
  assert.equal(mix.json.result.url, 'https://www.gstatic.com/x.png');
  assert.equal(calls.at(-1).url.searchParams.get('emoji2'), '😭');
  assert.equal((await call('/api/maker/emojimix?emoji1=x')).json.error, 'PARAM_REQUIRED');
  const cat = (await app.request('GET', '/api/endpoints')).json.endpoints.Maker;
  assert.deepEqual(cat.map(e => e.cleanPath).sort(), ['/api/maker/brat', '/api/maker/bratvid', '/api/maker/emojimix', '/api/maker/emojitogif']);
});

it('an empty media answer is refused and refunded', async () => {
  reply = () => ({ status: 200, bytes: Buffer.alloc(0), type: 'image/png' });
  const r = await call('/api/maker/brat?text=hi');
  assert.deepEqual([r.status, r.json.error], [502, 'UPSTREAM_FAILED']);
});

it('Image/Lumi Art: downloads the imageUrl and forwards it as the upstream image field', async () => {
  reply = () => ({ status: 200, bytes: Buffer.from('ARTPNG'), type: 'image/png' });
  const r = await app.request('GET', '/api/image/lumiart?imageUrl=' + encodeURIComponent('https://img.example.test/me.png'), app.asBrowser(user));
  assert.equal(r.status, 200, r.text);
  assert.match(r.headers['content-type'], /^image\/png/);
  assert.equal(calls[0].url.pathname, '/api/image/lumiart');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].form.get('image').type, 'image/png');
  assert.equal((await call('/api/image/lumiart')).json.error, 'PARAM_REQUIRED');
  assert.equal((await call('/api/image/lumiart?imageUrl=https://127.0.0.1/x.png')).status, 400);
});

it('developer self-test: probes sampled endpoints, marks the rest manual, and disables the failing ones', async () => {
  const owner = await app.login(h.OWNER_EMAIL);
  const o = (method, url, body) => app.request(method, url, { cookie: owner, headers: { origin: app.origin }, body });
  reply = (call) => (call.url.pathname === '/api/ai/claude'
    ? { status: 200, json: { status: false, error: 'quota habis' } }
    : { status: 200, json: { status: true, creator: 'X', result: 'ok' } });
  const r = await o('POST', '/owner/api/selftest', {});
  assert.equal(r.status, 200, r.text);
  assert.ok(r.json.summary.ok >= 28, JSON.stringify(r.json.summary));
  assert.ok(r.json.summary.manual >= 20, 'url/photo endpoints need a real input → manual');
  const claude = r.json.results.find(x => x.path === '/api/ai/claude');
  assert.equal(claude.result, 'error');
  assert.match(claude.error, /quota habis/);
  const lumi = r.json.results.find(x => x.path === '/api/image/lumiart');
  assert.equal(lumi.result, 'manual');

  // disable the failing one; the gateway then refuses it
  const dis = await o('POST', '/owner/api/endpoints/bulk-status', { ids: [claude.id], status: 'disabled' });
  assert.equal(dis.json.changed, 1);
  const blocked = await call('/api/ai/claude?text=hi');
  assert.deepEqual([blocked.status, blocked.json.error], [404, 'ENDPOINT_UNAVAILABLE']);
  await o('POST', '/owner/api/endpoints/bulk-status', { ids: [claude.id], status: 'active' });
});

it('file endpoints take a real upload (POST raw body), forwarded as multipart; URL still works for API users', async () => {
  const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
  const up = (path, headers) => app.request('POST', path, { cookie: user, rawBody: PNG, headers: { 'content-type': 'image/png', origin: app.origin, 'x-yannz-client': 'web', ...headers } });
  reply = () => ({ status: 200, json: { status: true, creator: 'X', result: 'ok' } });
  // GPT-4o: the uploaded bytes become the multipart "image" field; text stays a query param
  const r = await up('/api/ai/gpt?text=apa+ini&chatId=c1');
  assert.equal(r.status, 200, r.text);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].form.get('text'), 'apa ini');
  const sent = calls[0].form.get('image');
  assert.equal(sent.type, 'image/png');
  assert.ok(Buffer.from(await sent.arrayBuffer()).equals(PNG));
  // Lumi Art: upload required — without a file and without a URL it says so
  reply = () => ({ status: 200, bytes: PNG, type: 'image/png' });
  const lumi = await up('/api/image/lumiart');
  assert.equal(lumi.status, 200, lumi.text);
  assert.match(lumi.headers['content-type'], /^image\/png/);
  const none = await app.request('GET', '/api/image/lumiart', app.asBrowser(user));
  assert.deepEqual([none.status, none.json.error], [400, 'PARAM_REQUIRED']);
  // a too-big upload is refused
  const big = await app.request('POST', '/api/image/lumiart', { cookie: user, rawBody: Buffer.alloc(9 * 1024 * 1024), headers: { 'content-type': 'image/png', origin: app.origin, 'x-yannz-client': 'web' } });
  assert.equal(big.status, 413);
  // the catalog marks the file parameter as type 'file' so the sandbox shows an upload button
  const gpt = (await app.request('GET', '/api/endpoints')).json.endpoints.AI.find(e => e.cleanPath === '/api/ai/gpt');
  assert.equal(gpt.params.find(p => p.name === 'imageUrl').type, 'file');
});
