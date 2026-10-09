'use strict';
// Proxy generik untuk server API pihak ketiga yang didaftarkan di config/apiServers.js
// (clutch, dongtube, pitucode, termai, ...). Pola sama seperti lib/theresav.js: tiap endpoint
// dijelaskan oleh sebuah spec, makeEndpoint() mengubahnya jadi route plugin untuk index.js.
// Auth/tier/kuota diurus gateway sebelum run(). Key server HANYA dari env (tidak pernah di repo,
// respons, atau log).
const SERVERS = require('../config/apiServers');
const { readParams, downloadFile, sampleResult, reachResult, MAX_FILE_BYTES, MAX_MEDIA_BYTES, MEDIA_TYPE, UPSTREAM_TIMEOUT_MS } = require('./theresav');
const cdn = require('../services/cdnService');

const fail = (res, status, error, message, extra = {}) => res.status(status).json({ status: false, error, message, ...extra });

// Registry untuk self-test (server bisa menjangkau upstream walau lingkungan build tidak bisa).
const REGISTRY = new Map();
function registry() { return [...REGISTRY.values()]; }

function serverOf(spec) {
  const s = SERVERS[spec.server];
  if (!s) throw new Error(`Unknown API server '${spec.server}' (lihat config/apiServers.js)`);
  return s;
}
function base(server) { return (process.env[server.baseEnv] || server.base).replace(/\/+$/, ''); }
// keyMode 'none': a public server that needs no key (e.g. api-faa.my.id).
const keyless = server => server.keyMode === 'none';
function keyOf(server) { return keyless(server) ? 'none' : process.env[server.keyEnv]; }

// Servers with a per-minute limit on our key (perMinute, e.g. Dongtube: 60). Every call is counted
// here (per running instance). Automatic checks only use half of it, so they never eat the budget
// real callers need; a check that would go over is put off ("deferred") and done later.
const recent = new Map();   // server name -> timestamps of the calls in the last minute
function used(name) {
  const now = Date.now();
  const list = (recent.get(name) || []).filter(t => now - t < 60000);
  recent.set(name, list);
  return list;
}
const count = name => { used(name).push(Date.now()); };
const checkAllowed = (name, server) => !server.perMinute || used(name).length < Math.floor(server.perMinute / 2);

async function callUpstream(server, spec, values, file, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const key = keyOf(server);
  const keyName = server.keyName || 'apikey';
  const headers = { Accept: 'application/json' };
  const query = { ...values, ...(spec.fixed || {}) };
  if (server.perMinute) count(spec.server);
  if (keyless(server) || !key) { /* no key (keyless server, or a keyOptional endpoint while the key isn't set) */ } else if ((server.keyMode || 'query') === 'header') headers[keyName] = key; else query[keyName] = key;
  try {
    let r;
    if (spec.multipart) {
      const form = new FormData();
      for (const [k, v] of Object.entries(query)) form.append(k, v);
      if (file) form.append(spec.file.field, new Blob([file.buf], { type: file.type }), file.name);
      r = await fetch(base(server) + spec.upstream, { method: 'POST', body: form, headers, signal: controller.signal });
    } else {
      r = await fetch(base(server) + spec.upstream + '?' + new URLSearchParams(query), { headers, signal: controller.signal });
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

// spec: { server, name, desc, category, path, upstream, params, multipart, file, fileUrl, sample, fixed, keyOptional }
//   fixed       : { name: value } always sent upstream, not settable by the caller (e.g. safe search on)
//   keyOptional : the upstream also answers without a key (public endpoint): works while the key isn't set
//   file    : { param, field, accept }  -> uploaded file sent as multipart to upstream
//   fileUrl : { param, accept, required } -> uploaded file is stored in our CDN and its public URL
//                                            is passed to upstream as the query param `param`
//                                            (for upstreams that only accept an image URL).
function makeEndpoint(spec) {
  const server = serverOf(spec);
  const q = (spec.params || []).map(p => `${p.name}=`).join('&');
  const uploadParam = spec.file?.param || spec.fileUrl?.param || null;
  const uploadAccept = spec.file?.accept || spec.fileUrl?.accept || 'image/*';
  REGISTRY.set(spec.path, { path: spec.path, name: spec.name, category: spec.category || 'Tools', server: spec.server, backupOnly: Boolean(spec.backupOnly), keyOptional: Boolean(spec.keyOptional), fixed: spec.fixed || null, upstream: spec.upstream, multipart: Boolean(spec.multipart), file: spec.file || null, fileUrl: spec.fileUrl || null, sample: spec.sample || null });
  return {
    name: spec.name,
    desc: spec.desc,
    category: spec.category || 'Tools',
    path: spec.path + (q ? '?' + q : ''),
    // Only a backup for another endpoint (config/endpointGroups.js): not listed on its own.
    backupOnly: Boolean(spec.backupOnly),
    upload: Boolean(spec.file || spec.fileUrl),
    params: (spec.params || []).map(p => (uploadParam && p.name === uploadParam
      ? { name: p.name, required: Boolean(p.required), type: 'file', accept: uploadAccept, placeholder: 'Upload gambar (atau kasih URL)' }
      : { name: p.name, required: Boolean(p.required), placeholder: p.placeholder || (p.options ? p.options.join(' / ') : `Masukkan ${p.name}`), ...(p.default ? { default: p.default } : {}) })),
    async run(req, res) {
      if (!keyOf(server) && !spec.keyOptional) return fail(res, 503, 'UPSTREAM_NOT_CONFIGURED', 'Endpoint ini belum aktif. Kuota nggak dipotong.');
      const skip = new Set();
      if (spec.file) skip.add(spec.file.param);
      if (spec.fileUrl) skip.add(spec.fileUrl.param);
      const filtered = skip.size ? { ...spec, params: (spec.params || []).filter(p => !skip.has(p.name)) } : spec;
      const parsed = readParams(filtered, req.query || {});
      if (parsed.error) return fail(res, 400, ...parsed.error);
      const uploaded = Buffer.isBuffer(req.body) && req.body.length ? req.body : null;

      // Multipart file (sent straight to upstream).
      let file = null;
      if (spec.file) {
        if (uploaded) {
          if (uploaded.length > MAX_FILE_BYTES) return fail(res, 413, 'FILE_TOO_LARGE', 'File maksimal 8 MB.');
          const type = (req.get('content-type') || 'application/octet-stream').split(';')[0].trim();
          file = { buf: uploaded, type, name: 'upload' };
        } else {
          const url = (typeof req.query?.[spec.file.param] === 'string' && req.query[spec.file.param].trim()) || (typeof req.query?.url === 'string' && req.query.url.trim());
          if (url) { try { file = await downloadFile(url); } catch (e) { return fail(res, 400, e.code || 'FILE_FETCH_FAILED', e.message); } }
        }
        const fp = (spec.params || []).find(p => p.name === spec.file.param);
        if (!file && fp?.required) return fail(res, 400, 'PARAM_REQUIRED', `Upload file buat '${spec.file.param}'.`);
      }

      // Uploaded image hosted on our CDN; the public URL is passed to upstream as a query param.
      if (spec.fileUrl) {
        const fu = spec.fileUrl;
        let url = null;
        if (uploaded) {
          try { const saved = await cdn.store({ buffer: uploaded, ownerId: req.apiAuth?.userId || null, ttlHours: 24, imagesOnly: true }); url = cdn.absoluteUrl(req, saved.id); }
          catch (e) {
            if (e.code === 'NOT_IMAGE') return fail(res, 400, 'NOT_IMAGE', 'File-nya harus gambar (png/jpg/webp/gif/bmp).');
            if (e.code === 'FILE_TOO_LARGE') return fail(res, 413, 'FILE_TOO_LARGE', 'Gambar maksimal 4 MB.');
            return fail(res, 503, 'CDN_UNAVAILABLE', 'Penyimpanan gambar belum siap (jalankan migrasi 012 dulu). Kuota nggak dipotong.');
          }
        } else {
          const given = (typeof req.query?.[fu.param] === 'string' && req.query[fu.param].trim()) || (typeof req.query?.url === 'string' && req.query.url.trim()) || '';
          if (given) { let u; try { u = new URL(given); } catch {} if (!u || u.protocol !== 'https:') return fail(res, 400, 'INVALID_PARAMETER', `Parameter '${fu.param}' harus URL https, atau upload gambar.`); url = u.href; }
        }
        if (!url && fu.required !== false) return fail(res, 400, 'PARAM_REQUIRED', `Upload gambar atau isi '${fu.param}' (URL https).`);
        if (url) parsed.values[fu.param] = url;
      }

      const up = await callUpstream(server, spec, parsed.values, file);
      if (up.media) {
        if (!up.media.buf.length) return fail(res, 502, 'UPSTREAM_FAILED', 'Layanan sumbernya ngirim file kosong. Kuota nggak dipotong.');
        if (up.media.buf.length > MAX_MEDIA_BYTES) return fail(res, 502, 'UPSTREAM_TOO_LARGE', 'File hasilnya kegedean buat dikirim. Kuota nggak dipotong.');
        res.set('Cache-Control', 'private, no-store');
        res.set('X-Content-Type-Options', 'nosniff');
        return res.status(200).type(up.media.type).send(up.media.buf);
      }
      const data = up.data && typeof up.data === 'object' ? up.data : null;
      if (!data || up.status >= 400 || data.status === false) {
        if (!up.status) return fail(res, 504, 'UPSTREAM_TIMEOUT', up.timeout ? 'Layanan sumbernya kelamaan jawab. Coba lagi ya. Kuota nggak dipotong.' : 'Layanan sumbernya nggak bisa dihubungi. Coba lagi ya. Kuota nggak dipotong.');
        const message = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : 'Layanan sumbernya lagi bermasalah.';
        const clientError = up.status === 400 || up.status === 422;
        return fail(res, clientError ? 400 : 502, clientError ? 'INVALID_PARAMETER' : 'UPSTREAM_FAILED', clientError ? message : `${message} Kuota nggak dipotong.`, data?.details ? { details: data.details } : {});
      }
      const { creator, ...rest } = data;
      for (const k of server.strip || []) delete rest[k];   // the upstream's own branding
      return res.status(200).json({ ...rest, status: true });
    }
  };
}

// Self-test satu endpoint dengan sample-nya, dijalankan di server.
// Same check as lib/theresav.js probe(): run with the sample input, or without one ask the upstream
// with no input and see whether it answers properly.
async function probe(entry, { timeoutMs = UPSTREAM_TIMEOUT_MS } = {}) {
  const server = SERVERS[entry.server];
  if (!server || (!keyOf(server) && !entry.keyOptional)) return { result: 'not_configured' };
  if (!checkAllowed(entry.server, server)) return { result: 'deferred' };
  const started = Date.now();
  if (!entry.sample) return limited(server, reachResult(await callUpstream(server, entry, {}, null, timeoutMs), started));
  const values = { ...entry.sample };
  let file = null;
  try {
    if (entry.file && values[entry.file.param]) { file = await downloadFile(values[entry.file.param]); delete values[entry.file.param]; }
  } catch (e) {
    return { result: 'error', status: 0, error: 'Sample file nggak bisa diambil: ' + (e.message || e.code), ms: Date.now() - started };
  }
  return limited(server, sampleResult(await callUpstream(server, entry, values, file, timeoutMs), started));
}
// The server's own rate limit answered (429): nothing is wrong with the endpoint, check it later.
const limited = (server, r) => (server.perMinute && r.status === 429 ? { result: 'deferred' } : r);

module.exports = { makeEndpoint, registry, probe, SERVERS, _resetLimits: () => recent.clear() };
