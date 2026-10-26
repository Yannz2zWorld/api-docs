'use strict';
// Klien untuk API SELAIN APIZ2Z yang dipakai fitur Lena AI v15 (BotcahX, Termai, siputzx, nexray, taka, faa,
// nekorinn, dll.). APIZ2Z tetap jadi API utama (library/apiz2z.js); helper ini hanya untuk fitur yang memang
// butuh endpoint lain — sesuai aturan "jangan hapus fitur, catat dependency-nya" (lihat DAFTAR-API.txt).
// Semua request lewat library/net (anti-SSRF, batas ukuran, timeout). Host dibatasi allowlist dari config.extapi.
const { request } = require('../library/net');
const { err } = require('../library/errors');

// Host yang boleh dihubungi helper ini (semua API publik v15 yang tidak butuh key + host berkey dari config).
const BASE_HOSTS = [
  'api.siputzx.my.id', 'api.nexray.eu.cc', 'api.nexray.web.id', 'api.taka.my.id', 'api-faa.my.id',
  'api.nekorinn.my.id', 'api.botcahx.eu.org', 'api.termai.cc', 'api.clutch.web.id', 'api-diezy.clutch.ai.id',
  'api.theresav.eu', 'api.dongtube.id', 'api.vreden.my.id', 'api.ownblox.biz.id', 'api.memegen.link',
  'data.bmkg.go.id', 'api.bmkg.go.id', 'cdn.jsdelivr.net', 'raw.githubusercontent.com', 'api.github.com',
  'qu.ax', 'uguu.se', 'top4top.io', 'www.webtonative.com', 'games.roblox.com'
];

function hostsFrom(config) {
  const set = new Set(BASE_HOSTS);
  const ex = config?.extapi || {};
  for (const svc of [ex.alip, ex.botcahx, ex.termai, ex.dongtube, ex.theresav]) {
    try { if (svc?.url) set.add(new URL(svc.url).hostname.toLowerCase()); } catch { /* abaikan */ }
  }
  for (const u of [ex.siputzx, ex.nexray, ex.taka, ex.faa, ex.nekorinn]) {
    try { if (u) set.add(new URL(u).hostname.toLowerCase()); } catch { /* abaikan */ }
  }
  return set;
}

// GET teks/JSON/buffer dari host yang diizinkan.
async function get(ctx, url, { as = 'json', timeoutMs = 60000, maxBytes = 32 * 1024 * 1024, headers = {} } = {}) {
  const r = await request(url, { method: 'GET', headers: { Accept: '*/*', ...headers }, allowHosts: hostsFrom(ctx.config), timeoutMs, maxBytes });
  if (r.status === 404) throw err('NOT_FOUND', '404', { userMessage: 'Data tidak ditemukan.' });
  if (r.status < 200 || r.status >= 300) throw err('UPSTREAM_ERROR', `HTTP ${r.status}`, { userMessage: 'Server sumber sedang bermasalah, coba lagi nanti.' });
  if (as === 'buffer') return { buffer: r.body, mime: String(r.headers['content-type'] || '').split(';')[0].trim() };
  const text = r.body.toString('utf8');
  if (as === 'text') return text;
  try { return JSON.parse(text); } catch { throw err('BAD_RESPONSE', 'bukan JSON', { userMessage: 'Respons server sumber tidak dikenal.' }); }
}

// Apakah service berkey sudah dikonfigurasi (untuk menandai fitur needs API key tanpa menghapusnya).
function hasKey(config, service) { return Boolean(config?.extapi?.[service]?.key); }

module.exports = { get, hostsFrom, hasKey, BASE_HOSTS };
