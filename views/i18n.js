// Website translation: Indonesian (as written in the pages) or English.
// The choice ("Terjemahan" in the menu) is remembered in this browser. English text comes from
// /assets/i18n-en.json: "exact" maps a piece of page text to its English version, "patterns" are
// [regex, replacement] pairs for text with numbers or names in it. Each text node and the
// placeholder / title / aria-label / alt of elements is looked up on its own, also when the page
// changes it later. Endpoint names, descriptions, paths, code and API results are never translated:
// they are not in the dictionary, and anything inside [data-no-i18n], code, pre or textarea is skipped.
(() => {
  if (window.YannzI18n) return;
  const KEY = 'yannz-lang';
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP = 'script,style,code,pre,textarea,svg,[data-no-i18n],[contenteditable=""],[contenteditable=true]';
  let lang = 'id';
  try { lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'id'; } catch {}

  // Dates the pages format as Indonesian ('id-ID') come out in English while English is chosen.
  for (const fn of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']) {
    const orig = Date.prototype[fn];
    Date.prototype[fn] = function (locale, ...rest) {
      if (lang === 'en' && (locale === 'id-ID' || locale === 'id')) locale = 'en-GB';
      return orig.call(this, locale, ...rest);
    };
  }

  let dict = null;          // { exact: Map, patterns: [[RegExp, string]] }
  let dictPromise = null;
  const original = new WeakMap();    // text node -> Indonesian text
  const shown = new WeakMap();       // text node -> text we put there
  const attrOriginal = new WeakMap(); // element -> { attr: Indonesian }
  const norm = s => s.replace(/\s+/g, ' ').trim();

  // Hide the page for a moment while the English dictionary loads, so Indonesian doesn't flash.
  const root = document.documentElement;
  const hideStyle = document.createElement('style');
  hideStyle.textContent = 'html.i18n-pending body{visibility:hidden}';
  document.head.append(hideStyle);
  if (lang === 'en') { root.classList.add('i18n-pending'); setTimeout(() => root.classList.remove('i18n-pending'), 1500); }

  function loadDict() {
    if (dict) return Promise.resolve(dict);
    if (!dictPromise) {
      dictPromise = fetch('/assets/i18n-en.json?v=1', { credentials: 'same-origin' })
        .then(r => (r.ok ? r.json() : { exact: {}, patterns: [] }))
        .catch(() => ({ exact: {}, patterns: [] }))
        .then(d => {
          const exact = new Map();
          for (const [k, v] of Object.entries(d.exact || {})) exact.set(norm(k), v);
          const patterns = [];
          for (const [re, to] of d.patterns || []) { try { patterns.push([new RegExp(re), to]); } catch {} }
          dict = { exact, patterns };
          return dict;
        });
    }
    return dictPromise;
  }

  function english(text) {
    const key = norm(text);
    if (!key || !dict) return null;
    const hit = dict.exact.get(key);
    if (hit != null) return hit;
    for (const [re, to] of dict.patterns) {
      if (re.test(key)) {
        // Captured parts may themselves be known phrases (e.g. a status word).
        return key.replace(re, to).replace(/\{\{([^}]*)\}\}/g, (_, inner) => dict.exact.get(norm(inner)) ?? inner);
      }
    }
    return null;
  }
  const skipped = el => !el || !!el.closest?.(SKIP);

  function textNode(node) {
    const cur = node.nodeValue;
    if (!cur || !cur.trim()) return;
    // The page wrote new text into the node since we last touched it: that is the new original.
    if (!original.has(node) || shown.get(node) !== cur) original.set(node, cur);
    const src = original.get(node);
    let next = src;
    if (lang === 'en') {
      const en = english(src);
      if (en != null) next = src.match(/^\s*/)[0] + en + src.match(/\s*$/)[0];
    }
    shown.set(node, next);
    if (cur !== next) node.nodeValue = next;
  }

  function attrs(el) {
    let saved = attrOriginal.get(el);
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const cur = el.getAttribute(a);
      if (!saved) { saved = {}; attrOriginal.set(el, saved); }
      if (!(a in saved) || saved['__shown_' + a] !== cur) saved[a] = cur;
      const en = lang === 'en' ? english(saved[a]) : null;
      const next = en != null ? en : saved[a];
      saved['__shown_' + a] = next;
      if (cur !== next) el.setAttribute(a, next);
    }
  }

  function walk(rootNode) {
    if (!rootNode) return;
    if (rootNode.nodeType === 3) { if (!skipped(rootNode.parentElement)) textNode(rootNode); return; }
    if (rootNode.nodeType !== 1 && rootNode.nodeType !== 9 && rootNode.nodeType !== 11) return;
    if (rootNode.nodeType === 1 && skipped(rootNode)) return;
    if (rootNode.nodeType === 1) attrs(rootNode);
    const tw = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (n.nodeType === 3) textNode(n); else attrs(n); }
  }

  let titleOriginal = null, titleShown = null;
  function title() {
    if (titleOriginal == null || document.title !== titleShown) titleOriginal = document.title;
    const en = lang === 'en' ? english(titleOriginal) : null;
    titleShown = en != null ? en : titleOriginal;
    if (document.title !== titleShown) document.title = titleShown;
  }

  let observer = null;
  function observe() {
    if (observer || !document.body) return;
    observer = new MutationObserver(list => {
      if (!dict && lang === 'en') return;
      observer.disconnect();
      for (const m of list) {
        if (m.type === 'characterData') { if (!skipped(m.target.parentElement)) textNode(m.target); }
        else if (m.type === 'attributes') { if (!skipped(m.target)) attrs(m.target); }
        else m.addedNodes.forEach(walk);
      }
      title();
      connect();
    });
    connect();
  }
  function connect() { observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS }); }

  function renderSwitches() {
    document.querySelectorAll('[data-lang-switch]').forEach(box => {
      if (!box.dataset.ready) {
        box.dataset.ready = '1';
        box.classList.add('lang-switch');
        box.setAttribute('data-no-i18n', '');
        box.innerHTML = '<span class="lang-switch-label">Terjemahan</span><span class="lang-switch-opts" role="group" aria-label="Terjemahan / Language">' +
          '<button type="button" data-lang-set="id" lang="id">Indonesia</button><button type="button" data-lang-set="en" lang="en">English</button></span>';
      }
      box.querySelector('.lang-switch-label').textContent = lang === 'en' ? 'Language' : 'Terjemahan';
      box.querySelectorAll('[data-lang-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.langSet === lang)));
    });
  }

  async function apply() {
    root.lang = lang;
    if (lang === 'en') await loadDict();
    if (observer) observer.disconnect();
    walk(document.body);
    title();
    renderSwitches();
    if (observer) connect(); else observe();
    root.classList.remove('i18n-pending');
    window.dispatchEvent(new CustomEvent('yannz:lang', { detail: { lang } }));
  }

  async function set(next) {
    lang = next === 'en' ? 'en' : 'id';
    try { localStorage.setItem(KEY, lang); } catch {}
    await apply();
  }

  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-lang-set]');
    if (b) { e.preventDefault(); set(b.dataset.langSet); }
  });

  const css = document.createElement('style');
  css.textContent = `.lang-switch{display:inline-flex;align-items:center;gap:8px;font:500 10px 'DM Mono',ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase}
  .lang-switch-label{color:var(--muted,#a1a1aa)}
  .lang-switch-opts{display:inline-flex;border:2px solid var(--edge,#d4d4d8);border-radius:999px;overflow:hidden}
  .lang-switch-opts button{margin:0;padding:5px 9px;border:0;border-radius:0;background:transparent;color:inherit;font:inherit;letter-spacing:inherit;text-transform:inherit;box-shadow:none;cursor:pointer}
  .lang-switch-opts button[aria-pressed=true]{background:var(--accent,#c8202f);color:#fff}
  .lang-switch-opts button:focus-visible{outline:2px solid currentColor;outline-offset:-3px}`;
  document.head.append(css);

  window.YannzI18n = { get lang() { return lang; }, set, t: s => (lang === 'en' && english(s)) || s };
  const start = () => { apply(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
