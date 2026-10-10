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
//     (applicationKey, secret), S3_BUCKET, optional S3_REGION (read from the endpoint when left out)
//     and optional S3_PUBLIC_URL. Without S3_PUBLIC_URL the bucket stays private (B2 asks for a card
//     for public buckets): each file is read with a short-lived presigned GET instead.
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
  if (/^https:\/\/[^/]+$/.test(endpoint) && s3.accessKeyId && s3.secretAccessKey && s3.bucket) {
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

// Where the server reads a stored file: the bucket's public URL, or for a private bucket a
// presigned GET valid for READ_SECONDS (fetched server-side, never shown to visitors).
const READ_SECONDS = 60 * 60;
async function fileUrl(key) {
  const c = config();
  if (!c) return null;
  if (c.publicUrl) return `${c.publicUrl}/${encodeURIComponent(key)}`;
  return (await aws(c).sign(`${objectUrl(c, key)}?X-Amz-Expires=${READ_SECONDS}`, { method: 'GET', aws: { signQuery: true } })).url;
}

// Which storage large files go to, for the Developer panel (never the keys).
function info() {
  const c = config();
  if (!c) return { configured: false };
  return { configured: true, kind: /\.r2\.cloudflarestorage\.com$/.test(c.endpoint) ? 'r2' : 's3', host: new URL(c.endpoint).host, bucket: c.bucket, private: !c.publicUrl };
}

// Lets the site's pages upload straight to the bucket (S3 PutBucketCors): PUT from the given
// origins, plus GET/HEAD. Replaces the bucket's CORS rules. Returns { ok, status, message }.
async function setCors(origins) {
  const c = config();
  if (!c) throw Object.assign(new Error('storage not configured'), { code: 'R2_NOT_CONFIGURED' });
  const esc = v => String(v).replace(/[<>&'"]/g, ch => `&#${ch.charCodeAt(0)};`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><CORSRule>${origins.map(o => `<AllowedOrigin>${esc(o)}</AllowedOrigin>`).join('')}<AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
  const md5 = require('crypto').createHash('md5').update(xml).digest('base64');
  const r = await aws(c).fetch(`${c.endpoint}/${encodeURIComponent(c.bucket)}?cors`, { method: 'PUT', headers: { 'content-type': 'application/xml', 'content-md5': md5 }, body: xml });
  if (r.ok) return { ok: true, status: r.status };
  const text = await r.text().catch(() => '');
  const message = (/<Message>([^<]{1,300})<\/Message>/.exec(text)?.[1] || /<Code>([^<]{1,80})<\/Code>/.exec(text)?.[1] || '').replace(c.accessKeyId, '***');
  // Backblaze B2 refuses S3 CORS while the bucket has rules set in its web console ("B2 Native"
  // rules): those are replaced through B2's own API instead.
  if (/backblazeb2\.com$/.test(new URL(c.endpoint).host) && /B2 Native/i.test(message)) return setB2NativeCors(c, origins);
  return { ok: false, status: r.status, message };
}

// B2 Native API: authorize with the same key, find the bucket, replace its CORS rules.
async function setB2NativeCors(c, origins) {
  const fail = async (res, step) => {
    const body = await res.json().catch(() => ({}));
    return { ok: false, status: res.status, message: `${step}: ${String(body.message || body.code || res.statusText || '').replace(c.accessKeyId, '***').slice(0, 200)}` };
  };
  const auth = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', { headers: { Authorization: 'Basic ' + Buffer.from(`${c.accessKeyId}:${c.secretAccessKey}`).toString('base64') } });
  if (!auth.ok) return fail(auth, 'authorize');
  const a = await auth.json();
  const apiUrl = a.apiInfo?.storageApi?.apiUrl || a.apiUrl;
  const call = (name, body) => fetch(`${apiUrl}/b2api/v3/${name}`, { method: 'POST', headers: { Authorization: a.authorizationToken, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const list = await call('b2_list_buckets', { accountId: a.accountId, bucketName: c.bucket });
  if (!list.ok) return fail(list, 'list_buckets');
  const bucket = ((await list.json()).buckets || []).find(b => b.bucketName === c.bucket);
  if (!bucket) return { ok: false, status: 404, message: 'bucket not found' };
  const up = await call('b2_update_bucket', { accountId: a.accountId, bucketId: bucket.bucketId, corsRules: [{
    corsRuleName: 'yannzUpload', allowedOrigins: origins, allowedHeaders: ['*'], exposeHeaders: ['ETag'], maxAgeSeconds: 3600,
    allowedOperations: ['s3_put', 's3_get', 's3_head', 'b2_download_file_by_name', 'b2_download_file_by_id']
  }] });
  if (!up.ok) return fail(up, 'update_bucket');
  return { ok: true, status: up.status, native: true };
}

module.exports = { isConfigured, presignPut, head, remove, fileUrl, info, setCors, PRESIGN_SECONDS };
