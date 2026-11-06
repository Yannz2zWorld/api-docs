'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { clean, unseal } = require('../lib/hide');
const { BUILTIN, publicView } = require('../lib/catalog');
const tiers = require('../lib/tiers');

test('provider URLs and branding are hidden', () => {
  const out = clean('https://api-zero.web.id', {
    creator: 'someone', author: 'Dongtube API', channel: 'x',
    result: { url: 'https://cdn.dongtube.id/file/abc.mp4', other: 'https://example.com/a.png', note: 'by nexray' }
  }, new Set(['creator', 'author', 'channel']));
  assert.deepStrictEqual(Object.keys(out), ['result']);
  assert.match(out.result.url, /^https:\/\/api-zero\.web\.id\/api\/media\/[\w-]+\.mp4$/);
  assert.strictEqual(out.result.other, 'https://example.com/a.png');
  assert.doesNotMatch(out.result.note, /nexray/i);
  assert.strictEqual(unseal(out.result.url.split('/api/media/')[1]), 'https://cdn.dongtube.id/file/abc.mp4');
  assert.strictEqual(unseal('garbage'), null);
});

test('public endpoint view never names a provider', () => {
  const text = JSON.stringify(BUILTIN.map(publicView));
  assert.ok(BUILTIN.length > 100);
  assert.doesNotMatch(text, /dongtube|botcahx|theresav|nexray|api-faa|"upstream"|"server"/i);
  for (const e of BUILTIN) assert.match(e.path, /^\/api\/[\w.-]+\/[\w.-]+$/);
  assert.ok(BUILTIN.some(e => e.plan !== 'free'), 'some endpoints are premium by default');
});

test('tier ranks and expiry', () => {
  const future = new Date(Date.now() + 86400000), past = new Date(Date.now() - 1000);
  assert.strictEqual(tiers.effectiveTier({ tier: 'premium', tier_expires_at: future }).id, 'premium');
  assert.strictEqual(tiers.effectiveTier({ tier: 'premium', tier_expires_at: past }).id, 'free');
  assert.ok(tiers.canUse({ tier: 'premium', tier_expires_at: future }, 'premium'));
  assert.ok(!tiers.canUse({ tier: 'basic', tier_expires_at: future }, 'premium'));
  assert.ok(tiers.canUse({ tier: 'freedom', tier_expires_at: future }, 'freedom'));
  assert.ok(!tiers.publicTiers().some(t => t.id === 'developer'));
});
