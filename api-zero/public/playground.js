(() => {
  'use strict';
  const $ = Z.$;
  const ORIGIN = location.origin;
  const ICONS = { AI: '🤖', Downloader: '📥', Search: '🔎', Tools: '🛠️', Maker: '🎨', Canvas: '🖼️', Textpro: '✍️', Ephoto: '📸', Primbon: '🔮', Games: '🎮', Random: '🎲', Stalk: '👀', News: '📰', Islamic: '🕌', Info: 'ℹ️', Anime: '🌸', Fun: '🎉', Image: '🌈', Movie: '🎬', Music: '🎵', Check: '✅' };
  const LANGS = ['cURL', 'JavaScript', 'Node.js', 'Python', 'PHP', 'Go', 'Ruby', 'Java', 'Dart'];
  const MEDIA_RE = /\.(jpe?g|png|gif|webp|bmp|svg|mp4|webm|mov|mkv|m3u8|mp3|m4a|ogg|opus|wav|aac|flac)(?=$|[?#])/i;

  let ALL = [];
  let cat = 'Semua';
  let lang = Z.store.get('az-lang') || 'cURL';

  const esc = Z.esc;

  const toast = Z.toast, copy = Z.copy;
  const modal = $('#modal');
  const RANK = { free: 0, basic: 1, premium: 2, super: 3, nebula: 4, freedom: 5, developer: 9 };
  const PLAN_NAME = { free: 'Free', basic: 'Basic', premium: 'Premium', super: 'Super', nebula: 'Nebula', freedom: 'Freedom' };
  let ME = null, KEY = '';
  let planFilter = 'all';
  const canUse = e => ME && (ME.user.isDeveloper || (!e.locked && RANK[ME.plan.id] >= RANK[e.plan || 'free']));

  // ---------------------------------------------------------------- list
  Z.nav(); Z.maintenanceBubble();
  Promise.all([fetch('/api/list').then(r => r.json()), Z.me()]).then(([d, me]) => {
    ME = me;
    ALL = d.endpoints || [];
    const saved = Z.store.get('az-key');
    KEY = (me.keys.find(k => k.key === saved) || me.keys[0] || {}).key || '';
    $('#keySel').innerHTML = me.keys.length ? me.keys.map(k => `<option value="${esc(k.key)}"${k.key === KEY ? ' selected' : ''}>${esc(k.label || 'Key')} · ${esc(k.key.slice(0, 14))}…</option>`).join('') : '<option value="">Belum ada key</option>';
    $('#keySel').onchange = e => { KEY = e.target.value; Z.store.set('az-key', KEY); };
    $('#planInfo').innerHTML = `${Z.tierBadge(me.user.tier, me.user.tierName)} <span class="muted small">${me.usage.limit ? `${Z.num(me.usage.today)} / ${Z.num(me.usage.limit)} request hari ini` : 'request tanpa batas'}</span>`;
    renderChips(d.categories || []);
    render();
    openFromHash();
  }).catch(() => { $('#list').innerHTML = '<div class="card empty"><div class="big">😵</div><p>Daftar endpoint gagal dimuat. Coba refresh.</p></div>'; });

  function renderChips(cats) {
    const counts = ALL.reduce((a, e) => (a[e.category] = (a[e.category] || 0) + 1, a), {});
    const items = ['Semua', ...cats];
    $('#chips').innerHTML = items.map(c => `<button class="chip${c === cat ? ' active' : ''}" data-cat="${esc(c)}">${ICONS[c] || (c === 'Semua' ? '✨' : '📦')} ${esc(c)}<small>${c === 'Semua' ? ALL.length : counts[c] || 0}</small></button>`).join('');
    $('#chips').onclick = e => {
      const b = e.target.closest('.chip'); if (!b) return;
      cat = b.dataset.cat;
      document.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === b));
      render();
    };
  }

  let searchTimer;
  $('#search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(render, 120); });

  function render() {
    const q = $('#search').value.trim().toLowerCase();
    const items = ALL.filter(e => (cat === 'Semua' || e.category === cat) && (!q || `${e.name} ${e.path} ${e.desc} ${e.category}`.toLowerCase().includes(q))
      && (planFilter === 'all' || (planFilter === 'free' ? (e.plan || 'free') === 'free' : planFilter === 'premium' ? (e.plan || 'free') !== 'free' : canUse(e))));
    $('#resultInfo').textContent = `${items.length} endpoint ditemukan`;
    if (!items.length) { $('#list').innerHTML = '<div class="card empty"><div class="big">🙈</div><p>Nggak ketemu. Coba kata kunci lain ya!</p></div>'; return; }
    const groups = {};
    items.forEach(e => (groups[e.category] = groups[e.category] || []).push(e));
    $('#list').innerHTML = Object.entries(groups).map(([c, list]) => `
      <section class="group">
        <h2 class="group-title">${ICONS[c] || '📦'} ${esc(c)} <span class="count">${list.length}</span></h2>
        <div class="ep-grid">${list.map(card).join('')}</div>
      </section>`).join('');
  }
  function card(e) {
    const ok = canUse(e);
    return `<button class="ep${ok ? '' : ' off'}" data-path="${esc(e.path)}">
      <div class="row" style="gap:6px"><span class="tag tag-${e.upload ? 'post' : 'get'}">${e.method}</span><span class="tag tag-${e.output}">${e.output}</span>${planTags(e)}</div>
      <div class="ep-name">${esc(e.name)}</div>
      <code class="ep-path">${esc(e.path)}</code>
      <p class="ep-desc">${esc(e.desc || '')}</p>
    </button>`;
  }
  $('#list').addEventListener('click', e => {
    const b = e.target.closest('.ep'); if (!b) return;
    const ep = ALL.find(x => x.path === b.dataset.path);
    if (ep) { history.replaceState(null, '', '#' + ep.path); open(ep); }
  });
  function planTags(e) {
    let t = '';
    if ((e.plan || 'free') !== 'free') t += `<span class="tier tier-${e.plan}">💎 ${PLAN_NAME[e.plan]}</span>`;
    if (e.locked) t += '<span class="tag tag-lock">🔒 dikunci</span>';
    if (e.hidden) t += '<span class="tag tag-hidden">👻 hidden</span>';
    if (!canUse(e) && !e.locked) t += '<span class="tag tag-lock">🔒</span>';
    return t;
  }
  $('#planFilter').onchange = e => { planFilter = e.target.value; render(); };
  function openFromHash() {
    const p = decodeURIComponent(location.hash.slice(1));
    const ep = p && ALL.find(x => x.path === p);
    if (ep) open(ep);
  }
  window.addEventListener('hashchange', openFromHash);

  // ---------------------------------------------------------------- detail modal
  modal.addEventListener('close', () => { if (location.hash) history.replaceState(null, '', location.pathname + location.search); revokeBlobs(); });
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

  let current = null;
  function open(ep) {
    current = ep;
    const ex = ep.example || {};
    const fields = ep.params.map(p => {
      const isFile = ep.upload && ep.upload.param === p.name;
      const val = ex[p.name] ?? p.default ?? '';
      const label = `<label for="f-${esc(p.name)}">${esc(p.name)} ${p.required ? '<span class="req">*</span>' : '<small>(opsional)</small>'}</label>`;
      let input;
      if (p.options && p.options.length) {
        input = `<select id="f-${esc(p.name)}" name="${esc(p.name)}">${p.required ? '' : '<option value="">— pilih —</option>'}${p.options.map(o => `<option${String(o) === String(val) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      } else {
        input = `<input id="f-${esc(p.name)}" name="${esc(p.name)}" value="${esc(val)}" placeholder="${esc(p.placeholder || p.name)}" autocomplete="off">`;
      }
      const file = isFile ? `<input type="file" id="file-${esc(p.name)}" accept="${esc(ep.upload.accept === '*' ? '' : ep.upload.accept)}" style="margin-top:6px"><div class="hint">Isi URL https, atau upload file (maks 8 MB).</div>` : '';
      return `<div class="field">${label}${input}${file}</div>`;
    }).join('');

    $('#modalBody').innerHTML = `
      <div class="row" style="gap:6px"><span class="tag tag-${ep.upload ? 'post' : 'get'}">${ep.method}</span><span class="tag tag-${ep.output}">${ep.output}</span><span class="badge">${ICONS[ep.category] || '📦'} ${esc(ep.category)}</span>${planTags(ep)}</div>
      <h2 style="margin-top:8px;padding-right:50px">${esc(ep.name)}</h2>
      <p class="muted" style="margin-top:0">${esc(ep.desc || '')}</p>
      ${canUse(ep) ? '' : `<div class="card" style="background:var(--orange);color:#1d1a2f;box-shadow:var(--shadow);padding:12px 14px">🔒 ${ep.locked ? 'Endpoint ini sedang dikunci developer.' : `Endpoint ini khusus plan <b>${PLAN_NAME[ep.plan]}</b> ke atas.`} ${ep.locked ? '' : '<a class="btn btn-sm" href="/price" style="margin-left:6px">Upgrade</a>'}</div>`}
      ${KEY ? '' : '<p class="small" style="font-weight:800">⚠️ Kamu belum punya API key. <a href="/profile#keys">Buat di Profile</a>.</p>'}

      <div class="section-title">🔗 Request URL</div>
      <div class="urlbox"><code id="reqUrl"></code><button class="btn btn-sm" data-copy-target="reqUrl">Salin URL</button><a class="btn btn-sm btn-blue" id="openUrl" target="_blank" rel="noopener">Buka ↗</a></div>

      ${ep.params.length ? `<div class="section-title">🧩 Parameter</div><form class="form-grid" id="paramForm" onsubmit="return false">${fields}</form>` : '<p class="muted" style="margin-top:12px">Endpoint ini nggak butuh parameter selain apikey. Langsung panggil aja!</p>'}
      <div class="actions"><button class="btn btn-pink" id="tryBtn">▶ Coba sekarang</button><button class="btn btn-ghost" id="resetBtn">↺ Reset contoh</button></div>

      <div class="section-title">💻 Contoh kode</div>
      <div class="tabs" id="tabs">${LANGS.map(l => `<button class="tab${l === lang ? ' active' : ''}" data-lang="${l}">${l}</button>`).join('')}</div>
      <div class="codebox"><button class="btn btn-sm copy" data-copy-target="code">Salin</button><pre id="code"></pre></div>

      <div class="section-title">📦 Respons server</div>
      <div class="response" id="response"><div class="placeholder">Tekan <b>▶ Coba sekarang</b> buat lihat hasilnya di sini.<br>Respons bisa berupa JSON, gambar, video, audio, atau URL file.</div></div>
    `;
    const form = $('#paramForm');
    if (form) form.addEventListener('input', update);
    $('#tabs').onclick = e => {
      const t = e.target.closest('.tab'); if (!t) return;
      lang = t.dataset.lang; Z.store.set('az-lang', lang);
      document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
      update();
    };
    $('#tryBtn').onclick = run;
    $('#resetBtn').onclick = () => open(ep);
    update();
    if (!modal.open) modal.showModal();
    $('#modalBody').scrollTop = 0; modal.scrollTop = 0;
  }

  function values() {
    const out = {};
    document.querySelectorAll('#paramForm [name]').forEach(i => { if (i.value.trim()) out[i.name] = i.value.trim(); });
    return out;
  }
  function buildUrl(v) {
    const qs = new URLSearchParams({ ...v, apikey: KEY || 'KEY_KAMU' }).toString();
    return `${ORIGIN}${current.path}?${qs}`;
  }
  function update() {
    const url = buildUrl(values());
    $('#reqUrl').textContent = url;
    $('#openUrl').href = url;
    $('#code').textContent = snippet(lang, url, current);
  }

  // ---------------------------------------------------------------- code snippets
  function extOf(o) { return { image: 'png', video: 'mp4', audio: 'mp3' }[o] || 'bin'; }
  function snippet(l, url, ep) {
    const media = ['image', 'video', 'audio'].includes(ep.output);
    const file = `hasil.${extOf(ep.output)}`;
    const up = ep.upload;
    switch (l) {
      case 'cURL': return [
        `# GET`,
        `curl -X GET "${url}"${media ? ` \\\n  -o ${file}   # kalau respons berupa file` : ''}`,
        up ? `\n# POST: upload file langsung (isi parameter lain di query)\ncurl -X POST "${url.replace(new RegExp(`([?&])${up.param}=[^&]*&?`), '$1').replace(/[?&]$/, '')}" \\\n  -H "Content-Type: image/jpeg" \\\n  --data-binary @foto.jpg` : ''
      ].join('\n');
      case 'JavaScript': return `// Browser / Deno / Bun (fetch)
const res = await fetch("${url}");
const type = res.headers.get("content-type") || "";

if (type.includes("application/json")) {
  const data = await res.json();
  console.log(data);
} else {
  // gambar / video / audio
  const blob = await res.blob();
  const src = URL.createObjectURL(blob);
  console.log("File siap dipakai:", src);
}`;
      case 'Node.js': return `// npm i axios
const axios = require("axios");
const fs = require("fs");

(async () => {
  const res = await axios.get("${url}", { responseType: "arraybuffer" });
  const type = res.headers["content-type"] || "";

  if (type.includes("application/json")) {
    console.log(JSON.parse(Buffer.from(res.data).toString()));
  } else {
    fs.writeFileSync("${file}", res.data); // simpan file media
    console.log("Tersimpan: ${file}");
  }
})();`;
      case 'Python': return `# pip install requests
import requests

res = requests.get("${url}", timeout=60)

if "application/json" in res.headers.get("content-type", ""):
    print(res.json())
else:
    with open("${file}", "wb") as f:
        f.write(res.content)  # simpan file media
    print("Tersimpan: ${file}")`;
      case 'PHP': return `<?php
$ch = curl_init("${url}");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);
$body = curl_exec($ch);
$type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

if (str_contains($type, "application/json")) {
    $data = json_decode($body, true);
    print_r($data);
} else {
    file_put_contents("${file}", $body); // simpan file media
    echo "Tersimpan: ${file}";
}`;
      case 'Go': return `package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

func main() {
	res, err := http.Get("${url}")
	if err != nil {
		panic(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)

	if strings.Contains(res.Header.Get("Content-Type"), "application/json") {
		fmt.Println(string(body))
	} else {
		os.WriteFile("${file}", body, 0644) // simpan file media
		fmt.Println("Tersimpan: ${file}")
	}
}`;
      case 'Ruby': return `require "net/http"
require "json"

res = Net::HTTP.get_response(URI("${url}"))

if res["content-type"].to_s.include?("application/json")
  puts JSON.pretty_generate(JSON.parse(res.body))
else
  File.binwrite("${file}", res.body) # simpan file media
  puts "Tersimpan: ${file}"
end`;
      case 'Java': return `import java.net.URI;
import java.net.http.*;
import java.nio.file.*;

public class Main {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest req = HttpRequest.newBuilder(URI.create("${url}")).GET().build();
        HttpResponse<byte[]> res = client.send(req, HttpResponse.BodyHandlers.ofByteArray());
        String type = res.headers().firstValue("content-type").orElse("");

        if (type.contains("application/json")) {
            System.out.println(new String(res.body()));
        } else {
            Files.write(Path.of("${file}"), res.body()); // simpan file media
            System.out.println("Tersimpan: ${file}");
        }
    }
}`;
      case 'Dart': return `// dart pub add http
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

void main() async {
  final res = await http.get(Uri.parse("${url}"));
  final type = res.headers['content-type'] ?? '';

  if (type.contains('application/json')) {
    print(jsonDecode(res.body));
  } else {
    await File('${file}').writeAsBytes(res.bodyBytes); // simpan file media
    print('Tersimpan: ${file}');
  }
}`;
    }
    return '';
  }

  // ---------------------------------------------------------------- try it
  let blobs = [];
  function revokeBlobs() { blobs.forEach(u => URL.revokeObjectURL(u)); blobs = []; }

  async function run() {
    const btn = $('#tryBtn');
    const box = $('#response');
    const v = values();
    const fileInput = current.upload && $('#file-' + CSS.escape(current.upload.param));
    const file = fileInput && fileInput.files[0];
    const missing = current.params.filter(p => p.required && !v[p.name] && !(file && current.upload.param === p.name));
    if (missing.length) { toast(`Isi dulu: ${missing.map(p => p.name).join(', ')}`); return; }

    revokeBlobs();
    btn.disabled = true; btn.textContent = '⏳ Memanggil…';
    box.innerHTML = '<div class="loading"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    const started = performance.now();
    try {
      let res;
      if (file) {
        const q = { ...v, apikey: KEY }; delete q[current.upload.param];
        const qs = new URLSearchParams(q).toString();
        res = await fetch(current.path + '?' + qs, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      } else {
        res = await fetch(buildUrl(v));
      }
      const ms = Math.round(performance.now() - started);
      const type = (res.headers.get('content-type') || '').split(';')[0];
      const head = (size, extra = '') => `<div class="resp-head"><span class="badge ${res.ok ? 'ok' : 'bad'}">${res.status} ${res.ok ? 'OK' : 'ERROR'}</span><span class="badge">${esc(type || 'unknown')}</span><span class="badge">${ms} ms</span><span class="badge">${fmtSize(size)}</span><span class="spacer"></span>${extra}</div>`;

      if (/json/.test(type)) {
        const text = await res.text();
        let data; try { data = JSON.parse(text); } catch { data = text; }
        const pretty = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        const found = typeof data === 'object' ? collectMedia(data) : [];
        box.innerHTML = head(text.length, '<button class="btn btn-sm" data-copy-target="respJson">Salin JSON</button>') +
          `<div class="resp-body"><pre id="respJson">${typeof data === 'string' ? esc(data) : highlight(pretty)}</pre>${found.length ? `<div class="section-title">🎁 Media di dalam respons (${found.length})</div><div class="media-found">${found.slice(0, 8).map(mediaCard).join('')}</div>` : ''}</div>`;
        $('#respJson').dataset.raw = pretty;
      } else if (/^(image|video|audio)\//.test(type) || /octet-stream|pdf|zip/.test(type)) {
        const blob = await res.blob();
        const src = URL.createObjectURL(blob); blobs.push(src);
        const ext = (type.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace('mpeg', 'mp3').replace(/[^a-z0-9]/gi, '').slice(0, 5);
        const dl = `<a class="btn btn-sm btn-green" href="${src}" download="api-zero.${ext}">⬇ Download</a>`;
        let el;
        if (type.startsWith('image/')) el = `<img src="${src}" alt="Hasil gambar">`;
        else if (type.startsWith('video/')) el = `<video src="${src}" controls playsinline></video>`;
        else if (type.startsWith('audio/')) el = `<audio src="${src}" controls></audio>`;
        else el = `<div class="placeholder">File ${esc(type)} siap diunduh.</div>`;
        box.innerHTML = head(blob.size, dl) + `<div class="resp-body">${el}</div>`;
      } else {
        const text = await res.text();
        box.innerHTML = head(text.length, '<button class="btn btn-sm" data-copy-target="respJson">Salin</button>') + `<div class="resp-body"><pre id="respJson">${esc(text.slice(0, 20000))}</pre></div>`;
      }
    } catch (e) {
      box.innerHTML = `<div class="resp-head"><span class="badge bad">GAGAL</span></div><div class="resp-body"><div class="placeholder">😵 Request gagal: ${esc(e.message || e)}</div></div>`;
    } finally {
      btn.disabled = false; btn.textContent = '▶ Coba sekarang';
    }
  }

  function fmtSize(n) { return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`; }

  function highlight(json) {
    return esc(json).replace(/(&quot;(?:\\u[a-fA-F0-9]{4}|\\[^u]|(?!&quot;).)*?&quot;)(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (m, str, colon, bool) => {
      if (str) {
        if (colon) return `<span class="j-key">${str}</span>${colon}`;
        const inner = str.slice(6, -6);
        if (/^https?:\/\//.test(inner)) return `<span class="j-str">&quot;<a href="${inner}" target="_blank" rel="noopener">${inner}</a>&quot;</span>`;
        return `<span class="j-str">${str}</span>`;
      }
      if (bool) return `<span class="j-bool">${m}</span>`;
      if (m === 'null') return `<span class="j-null">${m}</span>`;
      return `<span class="j-num">${m}</span>`;
    });
  }

  // Find media URLs anywhere in a JSON answer.
  function collectMedia(obj, keyHint = '', out = [], seen = new Set()) {
    if (out.length > 20) return out;
    if (typeof obj === 'string') {
      if (/^https?:\/\//.test(obj) && !seen.has(obj)) {
        const kind = kindOf(obj, keyHint);
        if (kind) { seen.add(obj); out.push({ url: obj, kind }); }
      }
    } else if (Array.isArray(obj)) obj.forEach(v => collectMedia(v, keyHint, out, seen));
    else if (obj && typeof obj === 'object') Object.entries(obj).forEach(([k, v]) => collectMedia(v, k, out, seen));
    return out;
  }
  function kindOf(url, key) {
    const m = url.match(MEDIA_RE);
    const ext = m ? m[1].toLowerCase() : '';
    if (/^(jpe?g|png|gif|webp|bmp|svg)$/.test(ext)) return 'image';
    if (/^(mp4|webm|mov|mkv|m3u8)$/.test(ext)) return 'video';
    if (/^(mp3|m4a|ogg|opus|wav|aac|flac)$/.test(ext)) return 'audio';
    const k = key.toLowerCase();
    if (/thumb|cover|image|img|photo|avatar|icon|picture|poster/.test(k)) return 'image';
    if (/video|nowm|hd|play|mp4|wm/.test(k)) return 'video';
    if (/audio|music|mp3|sound/.test(k)) return 'audio';
    return null;
  }
  function mediaCard(m) {
    const u = esc(m.url);
    const el = m.kind === 'image' ? `<img src="${u}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : m.kind === 'video' ? `<video src="${u}" controls playsinline preload="metadata"></video>`
      : `<audio src="${u}" controls preload="none"></audio>`;
    return `<div class="mf"><div class="mf-head"><span class="tag tag-${m.kind}">${m.kind}</span><a href="${u}" target="_blank" rel="noopener">${u}</a><button class="btn btn-sm" data-copy="${u}">Salin</button></div>${el}</div>`;
  }
})();
