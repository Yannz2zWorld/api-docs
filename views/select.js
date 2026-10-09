// Yannz API — modern menus for every <select> on the page (including ones added later).
// The native <select> stays in the DOM, hidden, as the source of truth: forms, FormData,
// `select.value = …`, `change` listeners and validation keep working unchanged. The menu opens
// as a bottom sheet on phones and as a popover on larger screens; long lists get a search box
// and keep their <optgroup> sections. Options written "Name — detail" show the detail as a
// second line.
(function () {
  'use strict';
  if (window.__yannzSelect) return;
  window.__yannzSelect = true;

  const css = `
  .ys-native{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;margin:0!important;padding:0!important;border:0!important}
  .ys-trigger{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:44px;padding:10px 14px;border:2px solid var(--edge-soft,#3f3f46);border-radius:10px;background:var(--surface-2,#1b1b1e);color:var(--ink,#f4f4f5);font:500 14px/1.3 Outfit,system-ui,sans-serif;text-align:left;cursor:pointer;box-shadow:none;text-transform:none;letter-spacing:0;transition:border-color .15s,box-shadow .15s,background .15s}
  .ys-trigger:hover,.ys-trigger:active{border-color:#52525b;transform:none;box-shadow:none;background:var(--surface-2,#1b1b1e);color:var(--ink,#f4f4f5)}
  .ys-trigger.ys-wide{width:100%}
  .ys-trigger:not(.ys-wide){width:auto;min-width:150px;max-width:100%}
  .field .ys-trigger,label>.ys-trigger,.ep-new .ys-trigger{width:100%}
  .ys-trigger:focus-visible,.ys-trigger[aria-expanded="true"]{outline:none;border-color:var(--edge,#d4d4d8);box-shadow:3px 3px 0 var(--drop,#3f3f46);background:var(--surface-3,#232327)}
  .ys-trigger:disabled{opacity:.5;cursor:not-allowed}
  .ys-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ys-label small{color:var(--muted,#a1a1aa);font:500 12px "DM Mono",monospace;margin-left:6px}
  .ys-chev{flex:none;width:18px;height:18px;transition:transform .2s}
  .ys-trigger[aria-expanded="true"] .ys-chev{transform:rotate(180deg)}
  .ys-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);animation:ys-fade .15s ease}
  .ys-panel{position:fixed;z-index:1001;display:flex;flex-direction:column;background:var(--surface,#141416);color:var(--ink,#f4f4f5);border:2px solid var(--edge,#d4d4d8);box-shadow:6px 6px 0 var(--drop,#3f3f46);overflow:hidden}
  .ys-panel.pop{border-radius:12px;max-height:min(380px,60vh);animation:ys-pop .14s ease}
  .ys-panel.sheet{left:0;right:0;bottom:0;max-height:78vh;border-radius:18px 18px 0 0;border-bottom:0;box-shadow:0 -8px 30px rgba(0,0,0,.5);animation:ys-up .22s cubic-bezier(.2,.8,.2,1);padding-bottom:env(safe-area-inset-bottom)}
  .ys-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px 8px}
  .ys-head b{font:700 16px "Space Grotesk",sans-serif}
  .ys-grip{width:42px;height:4px;border-radius:9px;background:#52525b;margin:8px auto 0}
  .ys-x,.ys-x:hover,.ys-x:active{border:0;background:transparent;color:var(--muted,#a1a1aa);font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;box-shadow:none;transform:none}
  .ys-search{margin:6px 12px 8px;padding:10px 12px;border:2px solid var(--edge-soft,#3f3f46);border-radius:10px;background:var(--bg,#0b0b0c);color:var(--ink,#f4f4f5);font:14px Outfit,sans-serif}
  .ys-search:focus{outline:none;border-color:var(--edge,#d4d4d8)}
  .ys-list{overflow-y:auto;overscroll-behavior:contain;padding:4px 6px 8px;margin:0;list-style:none}
  .ys-group{position:sticky;top:0;z-index:1;margin:6px 6px 2px;padding:6px 8px;border-radius:8px;background:var(--surface-3,#232327);font:700 10px "DM Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#a1a1aa);display:flex;justify-content:space-between}
  .ys-opt{display:flex;align-items:center;gap:10px;padding:11px 12px;margin:2px 0;border-radius:10px;cursor:pointer;font:500 14px/1.3 Outfit,sans-serif}
  .ys-opt span{min-width:0;flex:1}
  .ys-opt small{display:block;color:var(--muted,#a1a1aa);font:500 11.5px "DM Mono",monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
  .ys-opt:hover,.ys-opt.active{background:var(--surface-2,#1b1b1e)}
  .ys-opt[aria-selected="true"]{background:rgba(200,32,47,.16);box-shadow:inset 3px 0 0 var(--accent,#c8202f)}
  .ys-opt[aria-disabled="true"]{opacity:.4;cursor:not-allowed}
  .ys-check{flex:none;width:18px;height:18px;color:var(--accent,#c8202f);visibility:hidden}
  .ys-opt[aria-selected="true"] .ys-check{visibility:visible}
  .ys-empty{padding:18px;text-align:center;color:var(--muted,#a1a1aa);font:13px Outfit,sans-serif}
  @keyframes ys-fade{from{opacity:0}}
  @keyframes ys-pop{from{opacity:0;transform:translateY(-6px)}}
  @keyframes ys-up{from{transform:translateY(100%)}}
  @media (prefers-reduced-motion:reduce){.ys-panel,.ys-backdrop{animation:none}}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const CHEV = '<svg class="ys-chev" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>';
  const CHECK = '<svg class="ys-check" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="m5 12 5 5 9-10"/></svg>';
  const SEARCH_FROM = 8;
  const isSheet = () => matchMedia('(max-width: 640px)').matches;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const split = text => { const i = text.indexOf(' — '); return i > 0 ? [text.slice(0, i), text.slice(i + 3)] : [text, '']; };
  let uid = 0;

  function labelFor(select) {
    if (select.getAttribute('aria-label')) return select.getAttribute('aria-label');
    if (select.id) { const l = document.querySelector(`label[for="${CSS.escape(select.id)}"]`); if (l) return l.textContent.trim(); }
    const wrap = select.closest('label');
    if (wrap) return (wrap.querySelector('span') || wrap).textContent.replace(/\s+/g, ' ').trim();
    return 'Pilih';
  }

  // A select marked data-no-i18n (e.g. the endpoint picker) holds data: the option text copied out of
  // it is never translated either. The widget's own UI text (search, "no matches") still is.
  const keep = (select, node) => { if (select.closest('[data-no-i18n]')) node.setAttribute('data-no-i18n', ''); return node; };

  function enhance(select) {
    if (select.__ys || select.multiple || (select.size && select.size > 1) || select.closest('[data-native-select]')) return;
    const id = 'ys' + (++uid);
    const trigger = el('button', 'ys-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const label = el('span', 'ys-label');
    keep(select, label);
    trigger.append(label);
    trigger.insertAdjacentHTML('beforeend', CHEV);
    // Keep the select's size: full width where it filled its container, else its own width.
    const parentWidth = select.parentElement ? select.parentElement.clientWidth : 0;
    if (select.offsetWidth && parentWidth && select.offsetWidth >= parentWidth - 4) trigger.classList.add('ys-wide');
    else if (select.offsetWidth) trigger.style.minWidth = select.offsetWidth + 'px';
    if (/100%/.test(select.style.width) || getComputedStyle(select).width === '100%') trigger.classList.add('ys-wide');
    if (select.style.width) trigger.style.width = select.style.width;
    if (select.style.flex) trigger.style.flex = select.style.flex;
    if (select.style.minWidth) trigger.style.minWidth = select.style.minWidth;
    select.after(trigger);
    select.classList.add('ys-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const refresh = () => {
      const opt = select.options[select.selectedIndex];
      const [main, sub] = split(opt ? opt.textContent : '');
      label.textContent = main || '—';
      if (sub) { const s = el('small', '', sub); label.append(s); }
      trigger.disabled = select.disabled;
      trigger.setAttribute('aria-label', `${labelFor(select)}: ${opt ? opt.textContent : '—'}`);
    };
    // Programmatic `select.value = …` / selectedIndex do not fire events: watch them.
    for (const prop of ['value', 'selectedIndex']) {
      const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
      Object.defineProperty(select, prop, { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); refresh(); } });
    }
    select.addEventListener('change', refresh);
    select.form?.addEventListener('reset', () => setTimeout(refresh));
    new MutationObserver(refresh).observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'selected', 'hidden', 'label'] });   // characterData: option text changed by the translator
    trigger.addEventListener('click', () => open(select, trigger, id));
    trigger.addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); open(select, trigger, id); } });
    if (select.id) document.querySelectorAll(`label[for="${CSS.escape(select.id)}"]`).forEach(l => l.addEventListener('click', e => { e.preventDefault(); trigger.focus(); }));
    select.__ys = { trigger, refresh };
    refresh();
  }

  let current = null;
  function close(focusBack = true) {
    if (!current) return;
    const { backdrop, panel, trigger, onKey, onScroll, onOutside } = current;
    backdrop?.remove(); panel.remove();
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', onScroll); window.removeEventListener('scroll', onScroll, true);
    current = null;
    if (focusBack) trigger.focus();
  }

  function open(select, trigger, id) {
    if (current) { const same = current.select === select; close(false); if (same) return; }
    if (select.disabled) return;
    const sheet = isSheet();
    const host = select.closest('dialog[open]') || document.body;   // stay above a modal dialog
    const panel = el('div', 'ys-panel ' + (sheet ? 'sheet' : 'pop'));
    let backdrop = null;
    if (sheet) { backdrop = el('div', 'ys-backdrop'); backdrop.addEventListener('click', () => close()); host.append(backdrop); panel.append(el('div', 'ys-grip')); }
    const head = el('div', 'ys-head');
    head.append(el('b', '', labelFor(select)));
    const x = el('button', 'ys-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Tutup'); x.addEventListener('click', () => close());
    head.append(x);
    if (sheet) panel.append(head);

    const all = [...select.options].filter(o => !o.hidden);
    let search = null;
    if (all.length >= SEARCH_FROM) {
      search = el('input', 'ys-search'); search.type = 'search'; search.placeholder = 'Cari…'; search.setAttribute('aria-label', 'Cari pilihan'); search.autocomplete = 'off';
      panel.append(search);
    }
    const list = el('ul', 'ys-list');
    list.id = id; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', labelFor(select));
    panel.append(list);
    host.append(panel);
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-controls', id);

    let rows = [];
    let active = -1;
    function render(q = '') {
      list.replaceChildren(); rows = [];
      const needle = q.trim().toLowerCase();
      let lastGroup = null;
      for (const o of all) {
        if (needle && !o.textContent.toLowerCase().includes(needle) && !o.value.toLowerCase().includes(needle)) continue;
        const group = o.parentElement.tagName === 'OPTGROUP' ? o.parentElement : null;
        if (group && group !== lastGroup) {
          const count = [...group.children].filter(c => !c.hidden).length;
          const g = el('li', 'ys-group'); g.setAttribute('role', 'presentation');
          g.append(keep(select, el('span', '', group.label)), el('span', '', String(count)));
          list.append(g);
        }
        lastGroup = group;
        const [main, sub] = split(o.textContent);
        const li = el('li', 'ys-opt'); li.setAttribute('role', 'option'); li.id = id + '-' + rows.length;
        li.setAttribute('aria-selected', String(o.selected));
        if (o.disabled) li.setAttribute('aria-disabled', 'true');
        const text = keep(select, el('span', '', main || '—'));
        if (sub) text.append(el('small', '', sub));
        li.append(text); li.insertAdjacentHTML('beforeend', CHECK);
        li.addEventListener('click', () => choose(o));
        li.addEventListener('mousemove', () => setActive(rows.indexOf(li)));
        list.append(li); rows.push(li); li.__opt = o;
      }
      if (!rows.length) list.append(el('li', 'ys-empty', 'Nggak ada yang cocok.'));
      setActive(Math.max(0, rows.findIndex(r => r.__opt.selected)), true);
    }
    function setActive(i, scroll) {
      rows[active]?.classList.remove('active');
      active = Math.min(Math.max(i, 0), rows.length - 1);
      const r = rows[active];
      if (!r) return;
      r.classList.add('active');
      (search || list).setAttribute('aria-activedescendant', r.id);
      if (scroll) r.scrollIntoView({ block: 'nearest' });
    }
    function choose(o) {
      if (o.disabled) return;
      const changed = !o.selected;
      o.selected = true;
      close();
      select.__ys.refresh();
      if (changed) { select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    function place() {
      if (sheet) return;
      const r = trigger.getBoundingClientRect();
      const width = Math.max(r.width, 240);
      const left = Math.min(Math.max(8, r.left), innerWidth - width - 8);
      panel.style.width = width + 'px';
      panel.style.left = left + 'px';
      const below = innerHeight - r.bottom - 12;
      if (below < 220 && r.top > below) { panel.style.top = ''; panel.style.bottom = (innerHeight - r.top + 6) + 'px'; panel.style.maxHeight = Math.min(380, r.top - 16) + 'px'; }
      else { panel.style.bottom = ''; panel.style.top = (r.bottom + 6) + 'px'; panel.style.maxHeight = Math.min(380, below) + 'px'; }
    }
    render();
    place();
    search?.addEventListener('input', () => render(search.value));

    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1, true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1, true); }
      else if (e.key === 'Home' && !search) { e.preventDefault(); setActive(0, true); }
      else if (e.key === 'End' && !search) { e.preventDefault(); setActive(rows.length - 1, true); }
      else if (e.key === 'Enter' && rows[active]) { e.preventDefault(); choose(rows[active].__opt); }
      else if (e.key === 'Tab') close(false);
    };
    const onScroll = e => { if (!sheet && !panel.contains(e.target)) place(); };
    const onOutside = e => { if (current && !panel.contains(e.target) && !trigger.contains(e.target)) close(false); };
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onScroll); window.addEventListener('scroll', onScroll, true);
    document.addEventListener('pointerdown', onOutside, true);
    current = { select, trigger, panel, backdrop, onKey, onScroll, onOutside };
    // Desktop: type to search right away. Phones: focus the list, so the keyboard does not pop up.
    if (search && !sheet) search.focus();
    else { list.tabIndex = -1; list.focus({ preventScroll: true }); }
  }

  function scan(root) {
    if (root.tagName === 'SELECT') enhance(root);
    root.querySelectorAll?.('select').forEach(enhance);
  }
  scan(document);
  new MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
