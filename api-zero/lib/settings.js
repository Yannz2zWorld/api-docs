'use strict';
// Pengaturan situs di tabel settings (maintenance, metode pembayaran), cache singkat per instance.
const db = require('./db');
const DEFAULTS = {
  maintenance: { on: false, message: 'Server lagi maintenance sebentar ya. Endpoint akan kembali normal secepatnya! 🛠️' },
  payments: []
};
const cache = new Map();
const TTL = 10000;

async function get(key) {
  const c = cache.get(key);
  if (c && Date.now() - c.at < TTL) return c.value;
  const row = await db.one('SELECT value FROM settings WHERE key = $1', [key]);
  const value = row ? row.value : DEFAULTS[key];
  cache.set(key, { at: Date.now(), value });
  return value;
}
async function set(key, value) {
  await db.q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, JSON.stringify(value)]);
  cache.set(key, { at: Date.now(), value });
  return value;
}
module.exports = { get, set };
