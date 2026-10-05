'use strict';
// Password hashing with Node's built-in scrypt (OWASP: N=2^17, r=8, p=1).
// Stored as scrypt$<log2N>$<r>$<p>$<salt b64url>$<hash b64url> so parameters can change later.
const crypto = require('crypto');

const LOG_N = 17;
const R = 8;
const P = 1;
const KEY_LEN = 32;
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

function derive(password, salt, logN, r, p) {
  const N = 2 ** logN;
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password).normalize('NFKC'), salt, KEY_LEN, { N, r, p, maxmem: 256 * N * r }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await derive(password, salt, LOG_N, R, P);
  return ['scrypt', LOG_N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, logN, r, p, salt, expected] = parts;
  const key = await derive(password, Buffer.from(salt, 'base64url'), Number(logN), Number(r), Number(p));
  const want = Buffer.from(expected, 'base64url');
  return want.length === key.length && crypto.timingSafeEqual(want, key);
}

// Same cost as a real check, so "no such account" and "wrong password" take equal time.
let dummyHash;
async function verifyAgainstDummy(password) {
  dummyHash = dummyHash || hashPassword(crypto.randomBytes(12).toString('hex'));
  await verifyPassword(password, await dummyHash);
  return false;
}

function passwordProblem(password) {
  const value = String(password || '');
  if (value.length < MIN_LENGTH) return `Sandi minimal ${MIN_LENGTH} karakter.`;
  if (value.length > MAX_LENGTH) return `Sandi maksimal ${MAX_LENGTH} karakter.`;
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return 'Sandi harus berisi huruf dan angka.';
  return null;
}

module.exports = { hashPassword, verifyPassword, verifyAgainstDummy, passwordProblem, MIN_LENGTH };
