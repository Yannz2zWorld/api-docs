'use strict';
// Pengaturan situs di tabel settings (profil web, maintenance, metode pembayaran), cache singkat per instance.
const db = require('./db');

const DEFAULT_SITE = {
  name: process.env.SITE_NAME || 'API Zero',
  tagline: 'REST API gratis & premium, tinggal panggil!',
  description: 'REST API gratis dan premium: downloader, AI, maker, tools, search, dan ratusan fitur lain.',
  creator: process.env.SITE_NAME || 'API Zero',   // field "creator" di setiap respons API
  logoText: '0',
  logo: null,       // data URL gambar (opsional)
  favicon: null,    // data URL gambar (opsional)
  color: '#ffd84d', // warna utama (header, tombol)
  accent: '#ff8fb8',
  announcement: '',
  footer: '',
  links: { whatsapp: '', telegram: '', instagram: '', github: '', channel: '', email: '' },
  v: 0
};
const DEFAULTS = {
  site: DEFAULT_SITE,
  maintenance: { on: false, message: 'Server lagi maintenance sebentar ya. Endpoint akan kembali normal secepatnya.' },
  payments: []
};
const normalize = (key, value) => key === 'site' ? { ...DEFAULT_SITE, ...(value || {}), links: { ...DEFAULT_SITE.links, ...(value?.links || {}) } } : value;

const cache = new Map();
const TTL = 10000;

async function get(key) {
  const c = cache.get(key);
  if (c && Date.now() - c.at < TTL) return c.value;
  const row = await db.one('SELECT value FROM settings WHERE key = $1', [key]);
  const value = normalize(key, row ? row.value : DEFAULTS[key]);
  cache.set(key, { at: Date.now(), value });
  return value;
}
async function set(key, value) {
  value = normalize(key, value);
  await db.q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, JSON.stringify(value)]);
  cache.set(key, { at: Date.now(), value });
  return value;
}
// Nilai terakhir yang diketahui tanpa menunggu database (untuk kode sinkron).
const peek = key => cache.get(key)?.value ?? normalize(key, DEFAULTS[key]);
// Bentuk publik profil situs (tanpa data gambar mentah).
function publicSite(s) {
  const { logo, favicon, ...rest } = s;
  return { ...rest, logoUrl: logo ? `/site/logo?v=${s.v}` : null, faviconUrl: `/site/favicon?v=${s.v}` };
}
module.exports = { get, set, peek, publicSite, DEFAULT_SITE };
