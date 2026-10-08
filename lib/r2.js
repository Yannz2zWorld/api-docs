'use strict';
// Cloudflare R2 (S3-compatible) for large CDN files. The browser uploads straight to R2 with a
// short-lived presigned PUT URL, so big files never pass through Vercel (4.5 MB body limit).
// Files are then served from the bucket's public URL; /cdn/<id> redirects there.
//
// Config (Vercel env): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (secret), R2_BUCKET,
// R2_PUBLIC_URL (the bucket's public r2.dev URL or a custom domain). Keys are never logged or
// returned to the browser; only the presigned URL is.
const { AwsClient } = require('aws4fetch');

const PRESIGN_SECONDS = 15 * 60;

function config() {
  const c = {
    accountId: (process.env.R2_ACCOUNT_ID || '').trim(),
    accessKeyId: (process.env.R2_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY || '').trim(),
    bucket: (process.env.R2_BUCKET || '').trim(),
    publicUrl: (process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '')
  };
  return Object.values(c).every(Boolean) ? c : null;
}
const isConfigured = () => Boolean(config());

let client = null;
let clientKey = '';
function aws(c) {
  const key = c.accessKeyId + ':' + c.secretAccessKey;
  if (!client || clientKey !== key) {
    client = new AwsClient({ accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, service: 's3', region: 'auto' });
    clientKey = key;
  }
  return client;
}
const objectUrl = (c, key) => `https://${c.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(c.bucket)}/${encodeURIComponent(key)}`;

// Presigned PUT for one object. The browser must send exactly the Content-Disposition given here
// (it is part of the signature) and the Content-Type given here (checked again in head()).
async function presignPut(key, { contentType, contentDisposition }) {
  const c = config();
  if (!c) throw Object.assign(new Error('R2 not configured'), { code: 'R2_NOT_CONFIGURED' });
  const signed = await aws(c).sign(`${objectUrl(c, key)}?X-Amz-Expires=${PRESIGN_SECONDS}`, {
    method: 'PUT',
    headers: { 'content-type': contentType, 'content-disposition': contentDisposition },
    aws: { signQuery: true }
  });
  return { url: signed.url, headers: { 'Content-Type': contentType, 'Content-Disposition': contentDisposition }, expiresIn: PRESIGN_SECONDS };
}

// { exists, size, contentType } of an uploaded object.
async function head(key) {
  const c = config();
  if (!c) throw Object.assign(new Error('R2 not configured'), { code: 'R2_NOT_CONFIGURED' });
  const r = await aws(c).fetch(objectUrl(c, key), { method: 'HEAD' });
  if (r.status === 404) return { exists: false };
  if (!r.ok) throw Object.assign(new Error(`R2 HEAD ${r.status}`), { code: 'R2_FAILED' });
  return { exists: true, size: Number(r.headers.get('content-length') || 0), contentType: (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() };
}

async function remove(key) {
  const c = config();
  if (!c) return false;
  try { const r = await aws(c).fetch(objectUrl(c, key), { method: 'DELETE' }); return r.ok || r.status === 404; } catch { return false; }
}

function publicUrl(key) {
  const c = config();
  return c ? `${c.publicUrl}/${encodeURIComponent(key)}` : null;
}

module.exports = { isConfigured, presignPut, head, remove, publicUrl, PRESIGN_SECONDS };
