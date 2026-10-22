'use strict';
// HTTP client aman untuk bot:
// - hanya http/https, redirect diikuti manual (maks 3) dan setiap lompatan divalidasi ulang
// - mode allowlist (API manager): hanya host yang diizinkan
// - mode publik (unduh media dari hasil API): IP privat/loopback/link-local ditolak (anti-SSRF),
//   dicek pada IP hasil DNS yang benar-benar dipakai untuk koneksi (anti DNS-rebinding)
// - batas ukuran respons dan timeout

const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const { err } = require('./errors');

function isPrivateIp(ip) {
  if (!net.isIP(ip)) return true;
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
}

function guardedLookup(hostname, options, cb) {
  dns.lookup(hostname, { ...options, all: true }, (e, addrs) => {
    if (e) return cb(e);
    const list = Array.isArray(addrs) ? addrs : [{ address: addrs, family: options.family || 4 }];
    const bad = list.find(a => isPrivateIp(a.address));
    if (bad || !list.length) return cb(err('BLOCKED_HOST', 'Alamat tujuan tidak diizinkan (jaringan privat)'));
    if (options.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
}

/**
 * request(url, opts) -> { status, headers, body: Buffer, url }
 * opts: method, headers, body (Buffer|string), timeoutMs, maxBytes, allowHosts (Set|array) | publicOnly (bool)
 */
function request(url, opts = {}, hop = 0) {
  const { method = 'GET', headers = {}, body = null, timeoutMs = 30000, maxBytes = 16 * 1024 * 1024, allowHosts = null, publicOnly = !allowHosts } = opts;
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch { return reject(err('INVALID_URL', 'URL tidak valid')); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return reject(err('INVALID_URL', 'Hanya URL http/https yang diizinkan'));
    if (u.username || u.password) return reject(err('INVALID_URL', 'URL dengan kredensial tidak diizinkan'));
    if (allowHosts) {
      const hosts = allowHosts instanceof Set ? allowHosts : new Set(allowHosts);
      if (!hosts.has(u.hostname.toLowerCase())) return reject(err('HOST_NOT_ALLOWED', `Host ${u.hostname} tidak ada di allowlist`));
    }
    if (publicOnly && net.isIP(u.hostname) && isPrivateIp(u.hostname)) return reject(err('BLOCKED_HOST', 'Alamat tujuan tidak diizinkan (jaringan privat)'));

    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, {
      method,
      headers: { 'User-Agent': 'YannAjahNew/1.0', ...headers, ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) },
      timeout: timeoutMs,
      ...(publicOnly ? { lookup: guardedLookup } : {})
    }, res => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume();
        if (hop >= 3) return reject(err('TOO_MANY_REDIRECTS', 'Terlalu banyak redirect'));
        const next = new URL(res.headers.location, u).href;
        const keepBody = status === 307 || status === 308;
        return resolve(request(next, { ...opts, method: keepBody ? method : 'GET', body: keepBody ? body : null }, hop + 1));
      }
      const declared = Number(res.headers['content-length'] || 0);
      if (declared && declared > maxBytes) { res.destroy(); return reject(err('RESPONSE_TOO_LARGE', `Respons terlalu besar (${declared} bytes)`)); }
      const chunks = []; let size = 0;
      res.on('data', c => {
        size += c.length;
        if (size > maxBytes) { res.destroy(); reject(err('RESPONSE_TOO_LARGE', 'Respons melebihi batas ukuran')); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks), url: u.href }));
      res.on('error', e => reject(err('NETWORK_ERROR', e.message, { cause: e })));
    });
    const timer = setTimeout(() => req.destroy(err('TIMEOUT', 'Request timeout')), timeoutMs + 50);
    req.on('timeout', () => req.destroy(err('TIMEOUT', 'Request timeout')));
    req.on('error', e => { clearTimeout(timer); reject(e.code === 'TIMEOUT' || e.code === 'BLOCKED_HOST' || e.code === 'RESPONSE_TOO_LARGE' ? e : err('NETWORK_ERROR', e.message, { cause: e })); });
    req.on('close', () => clearTimeout(timer));
    if (body) req.write(body);
    req.end();
  });
}

// Unduh file publik (mis. link media dari hasil API) dengan proteksi SSRF dan batas ukuran.
async function download(url, { maxBytes, timeoutMs = 45000 } = {}) {
  const r = await request(url, { publicOnly: true, maxBytes, timeoutMs });
  if (r.status >= 400) throw err('DOWNLOAD_FAILED', `Gagal mengunduh (HTTP ${r.status})`);
  return { buffer: r.body, mime: String(r.headers['content-type'] || '').split(';')[0].trim() || null, url: r.url };
}

module.exports = { request, download, isPrivateIp, guardedLookup };
