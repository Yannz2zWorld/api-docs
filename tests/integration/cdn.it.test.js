'use strict';
// CDN: upload file apa saja dari halaman /upload (POST /cdn/upload, fitur website — bukan endpoint API)
// disimpan di Postgres dan dilayani publik di /cdn/<id>.<ext> tanpa autentikasi. Jenis aman dibuka di
// browser, sisanya jadi unduhan.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

// PNG kecil yang valid untuk sniff (signature 8 byte + sedikit isi).
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('0000000d49484452', 'hex')]);

let app, user;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  user = await app.login('cdn@example.test');
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const up = (rawBody, headers = {}, qs = '') => app.request('POST', '/cdn/upload' + qs, { cookie: user, rawBody, headers: { 'content-type': 'image/png', origin: app.origin, 'x-yannz-client': 'web', ...headers } });

it('upload returns a public /cdn URL that serves the exact bytes without auth', async () => {
  const r = await up(PNG);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.status, true);
  assert.match(r.json.result.url, /\/cdn\/[a-f0-9]{32}\.png$/);
  assert.equal(r.json.result.mime, 'image/png');
  assert.equal(r.json.result.size, PNG.length);
  assert.equal(r.json.result.expiresAt, null); // permanen secara default

  // Ambil lewat path publik tanpa cookie/kunci.
  const id = r.json.result.url.split('/cdn/')[1];
  const got = await app.request('GET', '/cdn/' + id, {});
  assert.equal(got.status, 200, got.text);
  assert.equal(got.headers['content-type'], 'image/png');
  assert.equal(Buffer.from(got.text, 'binary').length, PNG.length);
});

it('any file type: kept with its name; safe types open inline, others download, all sandboxed', async () => {
  const get = async url => app.request('GET', '/cdn/' + url.split('/cdn/')[1], {});

  const pdf = await up(Buffer.from('%PDF-1.4 contoh'), { 'content-type': 'application/pdf' }, '?name=' + encodeURIComponent('Laporan Akhir.pdf'));
  assert.equal(pdf.status, 200, pdf.text);
  assert.match(pdf.json.result.url, /\/cdn\/[a-f0-9]{32}\.pdf$/);
  assert.deepEqual([pdf.json.result.name, pdf.json.result.mime, pdf.json.result.preview], ['Laporan Akhir.pdf', 'application/pdf', true]);
  const pdfGot = await get(pdf.json.result.url);
  assert.equal(pdfGot.headers['content-type'], 'application/pdf');
  assert.match(pdfGot.headers['content-disposition'], /^inline; filename\*=UTF-8''Laporan%20Akhir\.pdf$/);

  const mp4 = await up(Buffer.from('fake mp4 bytes for test'), { 'content-type': 'video/mp4' }, '?name=klip.mp4');
  assert.equal((await get(mp4.json.result.url)).headers['content-type'], 'video/mp4');

  const mp3 = await up(Buffer.from('ID3 fake audio'), { 'content-type': 'audio/mpeg' }, '?name=lagu.mp3');
  assert.equal((await get(mp3.json.result.url)).headers['content-type'], 'audio/mpeg');

  // no name: the extension comes from the content type, unknown -> .bin
  const txt = await up(Buffer.from('halo dunia'), { 'content-type': 'text/plain' });
  assert.match(txt.json.result.url, /\.txt$/);
  const bin = await up(Buffer.from([1, 2, 3, 4]), { 'content-type': 'application/x-weird' });
  assert.match(bin.json.result.url, /\.bin$/);

  // HTML/SVG/ZIP: stored, but always downloaded as octet-stream and sandboxed (no script on this domain)
  for (const [name, type] of [['page.html', 'text/html'], ['logo.svg', 'image/svg+xml'], ['arsip.zip', 'application/zip']]) {
    const r = await up(Buffer.from('<script>alert(1)</script>'), { 'content-type': type }, '?name=' + name);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.result.preview, false);
    const got = await get(r.json.result.url);
    assert.equal(got.headers['content-type'], 'application/octet-stream', name);
    assert.match(got.headers['content-disposition'], /^attachment;/, name);
    assert.match(got.headers['content-security-policy'], /sandbox/, name);
    assert.equal(got.headers['x-content-type-options'], 'nosniff');
  }

  // a file named .png that is not really an image is still served as an image (nosniff), never as HTML
  const fake = await up(Buffer.from('<html><script>x</script></html>'), { 'content-type': 'image/png' }, '?name=foto.png');
  const fakeGot = await get(fake.json.result.url);
  assert.equal(fakeGot.headers['content-type'], 'image/png');
  assert.match(fakeGot.headers['content-security-policy'], /sandbox/);
});

it('rejects a too-big file and an empty body (quota refunded on 4xx)', async () => {
  // Over 4 MB (the Vercel-safe limit): refused by the CDN
  const big = await up(Buffer.alloc(5 * 1024 * 1024), { 'content-type': 'application/octet-stream' }, '?name=besar.bin');
  assert.equal(big.status, 413);
  assert.equal(big.json.error, 'FILE_TOO_LARGE');
  // Over the 8 MB body limit: refused by the body parser
  assert.equal((await up(Buffer.alloc(9 * 1024 * 1024))).status, 413);

  const empty = await up(Buffer.alloc(0));
  assert.equal(empty.status, 400);
  assert.equal(empty.json.error, 'NO_FILE');
});

it('an unknown or malformed id gives 404', async () => {
  assert.equal((await app.request('GET', '/cdn/notavalidid.png', {})).status, 404);
  assert.equal((await app.request('GET', '/cdn/' + 'a'.repeat(32) + '.png', {})).status, 404);
});

it('ttlHours makes a temporary file; the CDN is not an API endpoint (not in the catalog, no API key)', async () => {
  const temp = await up(PNG, {}, '?ttlHours=1');
  assert.equal(temp.status, 200, temp.text);
  assert.ok(temp.json.result.expiresAt, 'expiresAt should be set when ttlHours > 0');

  const cat = (await app.request('GET', '/api/endpoints')).json.endpoints;
  const all = Object.values(cat).flat().map(e => e.cleanPath);
  assert.ok(!all.includes('/api/tools/upload') && !all.some(p => p.startsWith('/cdn')), 'upload is not listed as an endpoint');
  assert.equal((await app.request('POST', '/api/tools/upload', { rawBody: PNG, headers: { 'content-type': 'image/png' } })).status, 404);
});

it('upload needs a signed-in account and is limited to 30 per hour per account', async () => {
  const anon = await app.request('POST', '/cdn/upload', { rawBody: PNG, headers: { 'content-type': 'image/png', origin: app.origin } });
  assert.equal(anon.status, 401);

  const heavy = await app.login('cdn-heavy@example.test');
  const send = () => app.request('POST', '/cdn/upload', { cookie: heavy, rawBody: PNG, headers: { 'content-type': 'image/png', origin: app.origin } });
  for (let i = 0; i < 30; i++) assert.equal((await send()).status, 200, 'upload ' + (i + 1));
  const over = await send();
  assert.equal(over.status, 429);
  assert.equal(over.json.error, 'UPLOAD_LIMIT');
});

it('the /upload page is served to signed-in users, sends others to the login page, and sits in the menu under 3D Scythe', async () => {
  const anon = await app.request('GET', '/upload', {});
  assert.equal(anon.status, 302);
  assert.equal(anon.headers.location, '/');
  const page = await app.request('GET', '/upload', app.asBrowser(user));
  assert.equal(page.status, 200);
  assert.match(page.text, /Upload File/);
  assert.match(page.text, /\/cdn\/upload/);
  // reachable from the dashboard's ☰ MENU, right under 3D Scythe (not from the endpoint catalog)
  const home = await app.request('GET', '/home', app.asBrowser(user));
  assert.match(home.text, /<a href="\/3d">3D Scythe<\/a><a href="\/upload">Upload CDN<\/a>/);
});

it('without Cloudflare R2, large files go to catbox (200 MB); CDN_CATBOX=off falls back to 4 MB', async () => {
  const cfg = await app.request('GET', '/cdn/upload/config', { cookie: user });
  assert.equal(cfg.status, 200, cfg.text);
  assert.deepEqual([cfg.json.large, cfg.json.mode, cfg.json.maxBytes, cfg.json.smallMaxBytes], [true, 'catbox', 200 * 1024 * 1024, 4 * 1024 * 1024]);
  // the R2 path itself is not available
  const start = await app.request('POST', '/cdn/upload/start', { cookie: user, body: { name: 'film.mp4', type: 'video/mp4', size: 50 * 1024 * 1024 }, headers: { origin: app.origin } });
  assert.equal(start.status, 503);
  assert.equal(start.json.error, 'LARGE_UPLOAD_UNAVAILABLE');

  process.env.CDN_CATBOX = 'off';
  try {
    const off = await app.request('GET', '/cdn/upload/config', { cookie: user });
    assert.deepEqual([off.json.large, off.json.mode, off.json.maxBytes], [false, null, 4 * 1024 * 1024]);
    const reg = await app.request('POST', '/cdn/upload/register', { cookie: user, body: { url: 'https://files.catbox.moe/abc123.mp4' }, headers: { origin: app.origin } });
    assert.equal(reg.status, 503);
  } finally { delete process.env.CDN_CATBOX; }
});

it('the developer manages CDN files in the Developer Panel (the CDN is not an API endpoint)', async () => {
  const ownerCookie = await app.login(h.OWNER_EMAIL);
  const userCookie = await app.login('cdn-panel@example.test');
  const up = await app.request('POST', '/cdn/upload?name=panel.png', { cookie: userCookie, rawBody: PNG, headers: { 'content-type': 'image/png', origin: app.origin } });
  assert.equal(up.status, 200, up.text);
  const id = up.json.result.url.split('/').pop();
  assert.equal((await app.request('GET', '/owner/cdn', { cookie: userCookie })).status, 403);
  const list = await app.request('GET', '/owner/cdn?q=panel', { cookie: ownerCookie });
  assert.equal(list.status, 200, list.text);
  const f = list.json.files.find(x => x.id === id);
  assert.ok(f, JSON.stringify(list.json));
  assert.equal(f.owner_email, 'cdn-panel@example.test');
  assert.match(f.url, new RegExp(`/cdn/${id.replace('.', '\\.')}$`));
  assert.ok(list.json.totals.files >= 1);
  assert.equal((await app.request('DELETE', `/owner/cdn/${id}`, { cookie: userCookie, headers: { origin: app.origin } })).status, 403);
  const del = await app.request('DELETE', `/owner/cdn/${id}`, { cookie: ownerCookie, headers: { origin: app.origin } });
  assert.equal(del.status, 200, del.text);
  assert.equal((await app.request('GET', `/cdn/${id}`)).status, 404);
  const cat = Object.values((await app.request('GET', '/api/endpoints')).json.endpoints).flat();
  assert.ok(!cat.some(e => /upload|cdn/i.test(e.cleanPath)), 'no CDN endpoint in the API catalog');
});
