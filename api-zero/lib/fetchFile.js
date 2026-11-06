'use strict';
// Download file dari URL yang dikasih pemanggil, khusus host publik https (anti-SSRF).
const dns = require('dns').promises;
const net = require('net');
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function privateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || (v.startsWith('::ffff:') && privateAddress(v.slice(7)));
}
async function publicHost(hostname) {
  if (/^localhost$/i.test(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) return false;
  const addrs = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true }).catch(() => []);
  return addrs.length > 0 && addrs.every(a => !privateAddress(a.address));
}
const err = (code, message) => Object.assign(new Error(message), { code });

async function fetchFile(href) {
  let url;
  try { url = new URL(href); } catch { throw err('INVALID_FILE_URL', 'URL file tidak valid.'); }
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== 'https:' || !(await publicHost(url.hostname))) throw err('INVALID_FILE_URL', 'URL file harus https dan publik.');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url, { redirect: 'manual', signal: ctl.signal });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), url); continue; }
      if (!r.ok) throw err('FILE_FETCH_FAILED', `File tidak bisa diambil (HTTP ${r.status}).`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_FILE_BYTES) throw err('FILE_TOO_LARGE', 'File maksimal 8 MB.');
      const type = (r.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
      return { buf, type, name: (decodeURIComponent(url.pathname.split('/').pop() || '') || 'file').slice(0, 120) };
    } catch (e) {
      if (e.code) throw e;
      throw err('FILE_FETCH_FAILED', 'File tidak bisa diambil dari URL itu.');
    } finally { clearTimeout(timer); }
  }
  throw err('FILE_FETCH_FAILED', 'Kebanyakan redirect.');
}

module.exports = { fetchFile, publicHost, MAX_FILE_BYTES };
