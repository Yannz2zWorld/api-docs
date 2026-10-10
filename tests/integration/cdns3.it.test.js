'use strict';
// CDN large files on any S3-compatible storage (lib/r2.js), e.g. Backblaze B2: the S3_* settings.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const S3 = { S3_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com', S3_ACCESS_KEY_ID: 'kid', S3_SECRET_ACCESS_KEY: 'secret-not-real', S3_BUCKET: 'yannz-cdn', S3_PUBLIC_URL: 'https://f004.backblazeb2.com/file/yannz-cdn/' };
const withEnv = async (env, fn) => {
  const old = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  Object.assign(process.env, env);
  try { return await fn(require('../../lib/r2')); } finally { for (const [k, v] of Object.entries(old)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
};

test('Backblaze B2 (S3_*): uploads are signed for its endpoint and region, files served from its public URL', () => withEnv(S3, async r2 => {
  assert.equal(r2.isConfigured(), true);
  const put = await r2.presignPut('abc.mp4', { contentType: 'video/mp4', contentDisposition: 'inline' });
  const u = new URL(put.url);
  assert.equal(u.origin + u.pathname, 'https://s3.us-west-004.backblazeb2.com/yannz-cdn/abc.mp4');
  assert.match(u.searchParams.get('X-Amz-Credential'), /^kid\/\d{8}\/us-west-004\/s3\/aws4_request$/);
  assert.doesNotMatch(put.url, /secret-not-real/);
  assert.equal(await r2.fileUrl('abc.mp4'), 'https://f004.backblazeb2.com/file/yannz-cdn/abc.mp4');
}));

test('a private bucket (no S3_PUBLIC_URL, so no card on B2): files are read with a short-lived signed link', () => withEnv({ ...S3, S3_PUBLIC_URL: '' }, async r2 => {
  assert.equal(r2.isConfigured(), true);
  const u = new URL(await r2.fileUrl('abc.mp4'));
  assert.equal(u.origin + u.pathname, 'https://s3.us-west-004.backblazeb2.com/yannz-cdn/abc.mp4');
  assert.equal(u.searchParams.get('X-Amz-Expires'), '3600');
  assert.ok(u.searchParams.get('X-Amz-Signature'));
  assert.doesNotMatch(u.href, /secret-not-real/);
}));

test('incomplete S3_* settings leave large uploads off', () => withEnv({ ...S3, S3_BUCKET: '' }, async r2 => {
  assert.equal(r2.isConfigured(), false);
}));
