'use strict';
// GET JSON/teks dari API publik tanpa key (Jikan, Pastebin raw) lewat library/net (anti-SSRF, batas ukuran).
const { request } = require('../library/net');
const { err } = require('../library/errors');

async function getText(url, { maxBytes = 1024 * 1024, timeoutMs = 20000 } = {}) {
  const r = await request(url, { method: 'GET', headers: { Accept: 'application/json, text/plain, */*', 'User-Agent': 'YannAjahAI/1.0' }, maxBytes, timeoutMs });
  if (r.status === 404) throw err('NOT_FOUND', '404', { userMessage: 'Data tidak ditemukan.' });
  if (r.status < 200 || r.status >= 300) throw err('UPSTREAM_ERROR', `HTTP ${r.status}`, { userMessage: 'Server sumber sedang bermasalah, coba lagi nanti.' });
  return r.body.toString('utf8');
}
const getJson = async (url, opts) => JSON.parse(await getText(url, opts));

module.exports = { getText, getJson };
