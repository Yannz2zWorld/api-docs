'use strict';
// Error HTTP dengan kode stabil (untuk klien/test) dan pesan aman untuk ditampilkan.

class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const badRequest = (code, msg, extra) => new HttpError(400, code, msg, extra);
const unauthorized = (code = 'AUTH_REQUIRED', msg = 'Login dulu.') => new HttpError(401, code, msg);
const forbidden = (code = 'FORBIDDEN', msg = 'Kamu tidak punya izin untuk aksi ini.') => new HttpError(403, code, msg);
const notFound = (code = 'NOT_FOUND', msg = 'Data tidak ditemukan.') => new HttpError(404, code, msg);
const conflict = (code, msg, extra) => new HttpError(409, code, msg, extra);
const tooMany = (code = 'RATE_LIMITED', msg = 'Terlalu banyak percobaan. Coba lagi nanti.', extra) => new HttpError(429, code, msg, extra);

// Pelanggaran unique constraint -> 409 dengan pesan yang jelas.
const UNIQUE_MESSAGES = {
  accounts_username_uq: ['USERNAME_TAKEN', 'Username sudah dipakai.'],
  accounts_email_uq: ['EMAIL_TAKEN', 'Email sudah terdaftar.'],
  accounts_phone_uq: ['PHONE_TAKEN', 'Nomor sudah terdaftar di akun lain.'],
  accounts_google_uq: ['GOOGLE_TAKEN', 'Akun Google ini sudah tertaut.'],
  bots_phone_uq: ['NUMBER_TAKEN', 'Nomor bot sudah terdaftar.']
};
function fromDatabase(e) {
  if (e?.code === '23505' && UNIQUE_MESSAGES[e.constraint]) return conflict(...UNIQUE_MESSAGES[e.constraint]);
  if (e?.code === '23503') return conflict('REFERENCE_CONFLICT', 'Data masih dipakai oleh data lain.');
  if (e?.code === '23514') return badRequest('INVALID_INPUT', 'Data tidak lolos validasi.');
  return null;
}

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, tooMany, fromDatabase };
