'use strict';
// Developer panel → "Sempurnakan & tes": turns pasted code in any common shape (a WhatsApp bot
// `case 'x':` block, an Express route, a plain axios/fetch call, or a ready plugin) into a handler
// script for plugin/ (wrapped by githubPluginService.buildPluginFile), then runs it once with a
// sample input before anything is deployed.
//
//   1. Rules first (free): code that makes one GET call to another API becomes a proxy spec
//      (lib/theresav or lib/apiproxy for servers this site already knows, so their key and
//      branding rules apply) or a small fetch handler for any other server.
//   2. AI when the rules cannot convert it and AI_API_KEY is set: any Anthropic-compatible
//      Messages API (AI_BASE_URL, e.g. a gateway such as KryptonLab), model AI_MODEL.
//
// Secrets written in the pasted code (API keys, tokens) never end up in the plugin and are never
// sent to the AI: they are swapped for placeholders and the plugin reads process.env.<NAME>, which
// the developer fills in on Vercel.
const path = require('path');
const vm = require('vm');
const Module = require('module');
const SERVERS = require('../config/apiServers');

const PLUGIN_DIR = path.join(__dirname, '..', 'plugin');
const TRY_TIMEOUT_MS = 35000;
const AI_TIMEOUT_MS = 150000;
const THERESAV_HOST = 'api.theresav.eu';

class BuildError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra; }
}

// ---------------------------------------------------------------- secrets
const SECRET_PATTERNS = [
  // headers: { 'x-apikey': 'abc…' }, Authorization: 'Bearer abc…'
  { re: /(['"]?(?:x-api-?key|apikey|api-key|x-auth-token|authorization|token)['"]?\s*:\s*)(['"`])(Bearer\s+)?([^'"`\s]{6,})\2/gi, kind: 'header' },
  // const API_KEY = 'abc…'
  { re: /(\b(?:const|let|var)\s+[A-Za-z_$]*(?:key|token|secret|apikey)[A-Za-z_$]*\s*=\s*)(['"`])([^'"`\s]{6,})\2/gi, kind: 'const' },
  // …?apikey=abc… inside a URL
  { re: /([?&](?:apikey|api_key|key|token|access_token)=)([A-Za-z0-9._~-]{6,})(?=[&'"`\s]|$)/gi, kind: 'query' }
];
const hostOf = u => { try { return new URL(u).hostname; } catch { return ''; } };
const envFromHost = host => 'EP_' + (host.replace(/^(api|www)\./, '').split('.').slice(0, -1).join('_') || 'UPSTREAM').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 30) + '_KEY';

// Replaces every secret literal with __SECRET_n__ and remembers which header/param it was.
function hideSecrets(code) {
  const secrets = [];
  let out = code;
  for (const { re, kind } of SECRET_PATTERNS) {
    out = out.replace(re, (...m) => {
      const value = kind === 'query' ? m[2] : kind === 'header' ? m[4] : m[3];
      if (/^__SECRET_\d+__$/.test(value) || /^process\.env/.test(value) || /\$\{/.test(value)) return m[0];
      let s = secrets.find(x => x.value === value);
      if (!s) { s = { placeholder: `__SECRET_${secrets.length + 1}__`, value, kind }; secrets.push(s); }
      if (kind === 'query') return m[1] + s.placeholder;
      return m[1] + m[2] + (kind === 'header' ? m[3] || '' : '') + s.placeholder + m[2];
    });
  }
  return { code: out, secrets };
}
const mask = v => (v.length <= 6 ? '•••' : v.slice(0, 3) + '•'.repeat(Math.min(8, v.length - 5)) + v.slice(-2));

// ---------------------------------------------------------------- rules
const titleCase = s => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const serverByHost = host => Object.entries(SERVERS).find(([, s]) => hostOf(s.base) === host)?.[0] || null;

// The first string or template argument of an HTTP call, following one `const url = …` hop.
function findCalls(code) {
  const calls = [];
  const re = /\b(axios(?:\.(get|post|put|delete|request))?|fetch|got|needle\.(?:get|post))\s*\(\s*(`[^`]*`|'[^']*'|"[^"]*"|[A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(code))) {
    let arg = m[3];
    if (/^[A-Za-z_$]/.test(arg)) {
      const def = new RegExp(`\\b(?:const|let|var)\\s+${arg.replace(/\$/g, '\\$')}\\s*=\\s*(\`[^\`]*\`|'[^']*'|"[^"]*")`).exec(code);
      if (!def) { calls.push({ fn: m[1], url: null }); continue; }
      arg = def[1];
    }
    const tail = code.slice(m.index, m.index + 400);
    const method = m[2] ? m[2].toUpperCase() : /method\s*:\s*['"](POST|PUT|DELETE)['"]/i.test(tail) ? 'POST' : 'GET';
    calls.push({ fn: m[1], url: arg.slice(1, -1), template: arg[0] === '`', method });
  }
  return calls.filter(c => c.url === null || /^https?:\/\//.test(c.url));
}

// `https://h/p?q=${encodeURIComponent(text)}&n=5` → { base, pathname, params: [{key, input}], fixed }
function parseTemplateUrl(url) {
  const exprs = [];
  const marked = url.replace(/\$\{([^}]*)\}/g, (_, e) => `__V${exprs.push(e) - 1}__`);
  let u;
  try { u = new URL(marked); } catch { return null; }
  if (/__V\d+__/.test(u.pathname) || /__V\d+__/.test(u.host)) return null;   // values in the path: leave it to the AI
  const params = [], fixed = {};
  for (const [k, v] of u.searchParams) {
    if (/__V\d+__/.test(v)) params.push({ key: k, expr: exprs[Number(/__V(\d+)__/.exec(v)[1])] });
    else if (!/^__SECRET_\d+__$/.test(v)) fixed[k] = v;
  }
  return { host: u.hostname, origin: u.origin, pathname: u.pathname, params, fixed, secretParam: [...u.searchParams].find(([, v]) => /^__SECRET_\d+__$/.test(v))?.[0] || null };
}

function sampleFrom(code) {
  const m = /(?:contoh|example|ex|cth)\s*:?\s*\.?\$\{(?:command|cmd|prefix\s*\+\s*command)\}\s+([^\n`'"\\]{1,60})/i.exec(code)
    || /(?:contoh|example)\s*:?\s*[.#!/]?[a-z0-9]+\s+([^\n`'"\\]{1,60})/i.exec(code);
  return m ? m[1].trim() : '';
}
const DEFAULT_SAMPLES = { url: '', link: '', q: 'anime', query: 'anime', text: 'halo', prompt: 'halo', username: 'instagram', user: 'torvalds' };

// One GET call to another API → a handler script, or null when the rules can't be sure.
function convertByRules(code, hidden) {
  const calls = findCalls(hidden.code);
  if (calls.length !== 1 || !calls[0].url || calls[0].method !== 'GET') return null;
  const t = parseTemplateUrl(calls[0].url);
  if (!t || !t.params.length || t.params.length > 4) return null;
  const cases = [...code.matchAll(/case\s+['"]([\w-]+)['"]\s*:/g)].map(m => m[1]);
  const command = cases[cases.length - 1] || '';
  const segs = t.pathname.split('/').filter(Boolean).filter(s => s !== 'api' && !/^v\d+$/.test(s));
  const last = slug(segs[segs.length - 1] || command || 'endpoint');
  const category = slug(segs.length > 1 ? segs[segs.length - 2] : 'tools') || 'tools';
  const name = segs.length ? `${titleCase(last)} ${titleCase(category)}` : titleCase(command || last);
  const example = sampleFrom(code);
  const params = t.params.map((p, i) => ({ name: p.key, required: true, placeholder: (i === 0 && example) || DEFAULT_SAMPLES[p.key] || `Masukkan ${p.key}` }));
  const sample = Object.fromEntries(params.map((p, i) => [p.name, (i === 0 && example) || DEFAULT_SAMPLES[p.name] || '']));
  const headerSecret = hidden.secrets.find(s => s.kind === 'header' || s.kind === 'const');
  const known = t.host === THERESAV_HOST ? 'theresav' : serverByHost(t.host);
  const meta = { name, desc: `${name}. Dibuat otomatis dari kode yang ditempel.`, category: titleCase(category), path: `/api/${category}/${last}`, params, sample };
  const specParams = params.map(p => ({ name: p.name, required: true, placeholder: p.placeholder }));
  const notes = [];
  let script;
  let env = null;
  if (known === 'theresav' && !Object.keys(t.fixed).length) {
    env = 'THERESAV_API_KEY';
    script = `// ${name}: served through api.theresav.eu in the background (lib/theresav.js, key THERESAV_API_KEY).
const { makeEndpoint } = require('../lib/theresav');

module.exports = makeEndpoint(${JSON.stringify({ name, desc: meta.desc, category: meta.category, path: meta.path, upstream: t.pathname, params: specParams, sample }, null, 2)});
`;
    notes.push('Server sumbernya theresav: pakai key THERESAV_API_KEY yang udah ada di Vercel, key di kode kamu nggak dipakai.');
  } else if (known && known !== 'theresav') {
    env = SERVERS[known].keyEnv;
    script = `// ${name}: served through ${t.host} in the background (lib/apiproxy.js, server "${known}").
const { makeEndpoint } = require('../lib/apiproxy');

module.exports = makeEndpoint(${JSON.stringify({ server: known, name, desc: meta.desc, category: meta.category, path: meta.path, upstream: t.pathname, params: specParams, ...(Object.keys(t.fixed).length ? { fixed: t.fixed } : {}), sample }, null, 2)});
`;
    if (env) notes.push(`Server sumbernya ${known}: pakai key ${env} yang udah ada di Vercel.`);
  } else {
    const secret = hidden.secrets.find(s => s.kind === 'query') || headerSecret;
    env = known === 'theresav' ? 'THERESAV_API_KEY' : secret ? envFromHost(t.host) : null;
    const headerName = headerSecret && /(['"]?)([\w-]+)\1\s*:\s*['"`](?:Bearer\s+)?__SECRET_/.exec(hidden.code)?.[2];
    const bearer = headerSecret && new RegExp(`Bearer\\s+${headerSecret.placeholder}`).test(hidden.code);
    script = `// ${name}: calls ${t.host} in the background and answers with its JSON. The gateway rewrites
// media links to this site and hides the upstream (index.js).
const UPSTREAM = ${JSON.stringify(t.origin + t.pathname)};
const FIXED = ${JSON.stringify(t.fixed)};
const PARAMS = ${JSON.stringify(params.map(p => p.name))};

module.exports = async (req, res) => {
${env ? `  const key = process.env.${env};
  if (!key) return res.status(503).json({ status: false, error: 'UPSTREAM_NOT_CONFIGURED', message: 'Endpoint ini belum aktif. Kuota nggak dipotong.' });
` : ''}  const url = new URL(UPSTREAM);
  for (const [k, v] of Object.entries(FIXED)) url.searchParams.set(k, v);
  for (const name of PARAMS) {
    const value = typeof req.query[name] === 'string' ? req.query[name].trim() : '';
    if (!value) return res.status(400).json({ status: false, error: 'PARAM_REQUIRED', message: \`Parameter '\${name}' wajib diisi.\` });
    url.searchParams.set(name, value.slice(0, 500));
  }
${env && t.secretParam ? `  url.searchParams.set(${JSON.stringify(t.secretParam)}, key);\n` : ''}  const headers = { Accept: 'application/json'${env && headerName ? `, ${JSON.stringify(headerName)}: ${bearer ? '`Bearer ${key}`' : 'key'}` : ''} };
  let r;
  try { r = await fetch(url, { headers, signal: AbortSignal.timeout(30000) }); }
  catch { return res.status(504).json({ status: false, error: 'UPSTREAM_TIMEOUT', message: 'Layanan sumbernya kelamaan jawab. Kuota nggak dipotong.' }); }
  const data = await r.json().catch(() => null);
  if (!r.ok || !data) return res.status(502).json({ status: false, error: 'UPSTREAM_FAILED', message: 'Layanan sumbernya lagi bermasalah. Kuota nggak dipotong.' });
  return res.status(data.status === false ? 502 : 200).json(data);
};
`;
    if (env) notes.push(`Isi env ${env} di Vercel dengan API key server ${t.host}, terus redeploy.`);
  }
  return { source: 'rules', meta, script, env, notes };
}

// ---------------------------------------------------------------- AI
const aiConfig = () => {
  const key = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  const base = (process.env.AI_BASE_URL || '').trim().replace(/\/+$/, '').replace(/\/v1$/, '');
  return { key, base, model: process.env.AI_MODEL || (base ? 'claude-opus-4.7' : 'claude-opus-5-5'), host: base ? hostOf(base) : 'api.anthropic.com' };
};
const aiConfigured = () => Boolean(aiConfig().key);

function client() {
  const { key, base } = aiConfig();
  const sdk = require('@anthropic-ai/sdk');
  const Anthropic = sdk.default || sdk;
  // Gateways (AI_BASE_URL, e.g. KryptonLab) authenticate with "Authorization: Bearer <key>"; the key
  // goes in x-api-key too for gateways that read that one. The official API uses x-api-key only.
  return new Anthropic({ apiKey: key, ...(base ? { baseURL: base, authToken: key } : {}), timeout: AI_TIMEOUT_MS, maxRetries: 1 });
}

const SYSTEM = `You convert pasted JavaScript (WhatsApp bot "case" commands, Express routes, scripts, or plugins) into one HTTP endpoint for the Yannz API website.

Write a CommonJS handler script that runs on Node.js 20 inside the site's plugin folder:
- Export the handler: module.exports = async (req, res) => { ... }
- Inputs come from req.query (GET). Validate each required parameter; when one is missing answer 400 with {"status": false, "error": "PARAM_REQUIRED", "message": "Parameter 'q' wajib diisi."}.
- Answer success with HTTP 200 and JSON {"status": true, "result": ...}: the useful data only (no bot buttons, captions, reactions or emojis).
- Answer failures with JSON {"status": false, "error": "UPPER_SNAKE_CODE", "message": "<short casual Indonesian>"} and a fitting HTTP status (400 input, 404 nothing found, 502/504 upstream).
- Use the global fetch with AbortSignal.timeout(30000). axios is also installed. No other packages.
- Drop everything that only makes sense in a chat bot: Reply, sendMessage, react, m.chat, m.sender, limits, registration, prefix, command, waitMsg, global.mess and the like. The website already handles keys, tiers and quotas.
- Placeholders like __SECRET_1__ stand for secrets that were removed. Never write them in the code; read process.env.<ENV> for each one, using the env names listed in the request. If an env is missing at runtime answer 503 {"status": false, "error": "UPSTREAM_NOT_CONFIGURED", "message": "Endpoint ini belum aktif. Kuota nggak dipotong."}.
- Never log secrets. Keep it short and readable.

Reply in exactly this form, nothing before or after it:
<meta>{"name": "Short Title", "desc": "One casual Indonesian sentence about what it does", "category": "Search|Download|Tools|AI|Image|Maker|Stalk|Random|Info", "path": "/api/<category-lowercase>/<name-lowercase-with-dashes>", "params": [{"name": "q", "required": true, "placeholder": "example value"}], "sample": {"q": "example value"}}</meta>
<code>
the full handler script as plain JavaScript (not escaped, no code fences)
</code>
If the code cannot become an endpoint at all, reply <error>why, in casual Indonesian</error> instead.`;

// JSON as models sometimes write it: raw line breaks / tabs inside strings are escaped first.
function looseJson(s) {
  try { return JSON.parse(s); } catch {}
  let out = '', inStr = false, esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) { esc = false; out += ch; continue; }
      if (ch === '\\') { esc = true; out += ch; continue; }
      if (ch === '"') inStr = false;
      out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : ch;
    } else { if (ch === '"') inStr = true; out += ch; }
  }
  try { return JSON.parse(out); } catch { return null; }
}
function parseJsonReply(text) {
  const s = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = s.indexOf('{'), end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return looseJson(s.slice(start, end + 1));
}
// The reply: <meta>{…}</meta> plus <code>…</code> (the code stays plain text, so a long script can't
// break the JSON around it), or <error>…</error>. A one-object JSON reply is read too.
function parseReply(text) {
  const t = String(text || '');
  const err = /<error>([\s\S]*?)<\/error>/i.exec(t);
  if (err) return { error: err[1].trim() };
  const code = /<code>([\s\S]*?)(<\/code>|$)/i.exec(t);
  if (code) {
    const meta = /<meta>([\s\S]*?)<\/meta>/i.exec(t);
    const m = (meta && parseJsonReply(meta[1])) || {};
    const body = code[1].replace(/^\s*```(?:js|javascript)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
    return { ...m, code: body, cut: !code[2] };
  }
  const json = parseJsonReply(t);
  if (json && (json.code || json.error)) return json;
  // Prose with the script in a fenced block ("Here's the converted code: ```js …```"): the longest
  // block that exports a handler is the script; a ```json block, if any, is the metadata.
  const blocks = [...t.matchAll(/```([\w-]*)[^\n]*\n([\s\S]*?)(```|$)/g)].map(m => ({ lang: m[1].toLowerCase(), body: m[2].trim(), closed: Boolean(m[3]) }));
  const script = blocks.filter(x => /module\.exports|exports\.\w+\s*=/.test(x.body)).sort((x, y) => y.body.length - x.body.length)[0];
  if (script) {
    const meta = blocks.find(x => x.lang === 'json' && x !== script);
    return { ...((meta && parseJsonReply(meta.body)) || {}), code: script.body, cut: !script.closed };
  }
  return json;
}

async function convertByAI(hidden, envs) {
  const { model } = aiConfig();
  const envList = hidden.secrets.length ? hidden.secrets.map(s => `${s.placeholder} → process.env.${envs[s.placeholder]}`).join('\n') : '(no secrets were found)';
  let message;
  const request = {
    model,
    max_tokens: 16000,
    system: SYSTEM,
    // The instructions go in the user turn too: some gateways (e.g. KryptonLab) drop the system prompt.
    messages: [{ role: 'user', content: `${SYSTEM}\n\n----- Env names for the removed secrets:\n${envList}\n\n----- Code to convert:\n\n${hidden.code.slice(0, 60000)}\n\n----- Reply now: only <meta>{…}</meta> then <code>…</code> (or <error>…</error>), no other text.` }]
  };
  const textOf = m => (m?.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try {
    message = await client().messages.stream(request).finalMessage();
    // Some gateways answer a streamed request in a form the SDK can't assemble (no text at all);
    // the same request without streaming then still works.
    if (!textOf(message).trim() && message.stop_reason !== 'refusal') message = await client().messages.create(request);
  } catch (e) {
    const status = e?.status;
    const why = status === 401 || status === 403 ? 'API key AI ditolak. Cek AI_API_KEY di Vercel.'
      : status === 402 ? 'Saldo/kredit AI habis. Isi saldo dulu di penyedia AI-nya.'
        : status === 404 ? `Model ${model} nggak ketemu di penyedia AI. Cek AI_MODEL.`
          : status === 429 ? 'AI lagi kena limit. Coba lagi sebentar lagi.'
            : e?.name === 'APIConnectionTimeoutError' ? 'AI kelamaan jawab. Coba lagi.' : 'Nggak bisa nyambung ke AI. Cek AI_BASE_URL dan coba lagi.';
    throw new BuildError(502, 'AI_FAILED', why, { aiStatus: status || null });
  }
  if (message.stop_reason === 'refusal') throw new BuildError(422, 'AI_REFUSED', 'AI-nya nolak ngubah kode ini.');
  const text = textOf(message);
  const out = parseReply(text);
  // Cut off at max_tokens: the script would be incomplete.
  if (message.stop_reason === 'max_tokens' || out?.cut) throw new BuildError(502, 'AI_TRUNCATED', 'Jawaban AI kepotong karena kodenya kepanjangan. Tempel bagian yang perlu aja (satu case/fungsi), terus coba lagi.');
  if (!out) throw new BuildError(502, 'AI_BAD_REPLY', 'Jawaban AI-nya nggak kebaca. Coba lagi.', { reply: text.slice(0, 300) });
  if (out.error) throw new BuildError(422, 'NOT_CONVERTIBLE', String(out.error).slice(0, 300));
  if (typeof out.code !== 'string' || !out.code.trim()) throw new BuildError(502, 'AI_BAD_REPLY', 'AI-nya nggak ngasih kode. Coba lagi.');
  let script = out.code;
  for (const s of hidden.secrets) if (script.includes(s.placeholder)) script = script.split(s.placeholder).join('');   // never deploy a placeholder
  const params = Array.isArray(out.params) ? out.params.filter(p => p && /^[a-zA-Z_][\w-]{0,30}$/.test(p.name)).slice(0, 8).map(p => ({ name: p.name, required: p.required !== false, placeholder: String(p.placeholder || '').slice(0, 80) })) : [];
  // No name from the AI: the bot command's own name (case 'iqcpink' → "Iqcpink").
  const caseName = /\bcase\s+['"`]([\w-]{2,40})['"`]/.exec(hidden.code)?.[1];
  const name = String(out.name || (caseName ? titleCase(caseName) : 'Endpoint Baru')).slice(0, 100);
  const category = titleCase(slug(out.category || 'tools') || 'tools');
  let p = String(out.path || '');
  if (!/^\/api\/[a-z0-9-]{1,40}\/[a-z0-9-]{1,60}$/.test(p)) p = `/api/${slug(category)}/${slug(name) || 'endpoint'}`;
  const sample = out.sample && typeof out.sample === 'object' ? Object.fromEntries(Object.entries(out.sample).map(([k, v]) => [k, String(v)])) : {};
  return { source: 'ai', model, meta: { name, desc: String(out.desc || name).slice(0, 500), category, path: p, params, sample }, script };
}

// ---------------------------------------------------------------- convert
const isPlugin = code => /\bmodule\.exports\s*=|\bexports\.\w+\s*=/.test(code) && /\breq\b[\s\S]*\bres\b|\brun\s*\(|makeEndpoint\s*\(/.test(code) && !/\bcase\s+['"][\w-]+['"]\s*:/.test(code);

// Hard-coded secrets in a ready plugin → process.env reads.
function envifyPlugin(code, hidden) {
  let out = hidden.code;
  const envs = {};
  for (const s of hidden.secrets) {
    const env = s.env;
    envs[s.placeholder] = env;
    out = out.split(`'${s.placeholder}'`).join(`process.env.${env}`).split(`"${s.placeholder}"`).join(`process.env.${env}`).split(`\`${s.placeholder}\``).join(`process.env.${env}`);
    out = out.split(s.placeholder).join(`\${process.env.${env}}`);
  }
  return out;
}

async function convert(code, { useAI = 'auto' } = {}) {
  if (typeof code !== 'string' || !code.trim()) throw new BuildError(400, 'CODE_REQUIRED', 'Tempel kodenya dulu.');
  if (Buffer.byteLength(code, 'utf8') > 200 * 1024) throw new BuildError(413, 'CODE_TOO_LARGE', 'Kode maksimal 200 KB.');
  const hidden = hideSecrets(code);
  const firstUrl = findCalls(hidden.code).find(c => c.url)?.url || '';
  const host = hostOf(firstUrl.replace(/\$\{[^}]*\}/g, 'x'));
  const knownEnv = host === THERESAV_HOST ? 'THERESAV_API_KEY' : (serverByHost(host) && SERVERS[serverByHost(host)].keyEnv) || null;
  hidden.secrets.forEach((s, i) => { s.env = knownEnv || (host ? envFromHost(host) : 'EP_API_KEY') + (i ? `_${i + 1}` : ''); });
  const secrets = hidden.secrets.map(s => ({ env: s.env, masked: mask(s.value), known: s.env === knownEnv }));

  let out;
  if (isPlugin(code)) {
    const script = envifyPlugin(code, hidden);
    const meta = {
      name: /\bname\s*:\s*['"`]([^'"`]{1,100})/.exec(code)?.[1] || 'Endpoint Baru',
      desc: /\bdesc(?:ription)?\s*:\s*['"`]([^'"`]{1,500})/.exec(code)?.[1] || '',
      category: /\bcategory\s*:\s*['"`]([^'"`]{1,40})/.exec(code)?.[1] || 'Tools',
      path: (/\bpath\s*:\s*['"`](\/api\/[a-z0-9-]+\/[a-z0-9-]+)/.exec(code)?.[1]) || '',
      params: [], sample: {}
    };
    if (!meta.path) meta.path = `/api/${slug(meta.category) || 'tools'}/${slug(meta.name) || 'endpoint'}`;
    out = { source: 'plugin', meta, script, notes: ['Kode ini udah berbentuk plugin, dipakai apa adanya.'] };
  } else {
    out = useAI === 'only' ? null : convertByRules(code, hidden);
    if (!out) {
      if (useAI === 'never') throw new BuildError(422, 'NOT_CONVERTIBLE', 'Kode ini nggak bisa disesuaikan pakai aturan otomatis (cuma bisa buat kode yang manggil 1 API lewat GET).');
      if (!aiConfigured()) throw new BuildError(422, 'AI_NOT_CONFIGURED', 'Kode ini nggak bisa disesuaikan otomatis tanpa AI. Isi AI_API_KEY (plus AI_BASE_URL dan AI_MODEL kalau pakai gateway kayak KryptonLab) di Vercel, terus redeploy.');
      out = await convertByAI(hidden, Object.fromEntries(hidden.secrets.map(s => [s.placeholder, s.env])));
      out.notes = hidden.secrets.length ? [`Isi env ${[...new Set(hidden.secrets.map(s => s.env))].join(', ')} di Vercel kalau belum ada, terus redeploy.`] : [];
    }
  }
  return { ...out, secrets, hiddenCount: hidden.secrets.length };
}

// ---------------------------------------------------------------- try
// Loads a handler script (or a whole plugin file) the way the plugin loader would, then calls it
// once with the sample input and reports what came back.
function load(script, wantPath) {
  const filename = path.join(PLUGIN_DIR, '__try__.js');
  const mod = { exports: {} };
  const fn = vm.compileFunction(script, ['exports', 'require', 'module', '__filename', '__dirname'], { filename: 'endpoint-test.js' });
  fn(mod.exports, Module.createRequire(filename), mod, filename, PLUGIN_DIR);
  let h = mod.exports;
  if (Array.isArray(h)) h = h.find(r => r && String(r.path || '').split('?')[0] === wantPath) || (h.length === 1 ? h[0] : null);
  const run = typeof h === 'function' ? h : h && typeof h.run === 'function' ? h.run.bind(h) : null;
  if (!run) throw new BuildError(400, 'SCRIPT_NO_EXPORT', 'Kode-nya harus meng-export handler (req, res) atau { run(req, res) }.');
  return { run, handler: h };
}

function fakeReqRes(query, wantPath) {
  const headers = {};
  const req = {
    method: 'GET', path: wantPath, url: wantPath, query, headers: {}, body: undefined, protocol: 'https', hostname: 'apiz2z.web.id', ip: '127.0.0.1',
    get: () => undefined, header: () => undefined,
    apiAuth: { userId: null, keyId: null, tier: 'OWNER', quota: { used: 0, limit: 0, remaining: 0, resetAt: null } }
  };
  let done;
  const finished = new Promise(r => { done = r; });
  const res = {
    statusCode: 200, headersSent: false, locals: {},
    status(c) { this.statusCode = c; return this; },
    set(k, v) { if (typeof k === 'object') Object.assign(headers, k); else headers[String(k).toLowerCase()] = v; return this; },
    setHeader(k, v) { headers[String(k).toLowerCase()] = v; },
    get: k => headers[String(k).toLowerCase()],
    type(t) { headers['content-type'] = t; return this; },
    json(b) { this.headersSent = true; done({ json: b }); return this; },
    send(b) { this.headersSent = true; done(Buffer.isBuffer(b) ? { media: { type: headers['content-type'] || 'application/octet-stream', bytes: b.length } } : typeof b === 'object' ? { json: b } : { text: String(b) }); return this; },
    end(b) { return this.send(b || ''); },
    redirect(u) { this.statusCode = 302; return this.send(`redirect ${u}`); },
    sendFile() { return this.send(Buffer.alloc(0)); }
  };
  return { req, res, finished };
}

const isEmpty = v => v == null || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) || v === '';

async function tryScript(script, { path: wantPath, sample = {} }) {
  let run;
  try { ({ run } = load(script, wantPath)); }
  catch (e) {
    if (e instanceof BuildError) throw e;
    return { ok: false, stage: 'load', error: 'SCRIPT_ERROR', message: `Kode-nya error pas dimuat: ${String(e.message).slice(0, 300)}` };
  }
  const query = Object.fromEntries(Object.entries(sample || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, String(v)]));
  const { req, res, finished } = fakeReqRes(query, wantPath);
  const started = Date.now();
  let outcome;
  try {
    outcome = await Promise.race([
      Promise.resolve().then(() => run(req, res)).then(() => (res.headersSent ? finished : { none: true })),
      finished,
      new Promise(r => setTimeout(() => r({ timeout: true }), TRY_TIMEOUT_MS))
    ]);
  } catch (e) {
    return { ok: false, stage: 'run', ms: Date.now() - started, error: 'SCRIPT_ERROR', message: `Kode-nya error pas dijalanin: ${String(e?.message || e).slice(0, 300)}` };
  }
  const ms = Date.now() - started;
  if (outcome.timeout) return { ok: false, stage: 'run', ms, error: 'TIMEOUT', message: `Nggak ada jawaban dalam ${TRY_TIMEOUT_MS / 1000} detik.` };
  if (outcome.none) return { ok: false, stage: 'run', ms, error: 'NO_RESPONSE', message: 'Handler-nya selesai tanpa ngirim jawaban (res.json / res.send).' };
  const status = res.statusCode;
  if (outcome.media) return { ok: status < 400 && outcome.media.bytes > 0, ms, status, media: outcome.media, message: status < 400 ? `Jalan: ngirim file ${outcome.media.type} (${outcome.media.bytes} byte).` : `HTTP ${status}` };
  const body = outcome.json ?? outcome.text;
  const result = body && typeof body === 'object' ? (body.result ?? body.data ?? body.results ?? body) : body;
  const failed = status >= 400 || (body && typeof body === 'object' && body.status === false);
  const ok = !failed && !isEmpty(result);
  const preview = JSON.stringify(body, null, 2) || '';
  return {
    ok, ms, status,
    error: ok ? null : (body && body.error) || (failed ? `HTTP_${status}` : 'EMPTY_RESULT'),
    message: ok ? `Jalan: HTTP ${status} dalam ${ms} ms.` : (body && body.message) || (failed ? `Endpoint-nya jawab HTTP ${status}.` : 'Jawabannya kosong, nggak ada data.'),
    preview: preview.length > 4000 ? preview.slice(0, 4000) + '\n…' : preview
  };
}

// The AI connection test for the Developer panel.
async function pingAI() {
  const cfg = aiConfig();
  if (!cfg.key) return { ok: false, configured: false, message: 'AI_API_KEY belum diisi di Vercel.' };
  const started = Date.now();
  try {
    const m = await client().messages.create({ model: cfg.model, max_tokens: 16, messages: [{ role: 'user', content: 'Balas satu kata: OK' }] });
    const text = (m.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return { ok: true, configured: true, model: cfg.model, host: cfg.host, ms: Date.now() - started, reply: text.slice(0, 40), message: `AI nyambung (${cfg.model} lewat ${cfg.host}, ${Date.now() - started} ms).` };
  } catch (e) {
    const status = e?.status || null;
    // The provider's own reason helps (wrong key, model not allowed for this key, no credit…); never the key.
    const why = String(e?.error?.error?.message || e?.error?.message || '').replace(cfg.key, '***').slice(0, 160);
    const base = status === 401 || status === 403 ? 'API key AI ditolak' : status === 404 ? `Model ${cfg.model} nggak ketemu. Cek AI_MODEL` : status === 402 ? 'Saldo AI habis' : 'Gagal nyambung ke AI';
    return { ok: false, configured: true, model: cfg.model, host: cfg.host, status, message: `${base}${status ? ` (HTTP ${status}${why ? `: ${why}` : ''})` : ''}.` };
  }
}
const aiStatus = () => { const c = aiConfig(); return { configured: Boolean(c.key), model: c.model, host: c.host }; };

module.exports = { BuildError, convert, tryScript, pingAI, aiStatus, aiConfigured, hideSecrets, convertByRules, findCalls, parseTemplateUrl, load };
