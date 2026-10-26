'use strict';
// Helper untuk command buatan sendiri yang memakai APIZ2Z: panggil endpoint dengan cadangan
// (endpoint APIZ2Z lain) dan kirim hasilnya (media/teks) seperti command APIZ2Z otomatis.
const { render } = require('../library/apiz2z-render');

// Error level akun/key: endpoint cadangan pasti gagal juga, jadi tidak dicoba.
const ACCOUNT_ERRORS = new Set([
  'NEEDS_API_KEY', 'AUTH_REQUIRED', 'INVALID_API_KEY', 'API_KEY_DISABLED', 'API_KEY_REVOKED', 'API_KEY_EXPIRED',
  'ACCOUNT_RESTRICTED', 'QUOTA_EXCEEDED', 'RATE_LIMITED', 'TOO_MANY_INVALID_KEYS', 'FILE_TOO_LARGE'
]);

// attempts: [[path, params, file?], ...] dicoba berurutan; yang pertama berhasil dipakai.
async function callFirst(ctx, attempts) {
  let last;
  for (const [path, params = {}, file = null] of attempts) {
    try { return { path, result: file ? await ctx.api.post(path, params, file) : await ctx.api.get(path, params) }; }
    catch (e) {
      last = e;
      if (ACCOUNT_ERRORS.has(e.code)) throw e;
      ctx.logger.warn('APIZ2Z gagal, coba endpoint cadangan', { path, code: e.code });
    }
  }
  throw last;
}

// Kirim hasil APIZ2Z: semua media yang ditemukan, lalu teks (kalau tidak muat di caption).
async function sendResult(ctx, result, { title = '', category = '', caption = null } = {}) {
  const r = render(result, { category, title });
  const text = caption ?? r.text;
  let sent = false;
  for (const f of r.files) {
    try { await ctx.sendFile(f.buffer ? { buffer: f.buffer, mime: f.mime } : f.url, { caption: text ? text.slice(0, 1000) : '' }); sent = true; }
    catch (e) { ctx.logger.warn('kirim media APIZ2Z gagal', { title, code: e.code }); }
  }
  if (!sent && text) await ctx.reply(text);
  else if (sent && text && text.length > 1000) await ctx.reply(text);
  else if (!sent && !text) await ctx.reply('Respons kosong dari server API.');
  return sent;
}

// Isi utama respons (membuka bungkus { status, data } / { result }).
const dataOf = result => {
  const d = result?.data ?? result;
  return d && typeof d === 'object' && !Array.isArray(d) && (d.data !== undefined || d.result !== undefined) ? (d.data ?? d.result) : d;
};

module.exports = { ACCOUNT_ERRORS, callFirst, sendResult, dataOf };
