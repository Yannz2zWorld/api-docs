// NGL: kirim satu pesan anonim ke akun ngl.link (seperti mengetik di halaman ngl.link/<username>).
// Satu request = satu pesan; tidak ada pengulangan otomatis. Tiap kirim memakai 1 kuota, dan ada
// jeda singkat per akun supaya fitur ini tidak dipakai untuk membanjiri inbox orang.
const crypto = require('crypto');

const NGL_SUBMIT = 'https://ngl.link/api/submit';
const COOLDOWN_MS = 15 * 1000;
const lastSend = new Map();   // userId -> timestamp (per instance, best effort)

const fail = (res, status, error, message, extra = {}) => res.status(status).json({ status: false, error, message, ...extra });

function usernameOf(input) {
  let v = typeof input === 'string' ? input.trim() : '';
  const m = v.match(/^(?:https?:\/\/)?(?:www\.)?ngl\.link\/([^/?#\s]+)/i);
  if (m) v = m[1];
  v = v.replace(/^@/, '');
  return /^[A-Za-z0-9._-]{1,30}$/.test(v) ? v : null;
}

module.exports = {
  name: 'NGL Send',
  desc: 'Kirim satu pesan anonim ke akun NGL (username atau link ngl.link).',
  category: 'Tools',
  path: '/api/tools/ngl?username=&message=',
  minimumTier: 'SULTAN',
  params: [
    { name: 'username', required: true, placeholder: 'username atau https://ngl.link/username' },
    { name: 'message', required: true, placeholder: 'Pesan anonim (maks 300 karakter)' }
  ],
  async run(req, res) {
    const username = usernameOf(req.query.username || req.query.link || req.query.url);
    if (!username) return fail(res, 400, 'INVALID_PARAMETER', "Parameter 'username' harus username NGL atau link https://ngl.link/username.");
    const message = typeof req.query.message === 'string' ? req.query.message.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim() : '';
    if (!message) return fail(res, 400, 'PARAM_REQUIRED', "Parameter 'message' wajib diisi.");
    if (message.length > 300) return fail(res, 400, 'INVALID_PARAMETER', 'Pesan maksimal 300 karakter.');

    const who = req.apiAuth?.userId || req.ip;
    const owner = req.apiAuth?.tier === 'OWNER';
    const wait = (lastSend.get(who) || 0) + COOLDOWN_MS - Date.now();
    if (wait > 0 && !owner) {
      res.set('Retry-After', String(Math.ceil(wait / 1000)));
      return fail(res, 429, 'COOLDOWN', `Tunggu ${Math.ceil(wait / 1000)} detik sebelum mengirim lagi. Kuota tidak dipotong.`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let r;
    try {
      r = await fetch(NGL_SUBMIT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Accept: '*/*',
          Origin: 'https://ngl.link',
          Referer: `https://ngl.link/${username}`,
          'User-Agent': 'Mozilla/5.0 (YannzAPI)'
        },
        body: new URLSearchParams({ username, question: message, deviceId: crypto.randomUUID(), gameSlug: '', referrer: '' }).toString()
      });
    } catch (e) {
      return fail(res, 504, 'UPSTREAM_TIMEOUT', 'NGL tidak bisa dihubungi. Coba lagi. Kuota tidak dipotong.');
    } finally {
      clearTimeout(timer);
    }

    if (r.status === 404) return fail(res, 400, 'USER_NOT_FOUND', `Akun NGL '${username}' tidak ditemukan.`);
    if (r.status === 429) return fail(res, 429, 'RATE_LIMITED', 'NGL sedang membatasi pengiriman. Coba lagi nanti. Kuota tidak dipotong.');
    if (!r.ok) return fail(res, 502, 'UPSTREAM_FAILED', `NGL menolak pesan (HTTP ${r.status}). Kuota tidak dipotong.`);

    lastSend.set(who, Date.now());
    if (lastSend.size > 5000) lastSend.clear();
    return res.json({ status: true, result: { sent: true, username, link: `https://ngl.link/${username}`, message } });
  }
};
