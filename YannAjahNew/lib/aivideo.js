'use strict';
// Generator video dari teks (V15: sora/veo3/ailabs). Provider gratis pihak ketiga t2v.aritek.app.
// STATUS: IMPLEMENTED — NOT TESTED (endpoint reverse-engineered, bisa berubah/mati). Tanpa key.
// Semua request lewat library/net (anti-SSRF, batas ukuran). Host dibatasi ke t2v.aritek.app.
const crypto = require('crypto');
const { request } = require('../library/net');
const { err } = require('../library/errors');

const HOST = 't2v.aritek.app';
const SIGN = '68d6165b72a7f2d8d17b0dc6fe9691abdf77c583';
const VERSION_CODE = 85;
const HEADERS = dev => ({ 'User-Agent': 'okhttp/4.12.0', versionCode: String(VERSION_CODE), 'Ctry-Target': 'others', 'Device-Id': dev, Sign: SIGN });

async function generate(prompt, { aspectRatio = '16:9', aiSound = 1, maxBytes = 64 * 1024 * 1024 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const dev = 'yan_' + crypto.randomBytes(8).toString('hex');
    try {
      const u = await request(`https://${HOST}/api/v1/user/info`, { headers: HEADERS(dev), allowHosts: [HOST], timeoutMs: 30000 });
      const token = JSON.parse(u.body.toString('utf8'))?.data?.token;
      if (!token) throw err('AIVIDEO_NO_TOKEN', 'token kosong');
      const body = JSON.stringify({ prompt: String(prompt).trim(), versionCode: VERSION_CODE, deviceID: dev, isPremium: 1, ctry_target: 'others', used: [], aspect_ratio: aspectRatio, ai_sound: aiSound ? 1 : 0 });
      const g = await request(`https://${HOST}/api/v3/video/t2v`, { method: 'POST', headers: { ...HEADERS(dev), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body, allowHosts: [HOST], timeoutMs: 120000 });
      const videoUrl = JSON.parse(g.body.toString('utf8'))?.data?.url;
      if (!videoUrl) throw err('AIVIDEO_NO_URL', 'url kosong');
      const v = await request(videoUrl, { publicOnly: true, maxBytes, timeoutMs: 120000 });
      if (v.status >= 400) throw err('AIVIDEO_DL', `HTTP ${v.status}`);
      return { url: videoUrl, buffer: v.body };
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 2000)); }
  }
  throw err('AIVIDEO_FAILED', lastErr?.message || 'gagal', { userMessage: 'Gagal membuat video AI, coba lagi nanti.' });
}

module.exports = { generate, HOST };
