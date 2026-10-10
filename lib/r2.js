'use strict';
// Cloudflare R2 (S3-compatible) for large CDN files. The browser uploads straight to R2 with a
// short-lived presigned PUT URL, so big files never pass through Vercel (4.5 MB body limit).
// Files are then served from the bucket's public URL; /cdn/<id> redirects there.
//
// Config (Vercel env), either
//   Cloudflare R2: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (secret), R2_BUCKET,
//     R2_PUBLIC_URL (the bucket's public r2.dev URL or a custom domain), or
//   any other S3-compatible storage, e.g. Backblaze B2 (free 10 GB, no card): S3_ENDPOINT
//     (https://s3.<region>.backblazeb2.com), S3_ACCESS_KEY_ID (keyID), S3_SECRET_ACCESS_KEY
//     (applicationKey, secret), S3_BUCKET, S3_PUBLIC_URL (https://f<nnn>.backblazeb2.com/file/<bucket>),
//     optional S3_REGION (read from the endpoint when left out).
// Keys are never logged or returned to the browser; only the presigned URL is.
const { AwsClient } = require('aws4fetch');

const PRESIGN_SECONDS = 15 * 60;

function config() {
  const env = n => (process.env[n] || '').trim();
  const r2 = { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY'), bucket: env('R2_BUCKET'), publicUrl: env('R2_PUBLIC_URL').replace(/\/+$/, '') };
  const account = env('R2_ACCOUNT_ID');
  if (account && Object.values(r2).every(Boolean)) return { ...r2, endpoint: `https://${account}.r2.cloudflarestorage.com`, region: 'auto' };
  const endpoint = env('S3_ENDPOINT').replace(/\/+$/, '');
  const s3 = { accessKeyId: env('S3_ACCESS_KEY_ID'), secretAccessKey: env('S3_SECRET_ACCESS_KEY'), bucket: env('S3_BUCKET'), publicUrl: env('S3_PUBLIC_URL').replace(/\/+$/, '') };
  if (/^https:\/\/[^/]+$/.test(endpoint) && Object.values(s3).every(Boolean)) {
    return { ...s3, endpoint, region: env('S3_REGION') || /^https:\/\/s3\.([a-z0-9-]+)\./.exec(endpoint)?.[1] || 'us-east-1' };
  }
  return null;
}
const isConfigured = () => Boolean(config());

let client = null;
let clientKey = '';
function aws(c) {
  const key = c.accessKeyId + ':' + c.secretAccessKey + ':' + c.region;
  if (!client || clientKey !== key) {
    client = new AwsClient({ accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, service: 's3', region: c.region });
    clientKey = key;
  }
  return client;
}
const objectUrl = (c, key) => `${c.endpoint}/${encodeURIComponent(c.bucket)}/${encodeURIComponent(key)}`;

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
