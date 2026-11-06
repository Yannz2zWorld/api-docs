'use strict';
// Meneruskan request /api/(path)/(fitur) ke provider aslinya, lalu membersihkan jawabannya
// supaya provider tidak kelihatan. Mendukung respons JSON, teks, gambar, video, audio, dan file.
const { Readable } = require('stream');
const PROVIDERS = require('./providers');
const { clean } = require('./hide');
const { fetchFile, MAX_FILE_BYTES } = require('./fetchFile');

const TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 55000);
const STREAM_TYPE = /^(image|video|audio)\/|^application\/(octet-stream|pdf|zip|vnd\.android|x-|ogg)/i;

const fail = (res, status, error, message) => res.status(status).json({ status: false, creator: process.env.SITE_NAME || 'API Zero', error, message });
const keyOf = p => (p.keyMode === 'none' ? 'none' : process.env[p.keyEnv]);
const origin = req => (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

function readParams(spec, input) {
  const values = {};
  for (const p of spec.params || []) {
    let v;
    for (const k of [p.name, ...(p.aliases || [])]) {
      const raw = input[k];
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') { v = String(raw).trim(); break; }
    }
    if (v === undefined) {
      if (p.default !== undefined) v = String(p.default);
      else if (p.required) return { error: `Parameter '${p.name}' wajib diisi.` };
      else continue;
    }
    if (v.length > (p.max || 4000)) return { error: `Parameter '${p.name}' maksimal ${p.max || 4000} karakter.` };
    if (p.options && p.type !== 'bool' && !p.options.includes(v) && p.strict) return { error: `Parameter '${p.name}' harus salah satu dari: ${p.options.join(', ')}.` };
    values[p.name] = v;
  }
  return { values };
}

async function callUpstream(spec, values, file) {
  const provider = PROVIDERS[spec.server];
  const key = keyOf(provider);
  const query = {};
  for (const [k, v] of Object.entries(values)) query[spec.rename?.[k] || k] = v;
  Object.assign(query, spec.fixed || {});
  const headers = { Accept: 'application/json, */*' };
  if (provider.keyMode === 'header') headers[provider.keyName] = key;
  else if (provider.keyMode === 'query') query[provider.keyName || 'apikey'] = key;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const url = provider.base.replace(/\/+$/, '') + spec.upstream;
  try {
    let r;
    if (spec.multipart) {
      const form = new FormData();
      for (const [k, v] of Object.entries(query)) form.append(k, v);
      if (file) form.append(spec.file.field, new Blob([file.buf], { type: file.type }), file.name);
      r = await fetch(url, { method: 'POST', body: form, headers, signal: ctl.signal });
    } else {
      r = await fetch(url + '?' + new URLSearchParams(query), { headers, signal: ctl.signal });
    }
    return { r, done: () => clearTimeout(timer) };
  } catch (e) {
    clearTimeout(timer);
    return { error: e.name === 'AbortError' ? 'timeout' : 'network' };
  }
}

async function handle(spec, req, res) {
  const provider = PROVIDERS[spec.server];
  if (!keyOf(provider)) return fail(res, 503, 'NOT_CONFIGURED', 'Endpoint ini belum aktif di server.');

  const input = { ...(req.query || {}), ...(req.body && !Buffer.isBuffer(req.body) && typeof req.body === 'object' ? req.body : {}) };
  const fileParam = spec.file?.param;
  const parsed = readParams(fileParam ? { ...spec, params: spec.params.filter(p => p.name !== fileParam) } : spec, input);
  if (parsed.error) return fail(res, 400, 'INVALID_PARAMETER', parsed.error);

  // Upload: body mentah (POST --data-binary) atau URL file di parameter-nya.
  let file = null;
  if (spec.file) {
    const raw = Buffer.isBuffer(req.body) && req.body.length ? req.body : null;
    if (raw) {
      if (raw.length > MAX_FILE_BYTES) return fail(res, 413, 'FILE_TOO_LARGE', 'File maksimal 8 MB.');
      file = { buf: raw, type: (req.get('content-type') || 'application/octet-stream').split(';')[0], name: 'upload' };
    } else if (input[fileParam]) {
      try { file = await fetchFile(String(input[fileParam])); } catch (e) { return fail(res, 400, e.code, e.message); }
    } else if (spec.params.find(p => p.name === fileParam)?.required) {
      return fail(res, 400, 'INVALID_PARAMETER', `Upload file atau isi '${fileParam}' dengan URL https.`);
    }
  }

  const up = await callUpstream(spec, parsed.values, file);
  if (up.error) return fail(res, 504, 'UPSTREAM_TIMEOUT', up.error === 'timeout' ? 'Server sumber kelamaan jawab, coba lagi ya.' : 'Server sumber tidak bisa dihubungi, coba lagi ya.');
  const { r } = up;
  const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();

  try {
    // Media / file: di-stream langsung.
    if (r.ok && STREAM_TYPE.test(type)) {
      res.status(200).type(type);
      const len = r.headers.get('content-length');
      if (len) res.set('Content-Length', len);
      res.set('Cache-Control', 'public, max-age=300');
      res.set('Content-Disposition', 'inline');
      return await new Promise((resolve) => Readable.fromWeb(r.body).on('error', resolve).pipe(res).on('finish', resolve).on('error', resolve));
    }
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    const strip = new Set((provider.strip || []).map(s => s.toLowerCase()));
    const o = origin(req);

    if (!data || typeof data !== 'object') {
      if (!r.ok) return fail(res, 502, 'UPSTREAM_FAILED', 'Server sumber lagi bermasalah.');
      if (type === 'text/html') return fail(res, 502, 'UPSTREAM_FAILED', 'Server sumber mengirim jawaban yang tidak dikenali.');
      return res.json({ status: true, creator: process.env.SITE_NAME || 'API Zero', result: clean(o, text, strip) });
    }
    const body = clean(o, data, strip);
    if (!r.ok || body.status === false) {
      const msg = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : 'Server sumber lagi bermasalah.';
      return fail(res, r.status === 400 || r.status === 422 ? 400 : 502, r.status === 400 || r.status === 422 ? 'INVALID_PARAMETER' : 'UPSTREAM_FAILED', msg);
    }
    const { status, ...rest } = Array.isArray(body) ? { result: body } : body;
    return res.json({ status: true, creator: process.env.SITE_NAME || 'API Zero', ...rest });
  } finally { up.done(); }
}

module.exports = { handle };
