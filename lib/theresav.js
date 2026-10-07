'use strict';
// Proxy helper for endpoints served by api.theresav.eu. The upstream key lives only in the
// THERESAV_API_KEY environment variable (never in the repo, never in responses or logs).
// Each endpoint is described by a spec; makeEndpoint() turns it into a plugin route for
// index.js (auth, tier and quota are handled by the gateway before run()).
const dns = require('dns').promises;
const net = require('net');

const BASE = () => (process.env.THERESAV_BASE_URL || 'https://api.theresav.eu').replace(/\/+$/, '');
const UPSTREAM_TIMEOUT_MS = 55000;
const FILE_TIMEOUT_MS = 20000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
// Media answers (image/video/audio) are passed through; Vercel caps a response at 4.5 MB.
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
const MEDIA_TYPE = /^(image|video|audio)\//i;

const fail = (res, status, error, message, extra = {}) => res.status(status).json({ status: false, error, message, ...extra });

// Every theresav-backed endpoint registers itself here so the developer panel can self-test them
// (the server can reach theresav even when a build/test environment cannot).
const REGISTRY = new Map();
function registry() { return [...REGISTRY.values()]; }


// ---------------------------------------------------------------- parameters
function readParams(spec, query) {
  const out = {};
  for (const p of spec.params || []) {
    let value;
    for (const key of [p.name, ...(p.aliases || [])]) {
      const v = query[key];
      if (typeof v === 'string' && v.trim()) { value = v.trim(); break; }
    }
    if (value === undefined) {
      if (p.default !== undefined) value = p.default;
      else if (p.required) return { error: ['PARAM_REQUIRED', `Parameter '${p.name}' wajib diisi.`] };
      else continue;
    }
    if (value.length > (p.max || 4000)) return { error: ['INVALID_PARAMETER', `Parameter '${p.name}' maksimal ${p.max || 4000} karakter.`] };
    if (p.type === 'bool') {
      if (!/^(true|false|1|0|yes|no)$/i.test(value)) return { error: ['INVALID_PARAMETER', `Parameter '${p.name}' harus true atau false.`] };
      value = /^(true|1|yes)$/i.test(value) ? 'true' : 'false';
    }
    if (p.options) {
      const hit = p.options.find(o => o.toLowerCase() === value.toLowerCase());
      if (!hit) return { error: ['INVALID_PARAMETER', `Parameter '${p.name}' harus salah satu dari: ${p.options.join(', ')}.`, { options: p.options }] };
      value = hit;
    }
    if (p.type === 'url') {
      let u;
      try { u = new URL(value); } catch {}
      if (!u || u.protocol !== 'https:') return { error: ['INVALID_PARAMETER', `Parameter '${p.name}' harus URL https.`] };
      value = u.href;
    }
    out[p.upstream || p.name] = value;
  }
  return { values: out };
}

// ---------------------------------------------------------------- downloading a file given by URL
// Only public https hosts: private, loopback and link-local addresses are refused at every hop.
function privateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:') && privateAddress(v.slice(7));
}
async function publicHost(hostname) {
  if (/^localhost$/i.test(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) return false;
  const addrs = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true }).catch(() => []);
  return addrs.length > 0 && addrs.every(a => !privateAddress(a.address));
}
async function downloadFile(href) {
  let url = new URL(href);
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== 'https:' || !(await publicHost(url.hostname))) throw Object.assign(new Error('URL file tidak diizinkan.'), { code: 'INVALID_FILE_URL' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FILE_TIMEOUT_MS);
    try {
      const r = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (YannzAPI)' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), url); continue; }
      if (!r.ok) throw Object.assign(new Error(`File tidak bisa diambil (HTTP ${r.status}).`), { code: 'FILE_FETCH_FAILED' });
      if (Number(r.headers.get('content-length') || 0) > MAX_FILE_BYTES) throw Object.assign(new Error('File maksimal 8 MB.'), { code: 'FILE_TOO_LARGE' });
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_FILE_BYTES) throw Object.assign(new Error('File maksimal 8 MB.'), { code: 'FILE_TOO_LARGE' });
      const type = (r.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
      const name = decodeURIComponent(url.pathname.split('/').pop() || '') || 'file';
      return { buf, type, name: name.slice(0, 120) };
    } catch (e) {
      if (e.code) throw e;
      throw Object.assign(new Error('File tidak bisa diambil dari URL itu.'), { code: 'FILE_FETCH_FAILED' });
    } finally {
      clearTimeout(timer);
    }
  }
  throw Object.assign(new Error('Terlalu banyak redirect.'), { code: 'FILE_FETCH_FAILED' });
}

// ---------------------------------------------------------------- calling the upstream
async function callUpstream(spec, values, file) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const headers = { 'x-apikey': process.env.THERESAV_API_KEY, Accept: 'application/json' };
  try {
    let r;
    if (spec.multipart) {
      const form = new FormData();
      for (const [k, v] of Object.entries(values)) form.append(k, v);
      if (file) form.append(spec.file.field, new Blob([file.buf], { type: file.type }), file.name);
      r = await fetch(BASE() + spec.upstream, { method: 'POST', body: form, headers, signal: controller.signal });
    } else {
      r = await fetch(BASE() + spec.upstream + '?' + new URLSearchParams(values), { headers, signal: controller.signal });
    }
    const type = (r.headers.get('content-type') || '').split(';')[0].trim();
    if (r.ok && MEDIA_TYPE.test(type)) return { status: r.status, media: { type, buf: Buffer.from(await r.arrayBuffer()) } };
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { status: r.status, data };
  } catch (e) {
    return { status: 0, data: null, timeout: e.name === 'AbortError' };
  } finally {
    clearTimeout(timer);
  }
}

function makeEndpoint(spec) {
  const query = (spec.params || []).map(p => `${p.name}=`).join('&');
  REGISTRY.set(spec.path, { path: spec.path, name: spec.name, category: spec.category || 'AI', upstream: spec.upstream, multipart: Boolean(spec.multipart), file: spec.file || null, sample: spec.sample || null });
  return {
    name: spec.name,
    desc: spec.desc,
    category: spec.category || 'AI',
    path: spec.path + (query ? '?' + query : ''),
    params: (spec.params || []).map(p => ({ name: p.name, required: Boolean(p.required), placeholder: p.placeholder || (p.options ? p.options.join(' / ') : `Masukkan ${p.name}`), ...(p.default ? { default: p.default } : {}) })),
    async run(req, res) {
      if (!process.env.THERESAV_API_KEY) return fail(res, 503, 'UPSTREAM_NOT_CONFIGURED', 'Endpoint ini belum aktif (THERESAV_API_KEY belum diatur). Kuota tidak dipotong.');
      const parsed = readParams(spec, req.query || {});
      if (parsed.error) return fail(res, 400, ...parsed.error);
      let file = null;
      if (spec.file && parsed.values[spec.file.param]) {
        try { file = await downloadFile(parsed.values[spec.file.param]); }
        catch (e) { return fail(res, 400, e.code || 'FILE_FETCH_FAILED', e.message); }
        delete parsed.values[spec.file.param];
      }
      const up = await callUpstream(spec, parsed.values, file);
      if (up.media) {
        if (!up.media.buf.length) return fail(res, 502, 'UPSTREAM_FAILED', 'Layanan sumber mengirim file kosong. Kuota tidak dipotong.');
        if (up.media.buf.length > MAX_MEDIA_BYTES) return fail(res, 502, 'UPSTREAM_TOO_LARGE', 'File hasil terlalu besar untuk dikirim. Kuota tidak dipotong.');
        res.set('Cache-Control', 'private, no-store');
        res.set('X-Content-Type-Options', 'nosniff');
        return res.status(200).type(up.media.type).send(up.media.buf);
      }
      const data = up.data && typeof up.data === 'object' ? up.data : null;
      if (!data || up.status >= 400 || data.status === false) {
        if (!up.status) return fail(res, 504, 'UPSTREAM_TIMEOUT', up.timeout ? 'Layanan AI terlalu lama menjawab. Coba lagi. Kuota tidak dipotong.' : 'Layanan AI tidak bisa dihubungi. Coba lagi. Kuota tidak dipotong.');
        const message = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : 'Layanan AI sedang bermasalah.';
        const clientError = up.status === 400 || up.status === 422 || data?.error === 'Validation failed';
        return fail(res, clientError ? 400 : 502, clientError ? 'INVALID_PARAMETER' : 'UPSTREAM_FAILED', clientError ? message : `${message} Kuota tidak dipotong.`, data?.details ? { details: data.details } : {});
      }
      const { creator, ...rest } = data;   // our gateway adds its own creator field
      return res.status(200).json({ ...rest, status: true });
    }
  };
}

// Runs one endpoint against the real upstream with its stored sample input, server-side.
// → { result: 'ok'|'error'|'manual'|'not_configured', status, error, ms }
async function probe(entry) {
  if (!process.env.THERESAV_API_KEY) return { result: 'not_configured' };
  if (!entry.sample) return { result: 'manual' };
  const started = Date.now();
  const values = { ...entry.sample };
  let file = null;
  try {
    if (entry.file && values[entry.file.param]) { file = await downloadFile(values[entry.file.param]); delete values[entry.file.param]; }
  } catch (e) {
    return { result: 'error', error: 'Sample file tidak bisa diambil: ' + (e.message || e.code), ms: Date.now() - started };
  }
  const up = await callUpstream(entry, values, file);
  const ms = Date.now() - started;
  if (up.media) return up.media.buf.length ? { result: 'ok', status: up.status, ms } : { result: 'error', status: up.status, error: 'file kosong', ms };
  const data = up.data && typeof up.data === 'object' ? up.data : null;
  if (!up.status) return { result: 'error', status: 0, error: up.timeout ? 'timeout' : 'tidak bisa dihubungi', ms };
  if (!data) return { result: 'error', status: up.status, error: 'respons bukan JSON/media', ms };
  if (up.status >= 400 || data.status === false) return { result: 'error', status: up.status, error: typeof data.error === 'string' ? data.error : typeof data.message === 'string' ? data.message : 'gagal', ms };
  return { result: 'ok', status: up.status, ms };
}

module.exports = { makeEndpoint, readParams, privateAddress, registry, probe };
