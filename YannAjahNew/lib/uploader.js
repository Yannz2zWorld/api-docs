'use strict';
// Upload media ke host file publik (V15: .tourl / .catbox / .uguu). Link bisa diakses siapa saja,
// jadi jangan dipakai untuk file pribadi. Catbox: permanen; Uguu: sementara (±3 jam).
const { err } = require('../library/errors');

const MAX = 100 * 1024 * 1024;
const extOf = mime => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'application/pdf': 'pdf' }[mime] || (String(mime).split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5));

async function post(url, form, timeoutMs) {
  const r = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'YannAjahAI/1.0' } });
  const text = (await r.text()).trim();
  if (!r.ok) throw err('UPLOAD_FAILED', `HTTP ${r.status}`, { userMessage: 'Upload gagal, coba lagi nanti.' });
  return text;
}

const HOSTS = {
  catbox: {
    label: 'Catbox (permanen)',
    async upload(buf, mime, timeoutMs) {
      const f = new FormData(); f.append('reqtype', 'fileupload'); f.append('fileToUpload', new Blob([buf], { type: mime }), `file.${extOf(mime)}`);
      const t = await post('https://catbox.moe/user/api.php', f, timeoutMs);
      if (!/^https:\/\/files\.catbox\.moe\/\S+$/.test(t)) throw err('UPLOAD_FAILED', 'catbox: respons tidak dikenal', { userMessage: 'Upload ke Catbox gagal.' });
      return t;
    }
  },
  uguu: {
    label: 'Uguu (sementara ±3 jam)',
    async upload(buf, mime, timeoutMs) {
      const f = new FormData(); f.append('files[]', new Blob([buf], { type: mime }), `file.${extOf(mime)}`);
      const j = JSON.parse(await post('https://uguu.se/upload', f, timeoutMs));
      const u = j?.files?.[0]?.url;
      if (!/^https:\/\//.test(u || '')) throw err('UPLOAD_FAILED', 'uguu: respons tidak dikenal', { userMessage: 'Upload ke Uguu gagal.' });
      return u;
    }
  }
};

async function upload(buf, mime, { hosts = ['catbox', 'uguu'], timeoutMs = 60000, logger } = {}) {
  if (buf.length > MAX) throw err('FILE_TOO_LARGE', 'file > 100MB', { userMessage: 'File maksimal 100 MB.' });
  let last;
  for (const h of hosts) {
    try { return { url: await HOSTS[h].upload(buf, mime, timeoutMs), host: HOSTS[h].label }; }
    catch (e) { last = e; logger?.warn?.('upload gagal, coba host lain', { host: h, code: e.code || e.name }); }
  }
  throw last?.userMessage ? last : err('UPLOAD_FAILED', last?.message || 'upload', { userMessage: 'Upload gagal, coba lagi nanti.' });
}

module.exports = { upload, HOSTS };
