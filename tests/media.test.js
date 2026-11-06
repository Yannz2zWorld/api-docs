'use strict';
// Media answers: audio/video recognised from their bytes, and stored files served in parts (206)
// so Safari / iOS can play them.
const test = require('node:test');
const assert = require('node:assert');
const cdn = require('../services/cdnService');
const { sendStoredFile } = require('../services/cdnHttp');

function fakeRes(range) {
  const out = { status: 200, headers: {}, body: null };
  const res = {
    req: { headers: range ? { range } : {} },
    set(k, v) { out.headers[k.toLowerCase()] = v; return res; },
    status(c) { out.status = c; return res; },
    end(b) { out.body = b || null; return res; }
  };
  return { res, out };
}

test('M4A labelled audio/mpeg is served as audio/mp4', () => {
  const buf = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A '), Buffer.alloc(32)]);
  const k = cdn.kindOf({ name: null, type: 'audio/mpeg', buffer: buf });
  assert.strictEqual(k.mime, 'audio/mp4');
  assert.strictEqual(k.inline, true);
  assert.strictEqual(k.image, null);
});

test('MP3 from an octet-stream source is playable inline', () => {
  const buf = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(32)]);
  const k = cdn.kindOf({ name: null, type: 'application/octet-stream', buffer: buf });
  assert.strictEqual(k.mime, 'audio/mpeg');
  assert.strictEqual(k.inline, true);
});

test('audio never passes as an image (imagesOnly stays strict)', () => {
  const buf = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(32)]);
  assert.strictEqual(cdn.kindOf({ name: 'x.png', type: 'image/png', buffer: buf }).image, null);
});

test('stored file answers a range request with 206', () => {
  const f = { name: 'a.mp3', mime: 'audio/mpeg', inline: true, buffer: Buffer.from('0123456789'), size: 10 };
  const { res, out } = fakeRes('bytes=2-5');
  sendStoredFile(res, f);
  assert.strictEqual(out.status, 206);
  assert.strictEqual(out.headers['content-range'], 'bytes 2-5/10');
  assert.strictEqual(out.body.toString(), '2345');
  assert.strictEqual(out.headers['accept-ranges'], 'bytes');
});

test('open-ended and suffix ranges work; out of range is 416', () => {
  const f = { name: 'a.mp3', mime: 'audio/mpeg', inline: true, buffer: Buffer.from('0123456789'), size: 10 };
  let r = fakeRes('bytes=7-'); sendStoredFile(r.res, f); assert.strictEqual(r.out.body.toString(), '789');
  r = fakeRes('bytes=-3'); sendStoredFile(r.res, f); assert.strictEqual(r.out.body.toString(), '789');
  r = fakeRes('bytes=20-'); sendStoredFile(r.res, f); assert.strictEqual(r.out.status, 416);
  r = fakeRes(null); sendStoredFile(r.res, f); assert.strictEqual(r.out.status, 200); assert.strictEqual(r.out.body.length, 10);
});
