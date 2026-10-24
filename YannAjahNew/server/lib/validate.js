'use strict';
// Validasi input server-side. Semua input dashboard/bot API lewat sini sebelum menyentuh database.

const { badRequest } = require('./errors');

const RANKS = ['RESELLER', 'SUKI', 'RAJA', 'DEWA', 'DEVELOPER'];
const ACCOUNT_STATUSES = ['active', 'disabled', 'suspended', 'banned'];

function normalizePhone(input, defaultCountry = '62') {
  let s = String(input ?? '').replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(s)) return null;
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);
  else if (s.startsWith('0')) s = defaultCountry + s.slice(1);
  return /^[1-9]\d{7,14}$/.test(s) ? s : null;
}

const str = (v, { field, min = 0, max = 200, pattern, optional = false, trim = true } = {}) => {
  if (v === undefined || v === null || v === '') {
    if (optional) return null;
    if (min === 0) return '';
    throw badRequest('INVALID_INPUT', `${field} wajib diisi.`, { field });
  }
  if (typeof v !== 'string') throw badRequest('INVALID_INPUT', `${field} harus teks.`, { field });
  const s = trim ? v.trim() : v;
  if (s.length < min || s.length > max) throw badRequest('INVALID_INPUT', `${field} harus ${min}-${max} karakter.`, { field });
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s)) throw badRequest('INVALID_INPUT', `${field} berisi karakter tidak valid.`, { field });
  if (pattern && !pattern.test(s)) throw badRequest('INVALID_INPUT', `${field} formatnya tidak valid.`, { field });
  return s;
};

const username = v => str(String(v ?? '').toLowerCase(), { field: 'username', min: 3, max: 32, pattern: /^[a-z0-9][a-z0-9._-]{2,31}$/ });
const displayName = v => str(v, { field: 'display_name', max: 80 });
const email = (v, { optional = true } = {}) => {
  const s = str(v == null ? v : String(v).toLowerCase(), { field: 'email', max: 254, optional, pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ });
  return s || null;
};
const reason = v => str(v, { field: 'reason', min: 3, max: 500 });
const optionalReason = v => str(v, { field: 'reason', max: 500, optional: true });
const botName = v => str(v, { field: 'bot_name', min: 1, max: 60 });
const message = v => str(v, { field: 'message', min: 1, max: 500 });

function phone(v, { field = 'phone_number', optional = false } = {}) {
  if ((v === undefined || v === null || v === '') && optional) return null;
  const p = normalizePhone(v);
  if (!p) throw badRequest('INVALID_PHONE', 'Nomor telepon tidak valid. Pakai format internasional, contoh 6281234567890.', { field });
  return p;
}

function rank(v) {
  const r = String(v ?? '').toUpperCase();
  if (!RANKS.includes(r)) throw badRequest('INVALID_RANK', `Rank harus salah satu dari ${RANKS.join(', ')}.`);
  return r;
}

function restrictiveStatus(v) {
  const s = String(v ?? '');
  if (!['disabled', 'suspended', 'banned'].includes(s)) throw badRequest('INVALID_STATUS', 'Status harus disabled, suspended, atau banned.');
  return s;
}

// Password bot & akun website: minimal 10 karakter, maks 128 (batas bcrypt 72 byte dicek juga), huruf + angka.
function passwordRule(v, label) {
  if (typeof v !== 'string') throw badRequest('INVALID_PASSWORD', `${label} wajib diisi.`);
  if (v.length < 10 || v.length > 128) throw badRequest('WEAK_PASSWORD', `${label} harus 10-128 karakter.`);
  if (Buffer.byteLength(v) > 72) throw badRequest('WEAK_PASSWORD', `${label} maksimal 72 byte.`);
  if (!/[a-zA-Z]/.test(v) || !/\d/.test(v)) throw badRequest('WEAK_PASSWORD', `${label} harus berisi huruf dan angka.`);
  return v;
}
const botPassword = v => passwordRule(v, 'Password bot');
const accountPassword = v => passwordRule(v, 'Password');

function id(v, field = 'id') {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) throw badRequest('INVALID_ID', `${field} tidak valid.`);
  return n;
}

function bool(v, field) {
  if (typeof v !== 'boolean') throw badRequest('INVALID_INPUT', `${field} harus true/false.`);
  return v;
}

function pageParams(q) {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 50, 1), 200);
  const before = q.before ? id(q.before, 'before') : null;
  return { limit, before };
}

module.exports = { RANKS, ACCOUNT_STATUSES, normalizePhone, str, username, displayName, email, reason, optionalReason, botName, message, phone, rank, restrictiveStatus, botPassword, accountPassword, id, bool, pageParams };
