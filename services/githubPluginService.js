'use strict';
// Owner panel → new endpoint: commits the uploaded script as plugin/<kategori>-<nama>.js to the
// repository through the GitHub REST API. The Vercel Git integration then redeploys and the plugin
// loader in index.js registers the route. (Vercel's filesystem is read-only, so writing plugin/
// on the server would not survive the request.)
//
// Config (Vercel env): GITHUB_TOKEN — fine-grained token with "Contents: read and write" on this
// repository only; GITHUB_REPO (owner/name, default below); GITHUB_BRANCH (default main).
// The token is sent only to api.github.com and is never logged or returned.
const vm = require('vm');

const API = 'https://api.github.com';
const DEFAULT_REPO = 'Yannz2zWorld/api-docs';
const MAX_CODE_BYTES = 200 * 1024;
const PATH_RE = /^\/api\/([a-z0-9-]{1,40})\/([a-z0-9-]{1,60})$/;

class PluginError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function config() {
  return {
    token: process.env.GITHUB_TOKEN || '',
    repo: process.env.GITHUB_REPO || DEFAULT_REPO,
    branch: process.env.GITHUB_BRANCH || 'main'
  };
}
const isConfigured = () => Boolean(config().token);

// "/api/download/tiktok" → { category: "Download", file: "plugin/download-tiktok.js", plugin: "download-tiktok" }
function parsePath(p) {
  const m = PATH_RE.exec(String(p || ''));
  if (!m) return null;
  const plugin = `${m[1]}-${m[2]}`;
  return { category: m[1].charAt(0).toUpperCase() + m[1].slice(1), plugin, file: `plugin/${plugin}.js` };
}

// Syntax check only: compiles the script as a CommonJS function body without running it.
function validateCode(code) {
  if (typeof code !== 'string' || !code.trim()) throw new PluginError(400, 'SCRIPT_REQUIRED', 'Script .js wajib diisi.');
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) throw new PluginError(413, 'SCRIPT_TOO_LARGE', 'Script maksimal 200 KB.');
  try {
    vm.compileFunction(code, ['exports', 'require', 'module', '__filename', '__dirname'], { filename: 'uploaded-plugin.js' });
  } catch (e) {
    throw new PluginError(400, 'SCRIPT_SYNTAX', `Script-nya nggak valid: ${String(e.message).slice(0, 200)}`);
  }
  if (!/\bmodule\.exports\b|\bexports\.\w+/.test(code)) {
    throw new PluginError(400, 'SCRIPT_NO_EXPORT', 'Script harus meng-export handler: module.exports = async (req, res) => { … } atau module.exports = { run(req, res) { … } }.');
  }
}

// The committed file: metadata from the form + the uploaded script, verbatim, in its own scope.
function buildPluginFile({ name, desc, category, path, code, params }) {
  const meta = JSON.stringify({ name, desc, category, path, ...(Array.isArray(params) && params.length ? { params } : {}) }, null, 2);
  return `// Endpoint added from the owner panel. The metadata registers the route (see the plugin loader in
// index.js); the uploaded script between the markers handles it. It exports either a function
// (req, res) or an object with run(req, res). Tier, lock and status live in the endpoints table.
const meta = ${meta};

const uploaded = { exports: {} };
(function (module, exports) {
// ---- uploaded script ----
${code.replace(/\r\n/g, '\n').replace(/\s+$/, '')}
// ---- end of uploaded script ----
})(uploaded, uploaded.exports);

const handler = uploaded.exports;
const run = typeof handler === 'function' ? handler : handler && typeof handler.run === 'function' ? handler.run.bind(handler) : null;
if (!run) throw new Error(meta.path + ': the uploaded script must export a function (req, res) or { run(req, res) }');
// The sandbox form shows the script's own parameters when it has them (lib/theresav, lib/apiproxy specs).
const params = meta.params || (handler && Array.isArray(handler.params) ? handler.params : undefined);
module.exports = { ...meta, ...(params ? { params } : {}), ...(handler && handler.upload ? { upload: true } : {}), run };
`;
}

async function gh(method, url, body) {
  const { token } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(API + url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'yannz-api-owner-panel',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    let json = null;
    try { json = await r.json(); } catch { /* empty body */ }
    return { status: r.status, json };
  } catch (e) {
    throw new PluginError(502, 'GITHUB_UNREACHABLE', 'Nggak bisa nyambung ke GitHub. Coba lagi ya.');
  } finally {
    clearTimeout(timer);
  }
}

function githubFailure(status) {
  if (status === 401 || status === 403) return new PluginError(502, 'GITHUB_AUTH', 'GITHUB_TOKEN ditolak GitHub. Cek token-nya masih berlaku dan punya izin Contents: read and write di repo ini.');
  if (status === 404) return new PluginError(502, 'GITHUB_REPO_NOT_FOUND', 'Repo/branch GitHub nggak ketemu. Cek GITHUB_REPO dan GITHUB_BRANCH.');
  if (status === 409 || status === 422) return new PluginError(409, 'PLUGIN_FILE_EXISTS', 'File plugin buat path ini udah ada di repo.');
  return new PluginError(502, 'GITHUB_ERROR', `GitHub nolak commit-nya (HTTP ${status}).`);
}

const contentsUrl = (repo, file) => `/repos/${repo}/contents/${file.split('/').map(encodeURIComponent).join('/')}`;

// Creates the file in a single commit. The contents API refuses to overwrite without the
// existing blob sha, so an existing plugin file is never replaced from here.
async function commitPlugin({ file, content, message }) {
  const { repo, branch } = config();
  if (!isConfigured()) throw new PluginError(503, 'GITHUB_NOT_CONFIGURED', 'Upload plugin belum aktif: set GITHUB_TOKEN (dan GITHUB_REPO kalau repo-nya beda) di Environment Variables Vercel, terus redeploy.');
  const existing = await gh('GET', `${contentsUrl(repo, file)}?ref=${encodeURIComponent(branch)}`);
  if (existing.status === 200) throw new PluginError(409, 'PLUGIN_FILE_EXISTS', 'File plugin buat path ini udah ada di repo.');
  if (existing.status !== 404) throw githubFailure(existing.status);
  const r = await gh('PUT', contentsUrl(repo, file), { message, content: Buffer.from(content, 'utf8').toString('base64'), branch });
  if (r.status !== 201 && r.status !== 200) throw githubFailure(r.status);
  const commit = (r.json && r.json.commit) || {};
  return { sha: commit.sha || null, url: commit.html_url || null, file };
}

// A plugin file made by the owner panel keeps the uploaded script between two markers.
const MARK_START = '// ---- uploaded script ----\n', MARK_END = '\n// ---- end of uploaded script ----';
function splitPluginFile(content) {
  const a = content.indexOf(MARK_START), b = content.indexOf(MARK_END);
  if (a < 0 || b < a) return null;
  let meta = null;
  const m = /const meta = (\{[\s\S]*?\n\});/.exec(content);
  if (m) { try { meta = JSON.parse(m[1]); } catch { meta = null; } }
  return { script: content.slice(a + MARK_START.length, b), meta };
}

// Current content and blob sha of a file on the branch, or null when it isn't there.
async function getFile(file) {
  const { repo, branch } = config();
  if (!isConfigured()) throw new PluginError(503, 'GITHUB_NOT_CONFIGURED', 'Edit/hapus plugin butuh GITHUB_TOKEN di Environment Variables Vercel.');
  const r = await gh('GET', `${contentsUrl(repo, file)}?ref=${encodeURIComponent(branch)}`);
  if (r.status === 404) return null;
  if (r.status !== 200 || !r.json) throw githubFailure(r.status);
  return { content: Buffer.from(r.json.content || '', 'base64').toString('utf8'), sha: r.json.sha };
}

// Replaces a file in one commit; `sha` is the blob that was edited, so a newer change is never lost.
async function updateFile({ file, content, sha, message }) {
  const { repo, branch } = config();
  if (!isConfigured()) throw new PluginError(503, 'GITHUB_NOT_CONFIGURED', 'Edit plugin butuh GITHUB_TOKEN di Environment Variables Vercel.');
  const r = await gh('PUT', contentsUrl(repo, file), { message, content: Buffer.from(content, 'utf8').toString('base64'), sha, branch });
  if (r.status === 409) throw new PluginError(409, 'PLUGIN_CHANGED', 'File plugin-nya baru diubah dari tempat lain. Buka lagi editornya terus ulangi.');
  if (r.status !== 200 && r.status !== 201) throw githubFailure(r.status);
  const commit = (r.json && r.json.commit) || {};
  return { sha: commit.sha || null, url: commit.html_url || null, file };
}

async function deleteFile({ file, sha, message }) {
  const { repo, branch } = config();
  if (!isConfigured()) throw new PluginError(503, 'GITHUB_NOT_CONFIGURED', 'Hapus plugin butuh GITHUB_TOKEN di Environment Variables Vercel.');
  const r = await gh('DELETE', contentsUrl(repo, file), { message, sha, branch });
  if (r.status === 409) throw new PluginError(409, 'PLUGIN_CHANGED', 'File plugin-nya baru diubah dari tempat lain. Coba lagi.');
  if (r.status !== 200) throw githubFailure(r.status);
  const commit = (r.json && r.json.commit) || {};
  return { sha: commit.sha || null, url: commit.html_url || null, file };
}

module.exports = { PluginError, isConfigured, parsePath, validateCode, buildPluginFile, commitPlugin, splitPluginFile, getFile, updateFile, deleteFile, MAX_CODE_BYTES };
