'use strict';
const crypto = require('crypto');

let warned = false;
function rootSecret() {
  const s = process.env.AUTH_SECRET || process.env.APP_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw Object.assign(new Error('AUTH_SECRET belum diisi (minimal 32 karakter).'), { code: 'AUTH_NOT_CONFIGURED' });
  if (!warned) { warned = true; console.warn('AUTH_SECRET kosong: memakai secret development. Isi AUTH_SECRET di produksi!'); }
  return 'dev-only-insecure-secret-api-zero';
}
const keyFor = label => crypto.createHash('sha256').update(label + '|' + rootSecret()).digest();
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const hmac = (label, s) => crypto.createHmac('sha256', keyFor(label)).update(s).digest('base64url');

function seal(label, text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keyFor(label), iv);
  const body = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
}
function unseal(label, token) {
  try {
    const raw = Buffer.from(String(token), 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', keyFor(label), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch { return null; }
}

// Password: scrypt + salt.
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}
function verifyPassword(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  const want = Buffer.from(hash, 'base64url');
  const got = crypto.scryptSync(String(pw), Buffer.from(salt, 'base64url'), want.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(want, got);
}
const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const randomToken = (n = 24) => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const b = crypto.randomBytes(n);
  return [...b].map(x => abc[x % abc.length]).join('');
};

module.exports = { seal, unseal, sha256, hmac, hashPassword, verifyPassword, safeEqual, randomToken, rootSecret };
