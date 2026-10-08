'use strict';
// Proxy generik untuk server API pihak ketiga yang didaftarkan di config/apiServers.js
// (clutch, dongtube, pitucode, termai, ...). Pola sama seperti lib/theresav.js: tiap endpoint
// dijelaskan oleh sebuah spec, makeEndpoint() mengubahnya jadi route plugin untuk index.js.
// Auth/tier/kuota diurus gateway sebelum run(). Key server HANYA dari env (tidak pernah di repo,
// respons, atau log).
const SERVERS = require('../config/apiServers');
const { readParams, downloadFile, MAX_FILE_BYTES, MAX_MEDIA_BYTES, MEDIA_TYPE, UPSTREAM_TIMEOUT_MS } = require('./theresav');

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
function keyOf(server) { return process.env[server.keyEnv]; }

async function callUpstream(server, spec, values, file) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const key = keyOf(server);
  const keyName = server.keyName || 'apikey';
  const headers = { Accept: 'application/json' };
  const query = { ...values };
  if ((server.keyMode || 'query') === 'header') headers[keyName] = key; else query[keyName] = key;
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

// spec: { server, name, desc, category, path, upstream, params, multipart, file, sample }
function makeEndpoint(spec) {
  const server = serverOf(spec);
  const q = (spec.params || []).map(p => `${p.name}=`).join('&');
  REGISTRY.set(spec.path, { path: spec.path, name: spec.name, category: spec.category || 'Tools', server: spec.server, upstream: spec.upstream, multipart: Boolean(spec.multipart), file: spec.file || null, sample: spec.sample || null });
  return {
    name: spec.name,
    desc: spec.desc,
    category: spec.category || 'Tools',
    path: spec.path + (q ? '?' + q : ''),
    upload: Boolean(spec.file),
    params: (spec.params || []).map(p => (spec.file && p.name === spec.file.param
      ? { name: p.name, required: Boolean(p.required), type: 'file', accept: spec.file.accept || 'image/*', placeholder: 'Pilih file untuk diunggah' }
      : { name: p.name, required: Boolean(p.required), placeholder: p.placeholder || (p.options ? p.options.join(' / ') : `Masukkan ${p.name}`), ...(p.default ? { default: p.default } : {}) })),
    async run(req, res) {
      if (!keyOf(server)) return fail(res, 503, 'UPSTREAM_NOT_CONFIGURED', `Endpoint ini belum aktif (${server.keyEnv} belum diatur). Kuota tidak dipotong.`);
      const fileSpec = spec.file || null;
      const nonFile = fileSpec ? { ...spec, params: (spec.params || []).filter(p => p.name !== fileSpec.param) } : spec;
      const parsed = readParams(nonFile, req.query || {});
      if (parsed.error) return fail(res, 400, ...parsed.error);
      let file = null;
      if (fileSpec) {
        const uploaded = Buffer.isBuffer(req.body) && req.body.length ? req.body : null;
        if (uploaded) {
          if (uploaded.length > MAX_FILE_BYTES) return fail(res, 413, 'FILE_TOO_LARGE', 'File maksimal 8 MB.');
          const type = (req.get('content-type') || 'application/octet-stream').split(';')[0].trim();
          file = { buf: uploaded, type, name: 'upload' };
        } else {
          const url = (typeof req.query?.[fileSpec.param] === 'string' && req.query[fileSpec.param].trim()) || (typeof req.query?.url === 'string' && req.query.url.trim());
          if (url) { try { file = await downloadFile(url); } catch (e) { return fail(res, 400, e.code || 'FILE_FETCH_FAILED', e.message); } }
        }
        const fileParam = (spec.params || []).find(p => p.name === fileSpec.param);
        if (!file && fileParam?.required) return fail(res, 400, 'PARAM_REQUIRED', `Unggah file untuk '${fileSpec.param}'.`);
      }
      const up = await callUpstream(server, spec, parsed.values, file);
      if (up.media) {
        if (!up.media.buf.length) return fail(res, 502, 'UPSTREAM_FAILED', 'Layanan sumber mengirim file kosong. Kuota tidak dipotong.');
        if (up.media.buf.length > MAX_MEDIA_BYTES) return fail(res, 502, 'UPSTREAM_TOO_LARGE', 'File hasil terlalu besar untuk dikirim. Kuota tidak dipotong.');
        res.set('Cache-Control', 'private, no-store');
        res.set('X-Content-Type-Options', 'nosniff');
        return res.status(200).type(up.media.type).send(up.media.buf);
      }
      const data = up.data && typeof up.data === 'object' ? up.data : null;
      if (!data || up.status >= 400 || data.status === false) {
        if (!up.status) return fail(res, 504, 'UPSTREAM_TIMEOUT', up.timeout ? 'Layanan sumber terlalu lama menjawab. Coba lagi. Kuota tidak dipotong.' : 'Layanan sumber tidak bisa dihubungi. Coba lagi. Kuota tidak dipotong.');
        const message = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : 'Layanan sumber sedang bermasalah.';
        const clientError = up.status === 400 || up.status === 422;
        return fail(res, clientError ? 400 : 502, clientError ? 'INVALID_PARAMETER' : 'UPSTREAM_FAILED', clientError ? message : `${message} Kuota tidak dipotong.`, data?.details ? { details: data.details } : {});
      }
      const { creator, ...rest } = data;
      return res.status(200).json({ ...rest, status: true });
    }
  };
}

// Self-test satu endpoint dengan sample-nya, dijalankan di server.
async function probe(entry) {
  const server = SERVERS[entry.server];
  if (!server || !keyOf(server)) return { result: 'not_configured' };
  if (!entry.sample) return { result: 'manual' };
  const started = Date.now();
  const values = { ...entry.sample };
  let file = null;
  try {
    if (entry.file && values[entry.file.param]) { file = await downloadFile(values[entry.file.param]); delete values[entry.file.param]; }
  } catch (e) {
    return { result: 'error', error: 'Sample file tidak bisa diambil: ' + (e.message || e.code), ms: Date.now() - started };
  }
  const up = await callUpstream(server, entry, values, file);
  const ms = Date.now() - started;
  if (up.media) return up.media.buf.length ? { result: 'ok', status: up.status, ms } : { result: 'error', status: up.status, error: 'file kosong', ms };
  const data = up.data && typeof up.data === 'object' ? up.data : null;
  if (!up.status) return { result: 'error', status: 0, error: up.timeout ? 'timeout' : 'tidak bisa dihubungi', ms };
  if (!data) return { result: 'error', status: up.status, error: 'respons bukan JSON/media', ms };
  if (up.status >= 400 || data.status === false) return { result: 'error', status: up.status, error: typeof data.error === 'string' ? data.error : typeof data.message === 'string' ? data.message : 'gagal', ms };
  return { result: 'ok', status: up.status, ms };
}

module.exports = { makeEndpoint, registry, probe, SERVERS };
