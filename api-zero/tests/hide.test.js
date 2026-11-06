'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { clean, unseal } = require('../lib/hide');
const catalog = require('../lib/catalog');

test('provider URLs and branding are hidden', () => {
  const out = clean('https://api-zero.web.id', {
    creator: 'someone', author: 'Dongtube API', channel: 'x',
    result: { url: 'https://cdn.dongtube.id/file/abc.mp4', other: 'https://example.com/a.png', note: 'by nexray' }
  }, new Set(['creator', 'author', 'channel']));
  assert.deepStrictEqual(Object.keys(out), ['result']);
  assert.match(out.result.url, /^https:\/\/api-zero\.web\.id\/api\/media\/[\w-]+\.mp4$/);
  assert.strictEqual(out.result.other, 'https://example.com/a.png');
  assert.doesNotMatch(out.result.note, /nexray/i);
  const token = out.result.url.split('/api/media/')[1];
  assert.strictEqual(unseal(token), 'https://cdn.dongtube.id/file/abc.mp4');
  assert.strictEqual(unseal('garbage'), null);
});

test('public catalog never names a provider', () => {
  const text = JSON.stringify(catalog.list());
  assert.ok(catalog.size() > 100);
  assert.doesNotMatch(text, /dongtube|botcahx|theresav|nexray|api-faa|"upstream"|"server"/i);
  for (const e of catalog.list()) assert.match(e.path, /^\/api\/[\w.-]+\/[\w.-]+$/);
});
