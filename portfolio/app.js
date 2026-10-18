(() => {
  const DATA_EL = document.getElementById('pf-data');
  const fill = s => ({ look: {}, labels: {}, socials: {}, projects: [], stats: [], journey: [], services: [], skills: '', intro: '', process: [], tools: [], games: [], specs: [], principles: '', testimonials: [], faq: [], now: [], ...s });
  const saved = () => fill(JSON.parse(DATA_EL.textContent));
  let state = saved();
  const root = document.documentElement, app = document.getElementById('app');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const HEX = /^#[0-9a-f]{6}$/i;
  const okUrl = u => { u = String(u || '').trim(); return /^https?:\/\/[^\s"'<>]+$/i.test(u) || /^\/_blob\/[a-z0-9]+$/i.test(u) ? u : ''; };
  const handle = v => String(v || '').trim().replace(/^@/, '');
  const inkOn = hex => { const n = parseInt(hex.slice(1), 16), l = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * l(n >> 16) + .7152 * l((n >> 8) & 255) + .0722 * l(n & 255) > .4 ? '#111111' : '#ffffff'; };
  const L = (k, d) => String(state.labels?.[k] ?? '').trim() || d;
  const list = v => String(v || '').split(',').map(t => t.trim()).filter(Boolean);
  const pad2 = n => String(n).padStart(2, '0');
  // "Karya pilihan" -> KARYA + serif-italic "pilihan"
  const title = t => { const w = esc(t).trim().split(/\s+/); const last = w.pop(); return (w.length ? w.join(' ') + ' ' : '') + `<em>${last}</em>`; };
  // *text* in the tagline becomes serif italic
  const rich = t => esc(t).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- looks (Custom UI)
  const BASES = {
    abu:    { name: 'Abu',    dark: ['#0e0e10', '#18181b', '#222226', '#f2f2f2', '#a3a3aa'], light: ['#ececec', '#f8f8f8', '#e2e2e2', '#121212', '#55555c'] },
    arang:  { name: 'Arang',  dark: ['#060606', '#121212', '#1c1c1c', '#f5f5f5', '#9d9d9d'], light: ['#f4f4f4', '#ffffff', '#e9e9e9', '#0b0b0b', '#4d4d4d'] },
    grafit: { name: 'Grafit', dark: ['#15181c', '#1d2126', '#272c32', '#eef1f4', '#a2aab3'], light: ['#e5e8ec', '#f7f8fa', '#dde1e6', '#14171b', '#4f5862'] },
    kopi:   { name: 'Kopi',   dark: ['#120f0c', '#1c1814', '#26211c', '#f3eee8', '#aea395'], light: ['#eeeae4', '#fbf8f4', '#e4ded6', '#1a1612', '#5c5348'] }
  };
  const ACCENTS = ['#d6d6d6', '#ffffff', '#9ca3af', '#6b7280', '#e3c766', '#8fcfb3', '#8fb3e3', '#e3a3b3', '#c3a8e3'];
  let mine = {};   // this visitor's own Custom UI choice, kept in their browser
  try { mine = JSON.parse(localStorage.getItem('yannz-pf-look') || '{}') || {}; } catch {}
  const keepMine = () => { try { localStorage.setItem('yannz-pf-look', JSON.stringify(mine)); } catch {} };
  const look = () => {
    const d = state.look || {};
    const base = BASES[mine.base] ? mine.base : BASES[d.base] ? d.base : 'abu';
    const accent = HEX.test(mine.accent || '') ? mine.accent : HEX.test(d.accent || '') ? d.accent : '#d6d6d6';
    const mode = mine.mode === 'light' || mine.mode === 'dark' ? mine.mode : d.mode === 'light' ? 'light' : 'dark';
    const pick = (k, opts, def) => opts.includes(mine[k]) ? mine[k] : opts.includes(d[k]) ? d[k] : def;
    return { base, accent, mode, fx: pick('fx', FX_KEYS, 'halus'), type: pick('type', TYPE_KEYS, 'sinema'), corner: pick('corner', CORNER_KEYS, 'bulat'), motion: pick('motion', MOTION_KEYS, 'penuh'), q: pick('q', Q_KEYS, 'auto') };
  };
  // extra Custom UI choices: [key, label]
  const FX = [['mati', 'Mati'], ['halus', 'Halus'], ['sedang', 'Sedang'], ['kuat', 'Kuat']], FX_KEYS = FX.map(x => x[0]);
  const TYPES = [['sinema', 'Sinematik'], ['klasik', 'Klasik'], ['modern', 'Modern']], TYPE_KEYS = TYPES.map(x => x[0]);
  const CORNERS = [['bulat', 'Bulat'], ['tajam', 'Tajam']], CORNER_KEYS = CORNERS.map(x => x[0]);
  const MOTIONS = [['penuh', 'Penuh'], ['kalem', 'Kalem']], MOTION_KEYS = MOTIONS.map(x => x[0]);
  const QS = [['auto', 'Otomatis'], ['low', 'Rendah'], ['medium', 'Sedang'], ['high', 'Tinggi'], ['ultra', 'Ultra']], Q_KEYS = QS.map(x => x[0]);
  const FX_AMT = { mati: 0, halus: .6, sedang: 1, kuat: 1.5 };
  const calm = () => still || root.dataset.motion === 'kalem';
  function applyLook() {
    const { base, accent, mode, fx, type, corner, motion } = look();
    Object.assign(root.dataset, { fx, type, corner, motion });
    const [bg, paper, paper2, ink, muted] = BASES[base][mode];
    if (mode === 'light') root.dataset.mode = 'light'; else delete root.dataset.mode;
    const set = (k, v) => root.style.setProperty(k, v);
    set('--bg', bg); set('--paper', paper); set('--paper-2', paper2); set('--ink', ink); set('--muted', muted); set('--edge', ink);
    set('--accent', accent);
    set('--on-accent', inkOn(accent));
  }
  const css = k => getComputedStyle(root).getPropertyValue('--' + k).trim() || '#888888';

  // Each social: accepts a full link or just the username / number.
  const waNum = v => v.replace(/\D/g, '').replace(/^0/, '62');
  const SOCIAL = {
    whatsapp: { name: 'WhatsApp', url: v => /^https?:/i.test(v) ? okUrl(v) : (waNum(v) ? 'https://wa.me/' + waNum(v) : ''), icon: '<path d="M12 2.2a9.7 9.7 0 0 0-8.3 14.8L2.4 21.8l4.9-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.6a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 19.8Zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.7c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.4-.2Z" fill="currentColor"/>' },
    telegram: { name: 'Telegram', url: v => /^https?:/i.test(v) ? okUrl(v) : (handle(v) ? 'https://t.me/' + encodeURIComponent(handle(v)) : ''), icon: '<path d="M21.5 4.3 18.4 19c-.2 1-.8 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.7-7.9c.4-.3-.1-.5-.6-.2L6.4 12.9 1.8 11.5c-1-.3-1-1 .2-1.5l18-6.9c.8-.3 1.6.2 1.5 1.2Z" fill="currentColor"/>' },
    instagram: { name: 'Instagram', url: v => /^https?:/i.test(v) ? okUrl(v) : (handle(v) ? 'https://instagram.com/' + encodeURIComponent(handle(v)) : ''), icon: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/>' },
    tiktok: { name: 'TikTok', url: v => /^https?:/i.test(v) ? okUrl(v) : (handle(v) ? 'https://www.tiktok.com/@' + encodeURIComponent(handle(v)) : ''), icon: '<path d="M16.6 2.5h-3.3v12.8a2.9 2.9 0 1 1-2.1-2.8V9.1a6.2 6.2 0 1 0 5.4 6.2V8.9a7.6 7.6 0 0 0 4.4 1.4V7a4.4 4.4 0 0 1-4.4-4.5Z" fill="currentColor"/>' },
    x: { name: 'X', url: v => /^https?:/i.test(v) ? okUrl(v) : (handle(v) ? 'https://x.com/' + encodeURIComponent(handle(v)) : ''), icon: '<path d="M17.8 2.8h3.3l-7.2 8.2 8.4 11.2h-6.6l-5.2-6.8-5.9 6.8H1.3L9 13.4.9 2.8h6.8l4.7 6.2 5.4-6.2Zm-1.2 17.4h1.8L6.6 4.7h-2l12 15.5Z" fill="currentColor"/>' }
  };
  const ICON = svg => `<svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>`;
  const SUN = '<circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  const MOON = '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
  const BRUSH = '<path d="M14.5 4.5 19.5 9.5 11 18l-5-5 8.5-8.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M6 13c-2 0-3 1.5-3 3.2 0 1.6-.6 2.6-1 2.8 3 .9 6.6.3 7.6-2.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
  const ARROW = '<path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  const socialLinks = s => Object.entries(SOCIAL).map(([k, m]) => { const raw = String(s.socials?.[k] || '').trim(); return { m, raw, href: m.url(raw) }; }).filter(x => x.href);
  const shown = s => s.projects.filter(p => !filter || String(p.category || '').trim() === filter);

  const CAR_BLACK = '#0c0c0e';   // default paint: deep black metallic
  const OBJ_COLORS = [CAR_BLACK, '#c9ccd1', '#f2f2f0', '#b3121f', '#1f4fa8', '#e0a91b', '#2f7a50'];
  let filter = '', lookOpen = false, objColor = '';

  function lookPanel() {
    const cur = look();
    return `<div class="look" ${lookOpen ? '' : 'hidden'} role="dialog" aria-label="Custom UI">
      <h3>Custom UI</h3>
      <div class="f"><span class="lbl">Mode</span><div class="choice">${[['dark', 'Gelap'], ['light', 'Terang']].map(([v, n]) => `<button class="chip" type="button" data-look="mode" data-v="${v}" aria-pressed="${cur.mode === v}">${n}</button>`).join('')}</div></div>
      <div class="f"><span class="lbl">Warna dasar</span><div class="choice">${Object.entries(BASES).map(([k, b]) => `<button class="chip" type="button" data-look="base" data-v="${k}" aria-pressed="${cur.base === k}"><i style="background:${b[cur.mode][0]}"></i>${b.name}</button>`).join('')}</div></div>
      <div class="f"><span class="lbl">Aksen</span><div class="swatches">${ACCENTS.map(c => `<button type="button" data-look="accent" data-v="${c}" style="background:${c}" aria-label="Aksen ${c}" aria-pressed="${cur.accent === c}"></button>`).join('')}</div></div>
      ${[['fx', 'Efek realistis', FX], ['q', 'Kualitas 3D', QS], ['type', 'Gaya huruf', TYPES], ['corner', 'Sudut', CORNERS], ['motion', 'Gerakan', MOTIONS]].map(([k, name, opts]) => `<div class="f"><span class="lbl">${name}</span><div class="choice">${opts.map(([v, n]) => `<button class="chip" type="button" data-look="${k}" data-v="${v}" aria-pressed="${cur[k] === v}">${n}</button>`).join('')}</div></div>`).join('')}
      <button class="linkish" type="button" data-look="reset">Pakai tampilan bawaan</button>
    </div>`;
  }

  const projCard = p => {
    const link = okUrl(p.link), img = okUrl(p.image), tech = list(p.tech);
    const mark = (p.title || '?').trim().split(/[\s_-]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `<article class="proj">
      <div class="cover">${img ? `<img src="${esc(img)}" alt="${esc(p.title)}">` : `<span aria-hidden="true">${esc(mark)}</span>`}</div>
      <div class="body">
        ${p.category || p.status ? `<div class="meta">${p.category ? `<span class="pill cat">${esc(p.category)}</span>` : ''}${p.status ? `<span class="pill">${esc(p.status)}</span>` : ''}</div>` : ''}
        <h3>${esc(p.title)}</h3>
        ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
        ${tech.length ? `<ul class="tech">${tech.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        ${link ? `<a class="go" href="${esc(link)}" target="_blank" rel="noopener">Lihat ${ICON(ARROW)}</a>` : ''}
      </div>
    </article>`;
  };
  const showHtml = items => `<div class="show-track" style="height:calc(${items.length} * 70vh + 30vh)">
    <div class="show-stick">
      <div class="show-stage"></div>
      <div class="show-side">
        <div class="show-info">${items.map((p, i) => {
          const link = okUrl(p.link), tech = list(p.tech);
          return `<article class="${i ? '' : 'on'}" aria-hidden="${i ? 'true' : 'false'}">
            <div class="meta">${p.category ? `<span class="pill cat">${esc(p.category)}</span>` : ''}${p.status ? `<span class="pill">${esc(p.status)}</span>` : ''}<span class="label" style="margin-left:auto">${pad2(i + 1)} / ${pad2(items.length)}</span></div>
            <h3>${esc(p.title)}</h3>
            ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
            ${tech.length ? `<ul class="tech">${tech.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
            ${link ? `<a class="go" href="${esc(link)}" target="_blank" rel="noopener" ${i ? 'tabindex="-1"' : ''}>Lihat ${ICON(ARROW)}</a>` : ''}
          </article>`; }).join('')}</div>
        <div class="show-nav"><span class="label">Scroll buat lihat karya</span><div class="show-dots">${items.map((p, i) => `<button type="button" data-act="go" data-i="${i}" aria-label="Karya ${i + 1}: ${esc(p.title)}" aria-current="${i ? 'false' : 'true'}"></button>`).join('')}</div></div>
      </div>
    </div></div>`;

  function page(s) {
    const initial = (s.name || '?').trim().charAt(0).toUpperCase();
    const photo = okUrl(s.photo);
    const links = socialLinks(s);
    const skills = list(s.skills);
    const cats = [...new Set(s.projects.map(p => String(p.category || '').trim()).filter(Boolean))];
    if (filter && !cats.includes(filter)) filter = '';
    const items = shown(s);
    const light = root.dataset.mode === 'light';
    let n = 0; const kick = name => `<div class="kicker"><b>${pad2(++n)}</b>${esc(name)}</div>`;
    const big = s.nickname || s.name;
    return `<div class="progress" aria-hidden="true"><i></i></div>
<header class="top"><div class="wrap bar">
    <a class="brand" href="#top">${esc(s.name)}<b>.</b></a>
    <nav class="nav" aria-label="Bagian halaman"><a href="#tentang">Tentang</a><a href="#karya">Karya</a><a href="#keahlian">Keahlian</a><a href="#perjalanan">Perjalanan</a><a href="#kontak">Kontak</a>
      <button class="icon-btn" type="button" data-act="look" aria-label="Custom UI" aria-expanded="${lookOpen}">${ICON(BRUSH)}</button>
      <button class="icon-btn" type="button" data-act="mode" aria-label="${light ? 'Ganti ke mode gelap' : 'Ganti ke mode terang'}">${ICON(light ? MOON : SUN)}</button></nav>
    ${lookPanel()}
</div></header>
<main id="top">
  <div class="mega" aria-hidden="true"><span>${esc(big)}</span></div>

  <section class="ch hero lift" data-pose="hero" aria-label="Perkenalan">
    <div class="wrap hero-grid">
      <div>
        ${s.status ? `<p class="eyebrow"><b></b>${esc(s.status)}</p>` : ''}
        <h1>${rich(s.tagline || ('Hai, aku ' + big))}</h1>
      </div>
      <div class="hero-side">
        <p>${esc(s.bio)}</p>
        ${links.length ? `<ul class="socials">${links.map(x => `<li><a class="soc" href="${esc(x.href)}" target="_blank" rel="noopener" aria-label="${esc(x.m.name)}">${ICON(x.m.icon)}</a></li>`).join('')}</ul>` : ''}
        <div class="cue mono"><i></i>Scroll ke bawah</div>
      </div>
    </div>
  </section>

  ${s.intro ? `<section class="ch intro lift" data-pose="intro" aria-label="Pembuka">
    <div class="wrap"><div class="half right">${kick('Pembuka')}</div>
      <p class="quote">${esc(s.intro).split(/\s+/).map(w => `<span>${w}</span>`).join(' ')}</p></div>
  </section>` : ''}

  ${s.stats.length ? `<section class="ch stats lift" data-pose="stats" aria-label="Dalam angka">
    <div class="wrap">${kick('Dalam angka')}
      <div class="stat-grid">${s.stats.map(x => `<div class="stat d3"><span class="num" data-v="${esc(x.value)}">${esc(x.value)}</span><span class="cap">${esc(x.label)}</span></div>`).join('')}</div></div>
  </section>` : ''}

  <section class="ch about" id="tentang" data-pose="about">
    <div class="wrap about-grid"><div class="about-col">
      ${kick(L('about', 'Tentang aku'))}
      <h2>${title(L('about', 'Tentang aku'))}</h2>
      <div class="portrait">
        <div class="photo d3">${photo ? `<img src="${esc(photo)}" alt="Foto ${esc(s.name)}">` : `<span aria-hidden="true">${esc(initial)}</span>`}</div>
        <p class="about-text">${esc(s.about)}</p>
      </div>
      <ul class="spec">
        <li><span class="label">Nama</span><b>${esc(s.name)}</b></li>
        ${s.location ? `<li><span class="label">Lokasi</span><b>${esc(s.location)}</b></li>` : ''}
        ${s.focus ? `<li><span class="label">Fokus</span><b>${esc(s.focus)}</b></li>` : ''}
        <li><span class="label">Karya</span><b>${s.projects.length} karya</b></li>
        ${s.status ? `<li><span class="label">Status</span><b>${esc(s.status)}</b></li>` : ''}
      </ul>
    </div></div>
  </section>

  ${skills.length ? `<div class="marquee" aria-hidden="true"><div class="mq">${[...skills, ...skills, ...skills, ...skills].map(k => `<span>${esc(k)}</span>`).join('')}</div></div>` : ''}

  <section class="ch work" id="karya" data-pose="work">
    <div class="wrap">
      ${kick(L('work', 'Karya pilihan'))}
      <h2>${title(L('work', 'Karya pilihan'))}</h2>
      ${cats.length > 1 ? `<div class="filters" role="group" aria-label="Saring kategori"><button class="chip" type="button" data-act="cat" data-c="" aria-pressed="${!filter}">Semua</button>${cats.map(c => `<button class="chip" type="button" data-act="cat" data-c="${esc(c)}" aria-pressed="${filter === c}">${esc(c)}</button>`).join('')}</div>` : ''}
      ${items.length && showcase ? showHtml(items) : items.length ? `<div class="projects">${items.map(projCard).join('')}</div>` : `<div class="empty">Belum ada karya.</div>`}
    </div>
  </section>

  ${s.process.length ? `<section class="ch process" id="proses" data-pose="process" style="display:block">
    <div class="wrap">${kick(L('process', 'Cara aku kerja'))}<h2>${title(L('process', 'Cara aku kerja'))}</h2>
      <div class="stack">${s.process.map((p, i) => `<article class="step" style="--i:${i}"><span class="step-n">${pad2(i + 1)}</span><div><h3>${esc(p.title)}</h3>${p.desc ? `<p>${esc(p.desc)}</p>` : ''}</div></article>`).join('')}</div>
    </div>
  </section>` : ''}

  ${skills.length ? `<section class="ch skills-ch" id="keahlian" data-pose="skills">
    <div class="wrap skills-grid">
      <div>${kick(L('skills', 'Keahlian & hobi'))}<h2>${title(L('skills', 'Keahlian & hobi'))}</h2></div>
      <div>${still ? '' : `<div class="sphere" style="height:${Math.min(440, 250 + skills.length * 16)}px">`}<ul class="skills" aria-label="Daftar keahlian">${skills.map(k => `<li>${esc(k)}</li>`).join('')}</ul>${still ? '' : '</div>'}</div>
    </div>
  </section>` : ''}

  ${s.tools.length ? `<section class="ch tools" data-pose="tools">
    <div class="wrap">${kick(L('tools', 'Alat andalan'))}<h2>${title(L('tools', 'Alat andalan'))}</h2>
      <div class="flip-grid">${s.tools.map(t => `<button class="flip" type="button" data-act="flip" aria-label="${esc(t.name)}: ${esc(t.desc)}"><span class="flip-in"><span class="face"><span class="big-i" aria-hidden="true">${esc((t.name || '?').trim().charAt(0).toUpperCase())}</span><b>${esc(t.name)}</b></span><span class="face back"><b>${esc(t.name)}</b><p>${esc(t.desc)}</p></span></span></button>`).join('')}</div>
      <p class="mono" style="margin-top:18px">Sorot atau ketuk kartu buat membalik</p>
    </div>
  </section>` : ''}

  ${s.games.length ? `<section class="ch games" id="game" data-pose="games">
    <div class="wrap">${kick(L('games', 'Game yang aku mainkan'))}<h2>${title(L('games', 'Game yang aku mainkan'))}</h2></div>
    <div class="ring-stage"><div class="ring">${s.games.map((g, i) => `<div class="ring-item"><i class="gi" aria-hidden="true">${pad2(i + 1)}</i><b>${esc(g.name)}</b>${g.note ? `<span>${esc(g.note)}</span>` : ''}</div>`).join('')}</div></div>
    <p class="mono ring-hint">Geser buat muter</p>
  </section>` : ''}

  ${s.journey.length ? `<section class="ch journey" id="perjalanan" data-pose="journey">
    <div class="wrap"><div class="half right">
      ${kick(L('journey', 'Perjalanan aku'))}
      <h2>${title(L('journey', 'Perjalanan aku'))}</h2>
      <ol class="timeline">${s.journey.map(j => `<li class="tl-row"><span class="yr">${esc(j.year)}</span><div><h3>${esc(j.title)}</h3>${j.desc ? `<p>${esc(j.desc)}</p>` : ''}</div></li>`).join('')}</ol>
    </div></div>
  </section>` : ''}

  ${s.specs.length ? `<section class="ch specs" data-pose="specs">
    <div class="wrap"><div class="half">
      ${kick(L('specs', 'Spesifikasi aku'))}<h2>${title(L('specs', 'Spesifikasi aku'))}</h2>
      <dl class="specs-list">${s.specs.map(x => `<div class="sp-row"><dt class="label">${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl>
    </div></div>
  </section>` : ''}

  ${hero3d ? `<section class="ch play lift" data-pose="play" aria-label="Mainin mobil 3D">
    <div class="wrap">${kick('Interaktif')}<h2 style="margin:0">${title(L('play', 'Putar dan warnai'))}</h2></div>
    <div class="wrap play-ui">
      <div class="swatches" role="group" aria-label="Warna objek">${OBJ_COLORS.map(c => `<button type="button" data-act="paint" data-c="${c}" style="background:${c}" aria-label="Warna ${c}" aria-pressed="${(objColor || CAR_BLACK) === c}"></button>`).join('')}</div>
      <button class="btn-line" type="button" data-act="spin">Putar 360°</button>
      <span class="mono">Geser buat muter mobilnya</span>
    </div>
  </section>` : ''}

  ${list(s.principles).length ? `<section class="principles" data-pose="principles" style="height:${list(s.principles).length * 65 + 60}vh">
    <div class="pr-stick">
      <div class="wrap">${kick(L('principles', 'Prinsip aku'))}</div>
      <div class="pr-words" aria-label="${esc(list(s.principles).join(', '))}">${list(s.principles).map(w => `<span class="pr-w" aria-hidden="true">${esc(w)}</span>`).join('')}</div>
      <p class="mono pr-count"><span class="pr-n">01</span> / ${pad2(list(s.principles).length)}</p>
    </div>
  </section>` : ''}

  ${s.services.length ? `<section class="ch services" data-pose="services">
    <div class="wrap"><div class="half">
      ${kick(L('services', 'Yang bisa aku bantu'))}
      <h2>${title(L('services', 'Yang bisa aku bantu'))}</h2>
      <div>${s.services.map((v, i) => `<div class="svc d3"><span class="n">${pad2(i + 1)}</span><div><h3>${esc(v.title)}</h3>${v.desc ? `<p>${esc(v.desc)}</p>` : ''}</div></div>`).join('')}</div>
    </div></div>
  </section>` : ''}

  ${s.testimonials.length ? `<section class="ch testimonials" data-pose="testimonials">
    <div class="wrap">${kick(L('testimonials', 'Kata mereka'))}<h2>${title(L('testimonials', 'Kata mereka'))}</h2>
      <div class="quotes">${s.testimonials.map(q => `<figure class="tq d3"><blockquote class="z1">“${esc(q.quote)}”</blockquote><figcaption><b>${esc(q.name)}</b>${q.role ? `<span>${esc(q.role)}</span>` : ''}</figcaption></figure>`).join('')}</div>
    </div>
  </section>` : ''}

  ${s.faq.length ? `<section class="ch faq" data-pose="faq">
    <div class="wrap"><div class="half">
      ${kick(L('faq', 'Sering ditanya'))}<h2>${title(L('faq', 'Sering ditanya'))}</h2>
      <div class="faq-list">${s.faq.map(f => `<details class="qa"><summary><span>${esc(f.q)}</span><i aria-hidden="true">+</i></summary><div class="qa-a"><p>${esc(f.a)}</p></div></details>`).join('')}</div>
    </div></div>
  </section>` : ''}

  ${s.now.length ? `<section class="ch now" data-pose="now">
    <div class="wrap"><div class="half right">
      ${kick(L('now', 'Lagi ngapain sekarang'))}<h2>${title(L('now', 'Lagi ngapain sekarang'))}</h2>
      <ul class="now-list">${s.now.map(n => `<li class="d3"><span class="now-dot"></span><span class="z1">${esc(n.text)}</span></li>`).join('')}</ul>
    </div></div>
  </section>` : ''}

  <section class="ch contact" id="kontak" data-pose="contact">
    <div class="wrap"><div class="half">
      ${kick('Kontak')}
      <h2>${title(L('contact', 'Yuk ngobrol'))}</h2>
      <p class="contact-lead">${esc(L('contactText', 'Hubungi aku lewat salah satu di bawah.'))}</p>
      ${links.length ? `<ul class="soc-list">${links.map(x => `<li><a class="soc-row" href="${esc(x.href)}" target="_blank" rel="noopener">${ICON(x.m.icon)}<b>${esc(x.m.name)}</b><span>${esc(x.raw.replace(/^https?:\/\/(www\.)?/, '').slice(0, 28))} ↗</span></a></li>`).join('')}</ul>` : `<p class="contact-lead">Kontak belum diisi.</p>`}
    </div></div>
  </section>

  <footer><div class="wrap">
    <span class="foot-name" aria-hidden="true">${esc(big)}</span>
    <div class="foot-row"><span>© ${new Date().getFullYear()} ${esc(s.name)}</span><span>${hero3d ? 'Model mobil 3D: Ferrari 458 Italia oleh vicent091036 (Sketchfab). ' : ''}Dibuat dan diatur sendiri.</span></div>
  </div></footer>
</main>`;
  }

  // ---- 3D
  const T = window.THREE;
  const has3d = (() => { if (!T || !T.GLTFLoader || still) return false; try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  const lights = scene => {
    scene.add(new T.HemisphereLight(0xffffff, 0x202024, .75));
    const key = new T.DirectionalLight(0xffffff, 1.25); key.position.set(5, 7, 8); scene.add(key);
    const rim = new T.DirectionalLight(0xffffff, .9); rim.position.set(-7, 3, -5); scene.add(rim);
    const low = new T.DirectionalLight(0xffffff, .3); low.position.set(0, -6, 4); scene.add(low);
  };
  const renderer = canvas => {
    const r = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    return r;
  };

  // The signature object: a supercar (glTF), with clear-coat paint, chrome rims, glass, and wheels that roll with the scroll.
  const CAR_URL = 'car.json';   // the .glb, base64-wrapped in JSON so it can be served next to the page

  // poses per chapter: [x, y, rotX, rotY, rotZ, scale, opacity]; rotY 0 shows the nose, PI/2 the side
  const POSES = {
    hero: [1.1, -.35, .14, .75, 0, 1.25, 1], intro: [-4.1, -.2, .12, .05, 0, .82, 1], stats: [4.2, -.1, 1.15, .55, 0, .8, 1],
    about: [-3.9, -.3, .16, 2.55, 0, .82, 1], work: [0, 6.5, .2, 1.4, 0, .8, 0], skills: [-3.7, -2.25, .1, 1.57, 0, .62, 1],
    journey: [-4, -.2, .14, -.85, 0, .8, 1], process: [0, 6.5, .2, 2.4, 0, .8, 0], tools: [0, -6.5, .2, 3.6, 0, .8, 0], games: [0, 6.5, .2, 4.4, 0, .8, 0], testimonials: [0, 6.5, .2, 1, 0, .8, 0],
    specs: [4.75, -.3, .06, 1.57, 0, .82, 1], principles: [0, -2.35, .3, 5.2, 0, .62, 1], faq: [4.1, -.25, .18, 2.3, 0, .78, 1], now: [-4.1, -.25, .16, -.45, 0, .8, 1], play: [0, -.05, .22, .7, 0, 1.25, 1], services: [4.1, -.2, .16, 3.9, 0, .78, 1], contact: [3.9, -.5, .3, 7.85, 0, .8, 1]
  };
  const MOBILE = { hero: [0, 1.55, .16, .75, 0, .7, 1], intro: [0, 1.7, .14, .05, 0, .6, 1], stats: [0, 1.6, 1.1, .55, 0, .58, 1], play: [0, .75, .22, .7, 0, .82, 1] };

  function makeStage() {
    const canvas = document.createElement('canvas'); canvas.id = 'stage3d'; canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    const r = renderer(canvas), scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, .1, 80); camera.position.z = 13;
    // ---------- realistic rendering: studio environment, per-material PBR, microdetail, real shadows, quality levels
    r.physicallyCorrectLights = true; r.toneMappingExposure = 1; r.shadowMap.type = T.PCFSoftShadowMap;

    // Studio environment for reflections: a dark (or light) cyclorama with large softboxes, prefiltered by PMREM.
    // The softboxes are what the paint, chrome and glass reflect; values above 1 survive because PMREM renders in half float.
    const pmrem = new T.PMREMGenerator(r), envs = {};
    function studioEnv(light) {
      const k = light ? 'l' : 'd'; if (envs[k]) return envs[k];
      const s = new T.Scene(), geo = new T.SphereGeometry(40, 48, 24), col = [], top = new T.Color(light ? 0xd9dce0 : 0x15161a), mid = new T.Color(light ? 0xb4b7bc : 0x0b0c0e), low = new T.Color(light ? 0x8e9095 : 0x040405);
      const pos = geo.attributes.position, c = new T.Color();
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 40; c.copy(y > 0 ? mid : low).lerp(y > 0 ? top : mid, y > 0 ? y : 1 + y); col.push(c.r, c.g, c.b); }
      geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      s.add(new T.Mesh(geo, new T.MeshBasicMaterial({ side: T.BackSide, vertexColors: true })));
      const box = (w, h, x, y, z, e) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(e, e, e * .97), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
      box(18, 5, 0, 14, 1, light ? 4 : 9);          // overhead strip softbox: the long highlight along the roof and bonnet
      box(3, 14, -15, 5, 3, light ? 3 : 6);     // left strip
      box(3, 14, 15, 5, -2, light ? 2.6 : 4.5);       // right strip
      box(22, 3.5, 0, 4, -17, light ? 3.2 : 7);   // rear rim strip: separates the silhouette
      box(12, 6, 3, 3, 16, light ? 1.5 : 1.4);       // broad front fill
      const floor = new T.Mesh(new T.CircleGeometry(30, 48), new T.MeshBasicMaterial({ color: light ? 0x6f7175 : 0x050506 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -3; s.add(floor);
      envs[k] = pmrem.fromScene(s, .02).texture;
      s.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      return envs[k];
    }

    // Key / fill / rim, fixed in the studio while the car turns under them. The key casts the shadow.
    const hemi = new T.HemisphereLight(0xe4e9f2, 0x141416, .28);
    const key = new T.DirectionalLight(0xfff5ea, 3.8), KEY_OFF = new T.Vector3(2.6, 10, 4.5);
    key.shadow.bias = -.0004; key.shadow.normalBias = .025; key.shadow.radius = 5;
    const fill = new T.DirectionalLight(0xe6edff, .75); fill.position.set(-9, 3, 7);
    const rim = new T.DirectionalLight(0xffffff, 2.6); rim.position.set(-4, 6, -11);
    scene.add(hemi, key, key.target, fill, rim);

    // Shared microdetail GLSL. Everything is in object space, so detail stays glued to the car while it moves,
    // and every high-frequency term fades out with fwidth() once it gets smaller than a pixel (no shimmer, no moire).
    const MICRO = `
      varying vec3 vObjPos; varying vec3 vObjN;
      float h31(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      vec3 h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
      float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
      float aaFade(vec3 p){ return clamp(1.6 - length(fwidth(p)), 0., 1.); }
    `;
    // per-kind fragment snippets: [after roughness is known (albedo/roughness), after base normal, after clearcoat normal, clearcoat roughness term]
    const KIND = {
      paint: [`roughnessFactor *= 1. + (vn(vObjPos * 14.) - .5) * .08;`,
        // metallic flakes: each ~1 mm cell tilts the base-layer normal a little, so it glints under the key light
        `{ vec3 fp = vObjPos * 160.; float a = clamp(2.2 - length(fwidth(fp)), 0., 1.); normal = normalize(normal + (h33(floor(fp)) * 2. - 1.) * .055 * a); }`,
        // orange peel: a very low, wide ripple in the clearcoat only
        `{ vec3 op = vec3(vn(vObjPos * 30.), vn(vObjPos * 30. + 17.3), vn(vObjPos * 30. + 41.9)) - .5; clearcoatNormal = normalize(clearcoatNormal + op * .016); }`,
        // faint polishing swirls, only visible inside highlights
        `smoothstep(.985, 1., vn(vObjPos * vec3(420., 3., 420.))) * .06 * aaFade(vObjPos * 420.)`],
      metal: [`roughnessFactor *= 1. + (vn(vObjPos * vec3(260., 6., 260.)) - .5) * .35 * aaFade(vObjPos * 260.);`, '', '', '0.'],
      rubber: [`{ float n = vn(vObjPos * 60.); roughnessFactor = clamp(roughnessFactor + (n - .5) * .08, 0., 1.); diffuseColor.rgb *= .9 + .2 * n; }`, '', '', '0.'],
      leather: [`{ float g = vn(vObjPos * 320.) * aaFade(vObjPos * 320.); roughnessFactor += (g - .5) * .14; diffuseColor.rgb *= .94 + .1 * g; }`,
        `{ vec3 gp = vObjPos * 320.; float a = aaFade(gp); normal = normalize(normal + (vec3(vn(gp), vn(gp + 7.1), vn(gp + 13.7)) - .5) * .12 * a); }`, '', '0.'],
      plastic: [`roughnessFactor *= 1. + (vn(vObjPos * 90.) - .5) * .14 * aaFade(vObjPos * 90.);`, '', '', '0.'],
      // 2x2 twill carbon weave, projected on the dominant object-space axis, lacquered
      carbon: [`{ vec3 an = abs(normalize(vObjN)); vec2 pc = an.x > an.y && an.x > an.z ? vObjPos.yz : (an.y > an.z ? vObjPos.xz : vObjPos.xy);
          vec2 g = pc * 180.; vec2 ci = floor(g), fr = fract(g); float warp = step(2., mod(ci.x + ci.y, 4.));
          float band = sin(mix(fr.x, fr.y, warp) * 3.14159); float a = clamp(1.5 - length(fwidth(g)), 0., 1.);
          diffuseColor.rgb *= mix(.8, .5 + .6 * band, a); roughnessFactor = mix(roughnessFactor, .22 + (1. - band) * .3, a); }`, '', '', '0.'],
      none: ['', '', '', '0.']
    };
    const pbrMats = [], carScaleU = { value: 1 };
    function pbr(kind, params, physical) {
      const m = physical ? new T.MeshPhysicalMaterial(params) : new T.MeshStandardMaterial(params);
      const [rough, nrm, ccn, ccr] = KIND[kind];
      m.defines = { ...(m.defines || {}), MICRO: '' }; m.userData.kind = kind;   // keep three's STANDARD / PHYSICAL defines
      m.onBeforeCompile = sh => {
        sh.uniforms.uCarScale = carScaleU;
        // positions are quantized per mesh, so rescale them to metres with the mesh's own matrix scale (rotation-free, so detail never swims)
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjPos; varying vec3 vObjN; uniform float uCarScale;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)) / uCarScale; vObjN = normal;');
        let f = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + MICRO)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef MICRO\n' + rough + '\n#endif')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#ifdef MICRO\n' + nrm + '\n#endif');
        if (physical && m.clearcoat > 0) {
          f = f.replace('#include <clearcoat_normal_fragment_maps>', '#include <clearcoat_normal_fragment_maps>\n#ifdef MICRO\n' + ccn + '\n#endif')
            .replace('#include <lights_physical_fragment>', '#ifdef MICRO\nfloat ccRough = clearcoatRoughness + ' + ccr + ';\n#else\nfloat ccRough = clearcoatRoughness;\n#endif\n'
              + T.ShaderChunk.lights_physical_fragment.replace('material.clearcoatRoughness = clearcoatRoughness;', 'material.clearcoatRoughness = ccRough;'));
        }
        sh.fragmentShader = f;
      };
      m.customProgramCacheKey = () => 'yz-' + kind + (physical ? 'p' : 's');
      pbrMats.push(m);
      return m;
    }

    // Material library, one per real-world material (no single universal material)
    const body = pbr('paint', { metalness: .62, roughness: .32, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 1.15 }, true);   // metallic paint under clearcoat
    const chrome = pbr('none', { color: 0xf2f2f2, metalness: 1, roughness: .05, envMapIntensity: 1.1 });
    const alloy = pbr('metal', { color: 0xc9cbce, metalness: 1, roughness: .26 });                 // machined wheel alloy
    const disc = pbr('metal', { color: 0x6b6d70, metalness: 1, roughness: .48 });                  // cast-iron brake discs
    const caliper = pbr('paint', { color: 0x2b2c30, metalness: .3, roughness: .4, clearcoat: .6, clearcoatRoughness: .1 }, true);
    const rubber = pbr('rubber', { color: 0x161617, metalness: 0, roughness: .9, envMapIntensity: .5 });
    const blackPlastic = pbr('plastic', { color: 0x101012, metalness: 0, roughness: .62, envMapIntensity: .7 });
    const satinPlastic = pbr('plastic', { color: 0x3a3b3e, metalness: 0, roughness: .55 });
    const lightPlastic = pbr('plastic', { color: 0x6e6f72, metalness: 0, roughness: .6 });
    const leather = pbr('leather', { color: 0x2a2a2c, metalness: 0, roughness: .62 });
    const leatherRed = pbr('leather', { color: 0x4a1714, metalness: 0, roughness: .6 });
    const carpet = pbr('rubber', { color: 0x1d1d1f, metalness: 0, roughness: 1, envMapIntensity: .3 });
    const carbon = pbr('carbon', { color: 0x1a1b1e, metalness: .25, roughness: .35, clearcoat: .9, clearcoatRoughness: .04 }, true);
    const anodized = pbr('metal', { color: 0x1b1b1d, metalness: .9, roughness: .35 });           // badges, kept brand-neutral
    // glass and lenses: dielectric (F0 ~4%) with Fresnel, mostly transmissive, tinted
    const glass = pbr('none', { color: 0xdfe5ea, metalness: 0, roughness: .02, transmission: .92, reflectivity: .5, envMapIntensity: 1.5, transparent: true }, true);
    const lens = pbr('none', { color: 0xf4f6f8, metalness: 0, roughness: .03, transmission: .85, reflectivity: .5, envMapIntensity: 1.4, transparent: true, clearcoat: .0 }, true);
    const tailLens = pbr('none', { color: 0x7a0a0c, metalness: 0, roughness: .08, transmission: .35, reflectivity: .5, emissive: 0x5a0306, emissiveIntensity: .35, transparent: true }, true);
    const led = pbr('none', { color: 0x902018, metalness: 0, roughness: .2, emissive: 0x7a1408, emissiveIntensity: .45 });
    const BY_MATERIAL = { Body_Color: body, metal_chrome: chrome, metal_gray: alloy, Tires: rubber, Glass_Gray: glass, Projector_Glass: lens, Taillight_Glass: tailLens,
      Turn_Signal_LED: led, Leather: leather, Leather_red: leatherRed, Interior_dark: satinPlastic, Interior_light: lightPlastic, plastic_gray: satinPlastic, Carpet: carpet,
      Ferrari_Yellow: anodized, _0098_DodgerBlue: anodized };
    const BY_MESH = { brake: disc, brakes: caliper, grills: blackPlastic, wipers: blackPlastic, carbon_fibre_trim: carbon, 'carbon fibre': carbon, steering_carbon: carbon };

    // real shadow from the key light onto the road
    const catcher = new T.Mesh(new T.PlaneGeometry(9, 12), new T.ShadowMaterial({ opacity: .6, depthWrite: false }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.y = -.596; catcher.receiveShadow = true; catcher.renderOrder = 3;

    // quality levels; "auto" picks by device and steps down if frames get slow
    const QUALITY = { low: { pr: 1, shadow: 0, micro: false }, medium: { pr: 1.25, shadow: 0, micro: true }, high: { pr: 1.75, shadow: 1024, micro: true }, ultra: { pr: 2, shadow: 2048, micro: true } };
    const autoLevel = () => (matchMedia('(pointer: coarse)').matches || innerWidth < 860 || (navigator.deviceMemory || 8) <= 4) ? 'medium' : 'high';
    let qWant = 'auto', qNow = '', slow = 0, frames = 0;
    function applyQuality(level) {
      if (level === qNow) return; qNow = level; const q = QUALITY[level];
      r.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr)); r.setSize(innerWidth, innerHeight, false);
      r.shadowMap.enabled = !!q.shadow; key.castShadow = !!q.shadow; catcher.visible = !!q.shadow;
      if (q.shadow) { key.shadow.mapSize.set(q.shadow, q.shadow); key.shadow.map?.dispose(); key.shadow.map = null; }
      pbrMats.forEach(m => { if (q.micro) m.defines.MICRO = ''; else delete m.defines.MICRO; m.needsUpdate = true; });
      catcher.material.needsUpdate = true;
    }
    function setQuality(want) { qWant = want; slow = 0; frames = 0; applyQuality(want === 'auto' ? autoLevel() : want); }
    const pivot = new T.Group(), spinner = new T.Group(); pivot.add(spinner); scene.add(pivot); spinner.add(catcher);
    // soft contact shadow on the ground under the car (moves with it)
    const sc = document.createElement('canvas'); sc.width = sc.height = 256; const sg = sc.getContext('2d'), grad = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(0,0,0,.75)'); grad.addColorStop(.6, 'rgba(0,0,0,.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = grad; sg.fillRect(0, 0, 256, 256);
    const shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sc), transparent: true, depthWrite: false, toneMapped: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(3.1, 5.6, 1); shadow.position.y = -.592; shadow.renderOrder = 2; spinner.add(shadow);

    // The highway: a two-lane asphalt road drawn in a shader. It scrolls under the car (the car "drives"),
    // fades out at both ends, and catches a pool of light around the car.
    const RL = 44, RW = 7.6, LANE = -1.8;   // road length, width, and the car's offset from the centre line
    const ru = { off: { value: 0 }, lm: { value: 0 }, len: { value: RL } };
    const roadGeo = new T.PlaneGeometry(RW, RL, 1, 1); roadGeo.rotateX(-Math.PI / 2);
    const road = new T.Mesh(roadGeo, new T.ShaderMaterial({ uniforms: ru, transparent: true, depthWrite: false, vertexShader: `
      varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `
      precision highp float;
      varying vec2 vUv; uniform float off; uniform float lm; uniform float len;
      float hash(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float u = vUv.x, z = vUv.y * len - off;          // z: distance along the road, moving
        vec2 w = vec2(u * 8.0, z);
        // asphalt (dark) or concrete (light mode): coarse patches + fine aggregate
        float n = noise(w * .7) * .55 + noise(w * 3.1) * .3 + hash(floor(w * 60.)) * .15;
        vec3 base = lm > .5 ? mix(vec3(.70), vec3(.80), n) : mix(vec3(.075), vec3(.14), n);
        // darker tyre tracks in each lane
        float tracks = smoothstep(.06, .0, abs(fract(u * 2.) - .3)) + smoothstep(.06, .0, abs(fract(u * 2.) - .7));
        base *= 1. - tracks * .18;
        vec3 paint = lm > .5 ? vec3(.95) : vec3(.6);
        float line = 0.;
        line += step(.055, u) * step(u, .07) + step(.93, u) * step(u, .945);                       // edge lines
        line += step(.493, u) * step(u, .507) * step(fract(z / 6.), .55);                          // dashed centre line
        line *= .78 + .22 * noise(w * 9.);                                                          // worn paint
        vec3 c = mix(base, paint, clamp(line, 0., 1.));
        // shoulders: lighter kerb strip, then fade into the backdrop sideways
        c = mix(c, lm > .5 ? vec3(.88) : vec3(.22), step(u, .025) + step(.975, u));
        float side = smoothstep(.0, .12, u) * smoothstep(1., .88, u);
        // light pool around the car, darker far away; both ends fade out
        float d = abs(vUv.y - .5) * len;
        float pool = exp(-d * d / 40.);
        c *= mix(lm > .5 ? .92 : .5, 1.12, pool);
        float a = smoothstep(.0, .42, vUv.y) * smoothstep(1., .58, vUv.y) * side * (lm > .5 ? .7 : .9);
        gl_FragColor = vec4(c, a);
      }` }));
    road.position.set(LANE, -.6, 0); road.renderOrder = 1; spinner.add(road);

    // street lamps on both sides, passing by
    const poleMat = new T.MeshStandardMaterial({ color: 0x2a2b2e, metalness: .8, roughness: .35 });
    const headMat = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: .6, roughness: .4 });
    const lamps = [];
    [-1, 1].forEach(side => { for (let i = 0; i < 4; i++) {
      const g = new T.Group(), x = LANE + side * (RW / 2 + .35);
      const pole = new T.Mesh(new T.CylinderGeometry(.035, .055, 2.6, 12), poleMat); pole.position.y = .7;
      const arm = new T.Mesh(new T.BoxGeometry(.8, .05, .07), poleMat); arm.position.set(-side * .36, 1.97, 0);
      const head = new T.Mesh(new T.BoxGeometry(.34, .06, .14), headMat); head.position.set(-side * .74, 1.93, 0);
      g.add(pole, arm, head); g.position.x = x; g.userData.base = i * (RL / 4) + (side > 0 ? RL / 8 : 0);
      g.traverse(o => { if (o.isMesh) o.material = o.material.clone(), o.material.transparent = true; });
      spinner.add(g); lamps.push(g);
    } });
    let drive = 0, poseKey = 'hero', lampV = 0;   // lamps only show in the open chapters, so poles never cross text
    const wheels = []; let shown = 0, ready = false;
    const loadCar = done => fetch(CAR_URL).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(j => {
      const bin = atob(j.data), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      new T.GLTFLoader().parse(buf.buffer, '', done, err => console.warn('Mobil 3D gagal dibaca:', err));
    }).catch(err => console.warn('Mobil 3D gagal dimuat:', err));
    loadCar(gltf => {
      const car = gltf.scene;
      // assign by the model's own material names (mesh names only where one source material covers different real materials)
      car.traverse(o => { if (!o.isMesh) return; const m = BY_MESH[o.name] || BY_MATERIAL[o.material?.name]; if (m) o.material = m; o.castShadow = true; });
      ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].forEach(n => { const w = car.getObjectByName(n); if (w) wheels.push(w); });
      car.position.y = -.6; car.rotation.y = Math.PI; spinner.add(car); ready = true;   // nose towards rotY 0
    });

    let cur = POSES.hero.slice(), pointer = { x: 0, y: 0 }, yaw = 0, yawT = 0, spin = 0, spinT = 0, colT = new T.Color(), mobile = false, lastY = scrollY, roll = 0;
    const resize = () => { mobile = innerWidth < 860; r.setSize(innerWidth, innerHeight, false); if (qWant === 'auto' && qNow && autoLevel() === 'medium' && qNow !== 'low') applyQuality('medium'); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
    resize(); addEventListener('resize', resize);
    addEventListener('pointermove', e => { pointer = { x: e.clientX / innerWidth * 2 - 1, y: e.clientY / innerHeight * 2 - 1 }; }, { passive: true });
    const poseOf = key => (mobile && MOBILE[key]) || (mobile ? (() => { const p = (POSES[key] || POSES.hero).slice(); p[0] = 0; p[1] = 1.8; p[5] *= .55; p[6] = 0; return p; })() : POSES[key] || POSES.hero);
    const ease = t => t * t * (3 - 2 * t);
    // the chapter whose top has entered the lower part of the screen owns the pose; blending is done by the time its top reaches 35%
    function target() {
      const secs = [...app.querySelectorAll('[data-pose]')];
      let i = 0;
      secs.forEach((el, k) => { if (el.getBoundingClientRect().top < innerHeight * .95) i = k; });
      const here = poseOf(secs[i]?.dataset.pose || 'hero'); poseKey = secs[i]?.dataset.pose || 'hero';
      if (!i) return here;
      const prev = poseOf(secs[i - 1].dataset.pose), k = ease(Math.min(1, Math.max(0, (innerHeight * .95 - secs[i].getBoundingClientRect().top) / (innerHeight * .6))));
      return here.map((v, j) => prev[j] + (v - prev[j]) * k);
    }
    let lastT = 0;
    function render(t) {
      const P = target(), steps = Math.min(4, (t - (lastT || t)) * 60), f = n => 1 - Math.pow(1 - n, steps); lastT = t;   // same glide speed at any frame rate
      cur = cur.map((v, i) => v + (P[i] - v) * f(.07));
      yaw += (yawT - yaw) * f(.12); spin += (spinT - spin) * f(.05);
      shown += ((ready ? 1 : 0) - shown) * f(.06);
      const ds = Math.abs(scrollY - lastY) * .012 + steps * .018;    // idle cruise + faster while scrolling
      roll -= ds * 2.2; drive += ds; lastY = scrollY;
      ru.off.value = drive; ru.lm.value = root.dataset.mode === 'light' ? 1 : 0;
      lampV += ((['hero', 'play', 'contact'].includes(poseKey) && !mobile ? 1 : 0) - lampV) * f(.08);
      lamps.forEach(g => {
        const z = ((g.userData.base - drive) % RL + RL) % RL - RL / 2;   // wrap along the road
        g.position.z = z;
        const a = lampV * Math.min(1, Math.max(0, (11 - Math.abs(z)) / 5));
        g.traverse(o => { if (o.isMesh) o.material.opacity = a; });
      });
      wheels.forEach(w => { w.rotation.x = roll; });
      pivot.position.set(cur[0], cur[1] + Math.sin(t * 1.1) * .04, 0);
      pivot.rotation.set(cur[2] + pointer.y * .06, cur[3] + pointer.x * .2 + yaw + spin, cur[4]);
      pivot.scale.setScalar(cur[5] * (.94 + .06 * shown));
      body.color.lerp(colT, f(.08));
      canvas.style.opacity = (cur[6] * shown).toFixed(3);
      carScaleU.value = pivot.scale.x;
      // key light and its shadow camera follow the car through the studio
      key.position.copy(pivot.position).add(KEY_OFF); key.target.position.copy(pivot.position); key.target.updateMatrixWorld();
      if (key.castShadow) { const e = 4.2 * cur[5], sc = key.shadow.camera; if (Math.abs(sc.right - e) > .05) { sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 1; sc.far = 30; sc.updateProjectionMatrix(); } }
      shadow.material.opacity = (root.dataset.mode === 'light' ? .45 : .8) * (key.castShadow ? .7 : 1);
      if (cur[6] * shown > .01) r.render(scene, camera);
      tmpV.copy(pivot.position).project(camera); spot[0] = (tmpV.x + 1) / 2; spot[1] = (tmpV.y + 1) / 2; spot[2] = cur[6] * shown; spot[3] = cur[5];
      // adaptive quality (auto only): step down after ~2 s of slow frames
      if (qWant === 'auto' && cur[6] * shown > .01) { frames++; if (steps > 2) slow++; if (frames >= 120) { if (slow > 60) applyQuality(qNow === 'ultra' ? 'high' : qNow === 'high' ? 'medium' : 'low'); frames = slow = 0; } }
    }
    const spot = [.6, .45, 0, 1], tmpV = new T.Vector3();
    return {
      render, spot: () => spot,
      refresh() {
        colT.set(objColor || CAR_BLACK).convertSRGBToLinear();
        const light = root.dataset.mode === 'light'; scene.environment = studioEnv(light);
        hemi.groundColor.set(light ? 0x9a9ca0 : 0x141416); hemi.intensity = light ? .5 : .28; catcher.material.opacity = light ? .35 : .6;
        const q = look().q; if (q !== qWant || !qNow) setQuality(q);
      },
      spin() { spinT += Math.PI * 2; },
      drag(dx) { yawT += dx * .012; }
    };
  }

  // Karya: each work is a card in a 3D coverflow; page scroll decides which card faces you.
  function makeShowcase() {
    const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
    const r = renderer(canvas), scene = new T.Scene(), camera = new T.PerspectiveCamera(32, 1, .1, 60); camera.position.z = 9.5;
    lights(scene);
    const group = new T.Group(); scene.add(group);
    const W = 3.6, Hc = 2.25, D = .12;
    let cards = [], countKey = -1, faceKey = '', track = null, cur = 0, active = -1, visible = true, pointer = { x: 0, y: 0 };
    const side = new T.MeshStandardMaterial({ roughness: .4, metalness: .2 }), back = new T.MeshStandardMaterial({ roughness: .6 });
    function paint(c, i, n) {
      const g = c.face.getContext('2d'), w = 1024, h = 640, p = c.p;
      g.fillStyle = css('paper'); g.fillRect(0, 0, w, h);
      if (c.img?.complete && c.img.naturalWidth) { const k = Math.max(w / c.img.naturalWidth, h / c.img.naturalHeight), iw = c.img.naturalWidth * k, ih = c.img.naturalHeight * k; g.drawImage(c.img, (w - iw) / 2, (h - ih) / 2, iw, ih); const sh = g.createLinearGradient(0, h * .45, 0, h); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = sh; g.fillRect(0, 0, w, h); }
      else {
        const mark = (p.title || '?').trim().split(/[\s_-]+/).filter(Boolean).map(x => x[0]).join('').slice(0, 2).toUpperCase();
        g.fillStyle = css('paper-2'); g.fillRect(0, 0, w, h);
        if ('fontStretch' in g) g.fontStretch = 'expanded';
        g.fillStyle = css('muted'); g.globalAlpha = .35; g.font = '900 420px Archivo, "Arial Black", sans-serif'; g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.fillText(mark, w + 20, h * .78); g.globalAlpha = 1;
      }
      const ink = c.img?.complete && c.img.naturalWidth ? '#ffffff' : css('ink');
      if ('fontStretch' in g) g.fontStretch = 'normal';
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillStyle = ink; g.globalAlpha = .7; g.font = '600 26px "JetBrains Mono", monospace'; g.fillText(pad2(i + 1) + ' / ' + pad2(n) + (p.category ? '   ·   ' + String(p.category).toUpperCase() : ''), 64, 92); g.globalAlpha = 1;
      if ('fontStretch' in g) g.fontStretch = 'semi-expanded';
      g.font = '800 84px Archivo, "Arial Black", sans-serif';
      let t = String(p.title || ''); while (t.length > 1 && g.measureText(t).width > w - 128) t = t.slice(0, -2) + '…';
      g.fillText(t, 64, h - 72);
      c.tex.needsUpdate = true;
    }
    function sync(projects) {
      track = app.querySelector('.show-track');
      if (projects.length !== countKey) {
        cards.forEach(c => group.remove(c.g)); countKey = projects.length;
        cards = projects.map(() => {
          const face = document.createElement('canvas'); face.width = 1024; face.height = 640;
          const tex = new T.CanvasTexture(face); tex.anisotropy = 4; tex.encoding = T.sRGBEncoding;
          const mesh = new T.Mesh(new T.BoxGeometry(W, Hc, D), [side, side, side, side, new T.MeshBasicMaterial({ map: tex, toneMapped: false }), back]);
          const g = new T.Group(); g.add(mesh); group.add(g);
          return { g, face, tex, p: {}, img: null };
        });
        faceKey = ''; active = -1;
      }
      side.color.set(css('accent')).convertSRGBToLinear(); back.color.set(css('paper-2')).convertSRGBToLinear();
      const key = JSON.stringify(projects.map(p => [p.title, p.category, p.image])) + JSON.stringify(look());
      cards.forEach((c, i) => {
        c.p = projects[i]; const src = okUrl(c.p.image);
        if (src && c.img?.getAttribute('data-src') !== src) { c.img = new Image(); c.img.setAttribute('data-src', src); c.img.onload = () => paint(c, i, cards.length); c.img.src = src; }
        if (!src) c.img = null;
      });
      if (key !== faceKey) { faceKey = key; cards.forEach((c, i) => paint(c, i, cards.length)); document.fonts?.ready.then(() => cards.forEach((c, i) => paint(c, i, cards.length))); }
      setActive(Math.round(cur), true);
    }
    function setActive(i, force) {
      if (i === active && !force) return; active = i;
      app.querySelectorAll('.show-info article').forEach((a, k) => { a.classList.toggle('on', k === i); a.setAttribute('aria-hidden', String(k !== i)); a.querySelector('.go')?.setAttribute('tabindex', k === i ? '0' : '-1'); });
      app.querySelectorAll('.show-dots button').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
    }
    const progress = () => { if (!track) return 0; const rc = track.getBoundingClientRect(), room = rc.height - innerHeight; return room > 0 ? Math.min(1, Math.max(0, -rc.top / room)) : 0; };
    addEventListener('pointermove', e => { pointer = { x: e.clientX / innerWidth * 2 - 1, y: e.clientY / innerHeight * 2 - 1 }; }, { passive: true });
    new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      r.setSize(w, h, false); camera.aspect = w / h;
      camera.position.z = Math.max(9, 2.5 / (Math.tan(16 * Math.PI / 180) * camera.aspect));
      camera.updateProjectionMatrix(); render(performance.now() / 1000);
    }).observe(canvas);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);
    function render(t) {
      const n = cards.length, idx = progress() * Math.max(0, n - 1);
      cur += (idx - cur) * .1;
      const vel = Math.max(-1, Math.min(1, (idx - cur) * 2));
      if (n) setActive(Math.round(cur));
      cards.forEach((c, i) => {
        const d = i - cur, ad = Math.abs(d), front = Math.max(0, 1 - ad);
        c.g.position.set(d * 3.4, Math.sin(t * 1.1 + i * 1.7) * .06, -Math.min(ad, 2.5) * 2 + front * .5);
        c.g.rotation.set(vel * .3 + front * (pointer.y * .1), -Math.max(-1, Math.min(1, d)) * .75 + front * (pointer.x * .2 + Math.sin(t * .7) * .05), -vel * .04);
      });
      r.render(scene, camera);
    }
    return {
      canvas, sync, render: t => visible && render(t),
      go(i) { if (!track) return; const rc = track.getBoundingClientRect(), room = rc.height - innerHeight; scrollTo({ top: scrollY + rc.top + (cards.length > 1 ? i / (cards.length - 1) : 0) * room, behavior: 'smooth' }); }
    };
  }

  // Keahlian: chips on a sphere, turned in 3D; only transform and opacity change per frame.
  function makeSphere() {
    let items = [], box = null, ax = .35, ay = 0, spin = { x: 0, y: .25 }, drag = null;
    const pts = n => Array.from({ length: n }, (_, i) => { const y = 1 - (i + .5) / n * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996; return [Math.cos(th) * r, y, Math.sin(th) * r]; });
    function sync() {
      box = app.querySelector('.sphere'); if (!box) { items = []; return; }
      const els = [...box.querySelectorAll('li')], p = pts(els.length); items = els.map((el, i) => ({ el, p: p[i] }));
      box.onpointermove = e => { const rc = box.getBoundingClientRect(); if (drag) { spin.y = (e.clientX - drag.x) * .004; spin.x = (e.clientY - drag.y) * .004; drag = { x: e.clientX, y: e.clientY }; } else { spin.y = ((e.clientX - rc.left) / rc.width - .5) * 1.2; spin.x = -((e.clientY - rc.top) / rc.height - .5) * .8; } };
      box.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; };
      box.onpointerup = box.onpointercancel = () => { drag = null; };
      box.onpointerleave = () => { drag = null; spin = { x: 0, y: .25 }; };
    }
    function tick(t, dt) {
      if (!items.length || !box) return;
      ay += spin.y * dt; ax += spin.x * dt + (.35 - ax) * .01;
      const R = Math.min(box.clientWidth / 2 - 70, 80 + items.length * 12, 180), cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
      items.forEach(({ el, p }) => {
        const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy, y2 = p[1] * cx - z1 * sx, z2 = p[1] * sx + z1 * cx;
        el.style.transform = `translate(-50%,-50%) translate3d(${(x1 * R).toFixed(1)}px,${(y2 * R).toFixed(1)}px,0) scale(${(.62 + (z2 + 1) * .25).toFixed(3)})`;
        el.style.opacity = (.3 + (z2 + 1) * .35).toFixed(3);
        el.style.zIndex = String(Math.round((z2 + 1) * 50));
      });
    }
    return { sync, tick };
  }

  // Game: cards stand on a ring that turns in 3D (drag to spin); only transform and opacity change per frame.
  function makeRing() {
    let ring = null, items = [], angle = 0, vel = 14, drag = null, R = 400;
    function sync() {
      ring = app.querySelector('.ring'); if (!ring) { items = []; return; }
      items = [...ring.children]; const n = items.length, w = innerWidth < 860 ? 200 : 260;
      R = Math.max(w * .9, (w + 40) * n / (2 * Math.PI));
      items.forEach((el, i) => { el.dataset.a = String(i * 360 / n); });
      const stage = ring.parentElement;
      stage.onpointerdown = e => { drag = { x: e.clientX }; stage.style.cursor = 'grabbing'; };
      stage.onpointermove = e => { if (!drag) return; angle += (e.clientX - drag.x) * .25; drag = { x: e.clientX }; };
      stage.onpointerup = stage.onpointercancel = stage.onpointerleave = () => { drag = null; stage.style.cursor = ''; };
    }
    function tick(t, dt) {
      if (!ring) return;
      if (!drag) angle += vel * dt;
      ring.style.transform = `translateZ(${-R}px) rotateX(-6deg) rotateY(${angle.toFixed(2)}deg)`;
      items.forEach(el => {
        const a = (Number(el.dataset.a) + angle) * Math.PI / 180, front = (Math.cos(a) + 1) / 2;
        el.style.transform = `rotateY(${el.dataset.a}deg) translateZ(${R}px)`;
        el.style.opacity = (.25 + .75 * front).toFixed(3);
      });
    }
    return { sync, tick };
  }

  // Shader backdrop: base colour, a soft studio light that follows the car, a floor falloff, vignette and moving grain.
  function makeAtmo() {
    const canvas = document.createElement('canvas'); canvas.id = 'atmo'; canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    const r = new T.WebGLRenderer({ canvas, antialias: false, alpha: false });
    const scene = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const u = { res: { value: new T.Vector2() }, t: { value: 0 }, bg: { value: new T.Color() }, ink: { value: new T.Color() }, acc: { value: new T.Color() }, light: { value: new T.Vector3(.6, .45, 1) }, amt: { value: .6 }, lm: { value: 0 } };
    const mat = new T.ShaderMaterial({ uniforms: u, depthWrite: false, vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: `
      precision highp float;
      uniform vec2 res; uniform float t; uniform vec3 bg; uniform vec3 ink; uniform vec3 acc; uniform vec3 light; uniform float amt; uniform float lm;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec2 uv = gl_FragCoord.xy / res, p = uv - .5; float ar = res.x / res.y; p.x *= ar;
        vec2 lp = light.xy - .5; lp.x *= ar;
        vec3 c = bg;
        // studio key light: a wide soft pool behind the car, slightly tinted by the accent
        float d = length((p - lp - vec2(0., .08)) * vec2(.85, 1.15));
        float pool = smoothstep(.95, .0, d) * light.z;
        c = mix(c, mix(bg, mix(ink, acc, .35), .16), pool * amt);
        // floor: the lower part of the frame catches a little light, then falls off
        float floorY = lp.y - .18 * light.z;
        c = mix(c, mix(bg, ink, .05), smoothstep(.0, -.35, p.y - floorY) * smoothstep(-.9, -.35, p.y) * amt * light.z * .8);
        // vignette
        float v = smoothstep(1.35, .25, length(p * vec2(.82, 1.08)));
        c *= mix(1., mix(.62, .9, lm) + (1. - mix(.62, .9, lm)) * v, min(1., amt));
        // grain (moves every frame)
        c += (hash(gl_FragCoord.xy + fract(t * 7.3) * 91.7) - .5) * .05 * amt;
        gl_FragColor = vec4(c, 1.);
      }` });
    scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), mat));
    const size = () => { const k = Math.min(devicePixelRatio || 1, 1.5) * .75; r.setPixelRatio(k); r.setSize(innerWidth, innerHeight, false); u.res.value.set(innerWidth * k, innerHeight * k); };
    size(); addEventListener('resize', size);
    const L = new T.Vector3(.6, .45, 1), LT = new T.Vector3();
    return {
      refresh() { u.bg.value.set(css('bg')); u.ink.value.set(css('ink')); u.acc.value.set(css('accent')); u.lm.value = root.dataset.mode === 'light' ? 1 : 0; u.amt.value = FX_AMT[root.dataset.fx] ?? .6; canvas.style.display = u.amt.value ? '' : 'none'; },
      render(t, spot) {
        if (!u.amt.value) return;
        if (spot) L.lerp(LT.set(spot[0], spot[1], .35 + .65 * spot[2]), .06);
        u.light.value.copy(L); u.t.value = t; r.render(scene, cam);
      }
    };
  }

  let hero3d = null, showcase = null, atmo = null;
  if (has3d) {
    try { hero3d = makeStage(); showcase = makeShowcase(); try { atmo = makeAtmo(); } catch (e) { console.warn('Shader latar dimatikan:', e); } }
    catch (err) { console.warn('3D dimatikan:', err); hero3d = showcase = null; document.getElementById('stage3d')?.remove(); }
  }
  const sphere = still ? null : makeSphere(), ringFx = still ? null : makeRing();
  let ptr = { x: 0, y: 0 };
  addEventListener('pointermove', e => { ptr = { x: e.clientX / innerWidth * 2 - 1, y: e.clientY / innerHeight * 2 - 1 }; }, { passive: true });

  // ---- scroll-linked DOM motion: progress bar, giant name parallax, quote words, reveals, counters
  const seen = new Set();
  const countUp = el => {
    const m = String(el.dataset.v).match(/^(\d+)(.*)$/); if (!m || still) return;
    const end = Number(m[1]), rest = m[2], t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 1400), e = 1 - (1 - k) ** 3; el.textContent = Math.round(end * e) + rest; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  const reveal = 'IntersectionObserver' in window && !still ? new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); seen.add(e.target.dataset.rv); reveal.unobserve(e.target);
    e.target.querySelectorAll?.('.num').forEach(countUp); if (e.target.classList.contains('stat')) countUp(e.target.querySelector('.num'));
  }), { rootMargin: '0px 0px -10% 0px' }) : null;
  function animateIn() {
    if (!reveal) return;
    reveal.disconnect();
    app.querySelectorAll('.kicker, .ch h2, .hero-grid > *, .stat, .portrait, .spec, .proj, .show-side, .tl-row, .svc, .soc-row, .contact-lead, .play-ui, .skills-grid > div:last-child, .flip, .sp-row, .tq, .qa, .now-list li').forEach((el, i) => {
      const key = el.className.split(' ')[0] + ':' + i; el.dataset.rv = key;
      if (seen.has(key)) return;
      el.classList.add('rv'); el.style.transitionDelay = (el.classList.contains('stat') || el.classList.contains('tl-row') || el.classList.contains('svc') || el.classList.contains('soc-row') || el.classList.contains('flip') || el.classList.contains('sp-row') || el.classList.contains('qa')) ? (i % 4) * 90 + 'ms' : '';
      reveal.observe(el);
    });
  }
  function scrollFx() {
    const max = document.documentElement.scrollHeight - innerHeight;
    const bar = app.querySelector('.progress i'); if (bar) bar.style.transform = `scaleX(${max > 0 ? (scrollY / max).toFixed(4) : 0})`;
    const mega = app.querySelector('.mega'); if (mega) mega.style.transform = `translate3d(0,${(scrollY * .35).toFixed(1)}px,0)`;
    if (still) return;
    // process cards: the one being covered sinks back in 3D
    const steps = app.querySelectorAll('.step');
    steps.forEach((el, i) => {
      const next = steps[i + 1]; if (!next) { el.style.transform = ''; el.style.opacity = ''; return; }
      const a = el.getBoundingClientRect(), b = next.getBoundingClientRect(), k = Math.min(1, Math.max(0, (a.bottom - b.top) / a.height));
      el.style.transform = `perspective(1200px) translateZ(${(-k * 120).toFixed(1)}px) rotateX(${(k * 10).toFixed(2)}deg)`;
      el.style.opacity = (1 - k * .55).toFixed(3);
    });
    // principles: words turn over like cube faces
    const pr = app.querySelector('.principles');
    if (pr) {
      const rc = pr.getBoundingClientRect(), room = rc.height - innerHeight, words = pr.querySelectorAll('.pr-w'), n = words.length;
      const f = Math.min(.999, Math.max(0, room > 0 ? -rc.top / room : 0)) * n - .5;
      words.forEach((w, i) => { const ang = Math.max(-90, Math.min(90, (i - f) * 90)); w.style.transform = `rotateX(${ang.toFixed(2)}deg)`; w.style.opacity = (1 - Math.abs(ang) / 90).toFixed(3); });
      const cnt = pr.querySelector('.pr-n'); if (cnt) cnt.textContent = pad2(Math.min(n, Math.max(1, Math.round(f) + 1)));
    }
    const q = app.querySelector('.quote');
    if (q) {
      const rc = q.getBoundingClientRect(), k = Math.min(1, Math.max(0, (innerHeight * .85 - rc.top) / (rc.height + innerHeight * .35)));
      const words = q.children, n = words.length;
      for (let i = 0; i < n; i++) words[i].style.opacity = still ? 1 : (.16 + .84 * Math.min(1, Math.max(0, k * n * 1.15 - i))).toFixed(3);
    }
  }
  addEventListener('scroll', scrollFx, { passive: true });

  let last = 0;
  const loop = now => {
    const t = now / 1000, dt = Math.min(.05, t - (last || t)); last = t;
    if (!document.hidden) {
      hero3d?.render(t); atmo?.render(t, hero3d?.spot()); showcase?.render(t); sphere?.tick(t, dt); ringFx?.tick(t, calm() ? dt * .25 : dt);
      const mega = app.querySelector('.mega span'); if (mega && !calm()) mega.style.transform = `rotateX(${(-ptr.y * 7).toFixed(2)}deg) rotateY(${(ptr.x * 9).toFixed(2)}deg)`;
    }
    requestAnimationFrame(loop);
  };
  if (hero3d || sphere) requestAnimationFrame(loop);

  // tilt cards in 3D under the mouse
  app.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || calm()) return;
    const el = e.target.closest('.d3, .proj, .tq'); if (!el) return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    el.style.transition = 'transform .08s';
    el.style.transform = `perspective(900px) rotateX(${(-y * 12).toFixed(2)}deg) rotateY(${(x * 14).toFixed(2)}deg) translateZ(10px)`;
  });
  app.addEventListener('pointerout', e => {
    const el = e.target.closest('.d3, .proj, .tq'); if (!el || el.contains(e.relatedTarget)) return;
    el.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)'; el.style.transform = '';
  });

  // drag the object in the "play" chapter
  let dragX = null;
  app.addEventListener('pointerdown', e => { const pl = e.target.closest('.play'); if (!pl || e.target.closest('button') || !hero3d) return; dragX = e.clientX; pl.classList.add('dragging'); });
  addEventListener('pointermove', e => { if (dragX === null) return; hero3d.drag(e.clientX - dragX); dragX = e.clientX; });
  addEventListener('pointerup', () => { dragX = null; app.querySelector('.play')?.classList.remove('dragging'); });

  function draw() {
    applyLook(); app.innerHTML = page(state);
    const stage = app.querySelector('.show-stage');
    if (showcase && stage) { stage.append(showcase.canvas); showcase.sync(shown(state)); }
    hero3d?.refresh(); atmo?.refresh(); sphere?.sync(); ringFx?.sync(); animateIn(); scrollFx();
  }

  app.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'), l = e.target.closest('[data-look]');
    if (a?.dataset.act === 'mode') { mine.mode = look().mode === 'light' ? 'dark' : 'light'; keepMine(); }
    else if (a?.dataset.act === 'look') lookOpen = !lookOpen;
    else if (a?.dataset.act === 'go') return showcase?.go(Number(a.dataset.i));
    else if (a?.dataset.act === 'spin') return hero3d?.spin();
    else if (a?.dataset.act === 'flip') { a.classList.toggle('on'); return; }
    else if (a?.dataset.act === 'paint') { objColor = a.dataset.c; hero3d?.refresh(); app.querySelectorAll('[data-act="paint"]').forEach(b => b.setAttribute('aria-pressed', String(b === a))); return; }
    else if (a?.dataset.act === 'cat') filter = a.dataset.c;
    else if (l) { if (l.dataset.look === 'reset') mine = {}; else mine[l.dataset.look] = l.dataset.v; keepMine(); }
    else return;
    draw();
    if (a?.dataset.act === 'look' || l) app.querySelector(l ? `[data-look="${l.dataset.look}"][data-v="${l.dataset.v}"], [data-look="reset"]` : '[data-act="look"]')?.focus();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && lookOpen) { lookOpen = false; draw(); } });
  document.addEventListener('click', e => { if (lookOpen && !e.target.closest('.look, [data-act="look"]')) { lookOpen = false; draw(); } });

  // ---- settings (only for people who can edit this page)
  let artifactNs = null, assetsNs = null, saving = false;
  const ownerBtn = Object.assign(document.createElement('button'), { className: 'owner-btn', type: 'button', hidden: true, textContent: 'Pengaturan' });
  const scrim = Object.assign(document.createElement('div'), { className: 'scrim', hidden: true });
  const panel = Object.assign(document.createElement('aside'), { className: 'panel', hidden: true });
  panel.setAttribute('aria-label', 'Pengaturan website');
  document.body.append(ownerBtn, scrim, panel, Object.assign(document.createElement('div'), { className: 'grain', ariaHidden: 'true' }));

  const BLANK = {
    projects: { title: 'Karya baru', category: '', desc: '', tech: '', link: '', status: '', image: '' },
    stats: { value: '0', label: 'keterangan angka' },
    process: { title: 'Langkah baru', desc: '' }, tools: { name: 'Alat baru', desc: '' }, games: { name: 'Game baru', note: '' },
    specs: { label: 'Label', value: 'Nilai' }, testimonials: { quote: '', name: '', role: '' }, faq: { q: 'Pertanyaan baru', a: '' }, now: { text: 'Lagi ngerjain…' },
    journey: { year: '', title: 'Momen baru', desc: '' },
    services: { title: 'Layanan baru', desc: '' }
  };
  const inp = (id, label, value, opts = {}) => `<div class="f"><label for="${id}">${label}</label>${opts.area ? `<textarea id="${id}" data-k="${opts.k}">${esc(value)}</textarea>` : `<input id="${id}" data-k="${opts.k}" value="${esc(value)}" ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''} ${opts.list ? `list="${opts.list}"` : ''}>`}${opts.hint ? `<small>${opts.hint}</small>` : ''}</div>`;
  const tools = (key, i, n, extra = '') => `<div class="item-tools">${extra}<button class="btn sm" type="button" data-set="up" data-key="${key}" data-i="${i}" ${i ? '' : 'disabled'}>Naik</button><button class="btn sm" type="button" data-set="down" data-key="${key}" data-i="${i}" ${i < n - 1 ? '' : 'disabled'}>Turun</button><button class="btn sm danger" type="button" data-set="del" data-key="${key}" data-i="${i}">Hapus</button></div>`;
  const listEd = (legend, key, fields, hint, addLabel) => `<fieldset><legend>${legend}</legend>${hint ? `<span class="hint">${hint}</span>` : ''}
    ${state[key].map((it, i) => `<div class="item">${fields.map(f => inp(`${key}${i}-${f.k}`, f.label, it[f.k], { k: `${key}.${i}.${f.k}`, area: f.area, ph: f.ph })).join('')}${tools(key, i, state[key].length)}</div>`).join('')}
    <button class="btn" type="button" data-set="add" data-key="${key}">+ ${addLabel}</button></fieldset>`;
  function form(s) {
    const d = s.look || {};
    return `<div class="panel-head"><h2>Pengaturan</h2><button class="icon-btn" type="button" data-set="close" aria-label="Tutup">✕</button></div>
    <div class="panel-body">
      <fieldset><legend>Profil</legend>
        ${inp('s-name', 'Nama lengkap', s.name, { k: 'name' })}
        ${inp('s-nick', 'Nama besar di atas', s.nickname, { k: 'nickname' })}
        ${inp('s-tag', 'Judul pembuka', s.tagline, { k: 'tagline', area: true, hint: 'Apit kata dengan *bintang* supaya jadi huruf miring.' })}
        ${inp('s-bio', 'Bio pendek', s.bio, { k: 'bio', area: true })}
        ${inp('s-intro', 'Kalimat besar (bab Pembuka)', s.intro, { k: 'intro', area: true, hint: 'Kosongkan untuk menyembunyikan bab ini.' })}
        ${inp('s-about', 'Tentang aku', s.about, { k: 'about', area: true })}
        <div class="row2">${inp('s-loc', 'Lokasi', s.location, { k: 'location' })}${inp('s-focus', 'Fokus / julukan', s.focus, { k: 'focus', ph: 'Gamer, Developer…' })}</div>
        ${inp('s-status', 'Status', s.status, { k: 'status', ph: 'Terbuka untuk kerja sama' })}
        <div class="f"><label for="s-photo">Foto wajah</label><input id="s-photo" type="file" accept="image/png,image/jpeg,image/webp"><small>${s.photo ? 'Foto terpasang. Pilih file lain untuk mengganti.' : 'JPG, PNG atau WebP. Foto potret paling pas.'}</small>${s.photo ? '<button class="btn sm danger" type="button" data-set="photo-del">Hapus foto</button>' : ''}</div>
      </fieldset>
      <fieldset><legend>Tampilan bawaan</legend>
        <span class="hint">Ini yang dilihat pengunjung pertama kali. Mereka tetap bisa ganti sendiri lewat tombol Custom UI.</span>
        <div class="f"><span class="lbl">Mode</span><div class="choice">${[['dark', 'Gelap'], ['light', 'Terang']].map(([v, n]) => `<button class="chip" type="button" data-set="look" data-f="mode" data-v="${v}" aria-pressed="${(d.mode === 'light' ? 'light' : 'dark') === v}">${n}</button>`).join('')}</div></div>
        <div class="f"><span class="lbl">Warna dasar</span><div class="choice">${Object.entries(BASES).map(([k, b]) => `<button class="chip" type="button" data-set="look" data-f="base" data-v="${k}" aria-pressed="${(BASES[d.base] ? d.base : 'abu') === k}"><i style="background:${b.dark[0]}"></i>${b.name}</button>`).join('')}</div></div>
        ${[['fx', 'Efek realistis', FX, 'halus'], ['q', 'Kualitas 3D', QS, 'auto'], ['type', 'Gaya huruf', TYPES, 'sinema'], ['corner', 'Sudut', CORNERS, 'bulat'], ['motion', 'Gerakan', MOTIONS, 'penuh']].map(([k, name, opts, def]) => `<div class="f"><span class="lbl">${name}</span><div class="choice">${opts.map(([v, n]) => `<button class="chip" type="button" data-set="look" data-f="${k}" data-v="${v}" aria-pressed="${(d[k] || def) === v}">${n}</button>`).join('')}</div></div>`).join('')}
        <div class="f"><span class="lbl">Aksen</span><div class="swatches">${ACCENTS.map(c => `<button type="button" data-set="look" data-f="accent" data-v="${c}" style="background:${c}" aria-label="Aksen ${c}" aria-pressed="${(d.accent || '#d6d6d6') === c}"></button>`).join('')}</div></div>
      </fieldset>
      <fieldset><legend>Judul bab</legend>
        <div class="row2">${inp('l-about', 'Tentang', L('about', 'Tentang aku'), { k: 'labels.about' })}${inp('l-work', 'Karya', L('work', 'Karya pilihan'), { k: 'labels.work' })}</div>
        <div class="row2">${inp('l-skills', 'Keahlian', L('skills', 'Keahlian & hobi'), { k: 'labels.skills' })}${inp('l-journey', 'Perjalanan', L('journey', 'Perjalanan aku'), { k: 'labels.journey' })}</div>
        <div class="row2">${inp('l-services', 'Layanan', L('services', 'Yang bisa aku bantu'), { k: 'labels.services' })}${inp('l-play', 'Objek 3D', L('play', 'Putar dan warnai'), { k: 'labels.play' })}</div>
        <div class="row2">${inp('l-process', 'Cara kerja', L('process', 'Cara aku kerja'), { k: 'labels.process' })}${inp('l-tools', 'Alat', L('tools', 'Alat andalan'), { k: 'labels.tools' })}</div>
        <div class="row2">${inp('l-games', 'Game', L('games', 'Game yang aku mainkan'), { k: 'labels.games' })}${inp('l-specs', 'Spesifikasi', L('specs', 'Spesifikasi aku'), { k: 'labels.specs' })}</div>
        <div class="row2">${inp('l-principles', 'Prinsip', L('principles', 'Prinsip aku'), { k: 'labels.principles' })}${inp('l-testi', 'Testimoni', L('testimonials', 'Kata mereka'), { k: 'labels.testimonials' })}</div>
        <div class="row2">${inp('l-faq', 'FAQ', L('faq', 'Sering ditanya'), { k: 'labels.faq' })}${inp('l-now', 'Sekarang', L('now', 'Lagi ngapain sekarang'), { k: 'labels.now' })}</div>
        ${inp('l-contact', 'Kontak', L('contact', 'Yuk ngobrol'), { k: 'labels.contact' })}
        ${inp('l-ctext', 'Teks kontak', L('contactText', ''), { k: 'labels.contactText', area: true })}
        <span class="hint">Kata terakhir tiap judul otomatis jadi huruf miring.</span>
      </fieldset>
      <fieldset><legend>Sosial media</legend>
        ${inp('s-wa', 'WhatsApp', s.socials.whatsapp, { k: 'socials.whatsapp', ph: '628123456789', hint: 'Nomor dengan kode negara, atau link wa.me.' })}
        ${inp('s-tg', 'Telegram', s.socials.telegram, { k: 'socials.telegram', ph: 'username' })}
        ${inp('s-ig', 'Instagram', s.socials.instagram, { k: 'socials.instagram', ph: 'username' })}
        ${inp('s-tt', 'TikTok', s.socials.tiktok, { k: 'socials.tiktok', ph: 'username' })}
        ${inp('s-x', 'X / Twitter', s.socials.x, { k: 'socials.x', ph: 'username' })}
        <span class="hint">Isi username atau link lengkap. Yang kosong nggak ditampilkan.</span>
      </fieldset>
      ${listEd('Angka', 'stats', [{ k: 'value', label: 'Angka', ph: '100+' }, { k: 'label', label: 'Keterangan' }], 'Bab "Dalam angka". Angka di depan ikut animasi hitung.', 'Tambah angka')}
      <fieldset><legend>Karya</legend>
        <span class="hint">Apa aja boleh: proyek coding, game, desain, video, prestasi. Kategori dipakai buat tombol saring.</span>
        <datalist id="cat-list">${[...new Set(['Coding', 'Game', 'Desain', 'Video', 'Musik', 'Foto', 'Prestasi', ...s.projects.map(p => p.category).filter(Boolean)])].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        ${s.projects.map((p, i) => `<div class="item">
          <div class="row2">${inp(`p${i}-t`, 'Judul', p.title, { k: `projects.${i}.title` })}${inp(`p${i}-c`, 'Kategori', p.category, { k: `projects.${i}.category`, ph: 'Game, Coding…', list: 'cat-list' })}</div>
          ${inp(`p${i}-d`, 'Deskripsi', p.desc, { k: `projects.${i}.desc`, area: true })}
          <div class="row2">${inp(`p${i}-s`, 'Status / keterangan', p.status, { k: `projects.${i}.status`, ph: 'Live, Rank Mythic…' })}${inp(`p${i}-l`, 'Link', p.link, { k: `projects.${i}.link`, ph: 'https://…' })}</div>
          ${inp(`p${i}-k`, 'Tag (pisah koma)', p.tech, { k: `projects.${i}.tech`, ph: 'Node.js, Mobile Legends…' })}
          <div class="f"><label for="p${i}-img">Gambar (opsional)</label><input id="p${i}-img" type="file" accept="image/png,image/jpeg,image/webp" data-img="${i}"></div>
          ${tools('projects', i, s.projects.length, p.image ? `<button class="btn sm" type="button" data-set="img-del" data-i="${i}">Hapus gambar</button>` : '')}
        </div>`).join('')}
        <button class="btn" type="button" data-set="add" data-key="projects">+ Tambah karya</button>
      </fieldset>
      <fieldset><legend>Keahlian & hobi</legend>${inp('s-skills', 'Daftar (pisah koma)', s.skills, { k: 'skills', area: true })}</fieldset>
      ${listEd('Perjalanan', 'journey', [{ k: 'year', label: 'Tahun / waktu', ph: '2026' }, { k: 'title', label: 'Judul' }, { k: 'desc', label: 'Cerita singkat', area: true }], 'Urutkan dari yang terbaru.', 'Tambah momen')}
      ${listEd('Layanan', 'services', [{ k: 'title', label: 'Judul' }, { k: 'desc', label: 'Keterangan', area: true }], '', 'Tambah layanan')}
      ${listEd('Cara kerja', 'process', [{ k: 'title', label: 'Langkah' }, { k: 'desc', label: 'Keterangan', area: true }], 'Kartu-kartu ini menumpuk dalam 3D waktu di-scroll.', 'Tambah langkah')}
      ${listEd('Alat andalan', 'tools', [{ k: 'name', label: 'Nama' }, { k: 'desc', label: 'Keterangan (di balik kartu)', area: true }], '', 'Tambah alat')}
      ${listEd('Game', 'games', [{ k: 'name', label: 'Nama game' }, { k: 'note', label: 'Rank, role, atau catatan' }], 'Kartu game berputar dalam cincin 3D.', 'Tambah game')}
      ${listEd('Spesifikasi', 'specs', [{ k: 'label', label: 'Label' }, { k: 'value', label: 'Nilai' }], '', 'Tambah baris')}
      <fieldset><legend>Prinsip</legend>${inp('s-principles', 'Kata-kata (pisah koma)', s.principles, { k: 'principles', hint: 'Tiap kata tampil besar dan berputar seperti kubus.' })}</fieldset>
      ${listEd('Testimoni', 'testimonials', [{ k: 'quote', label: 'Ucapan', area: true }, { k: 'name', label: 'Nama' }, { k: 'role', label: 'Keterangan', ph: 'Pelanggan YS-Digital' }], 'Isi dengan ucapan asli dari orang yang pernah kerja sama denganmu. Kosong = bab disembunyikan.', 'Tambah testimoni')}
      ${listEd('FAQ', 'faq', [{ k: 'q', label: 'Pertanyaan' }, { k: 'a', label: 'Jawaban', area: true }], '', 'Tambah pertanyaan')}
      ${listEd('Lagi ngapain sekarang', 'now', [{ k: 'text', label: 'Kegiatan' }], '', 'Tambah kegiatan')}
    </div>
    <div class="panel-foot"><span class="msg" id="s-msg" aria-live="polite">Perubahan langsung kelihatan. Klik Simpan supaya tersimpan.</span><button class="btn" type="button" data-set="cancel">Batal</button><button class="btn primary" type="button" data-set="save" ${saving ? 'disabled' : ''}>${saving ? 'Menyimpan…' : 'Simpan'}</button></div>`;
  }
  const setPath = (o, path, v) => { const k = path.split('.'); for (let i = 0; i < k.length - 1; i++) o = o[k[i]] ??= {}; o[k[k.length - 1]] = v; };
  const say = m => { const el = document.getElementById('s-msg'); if (el) el.textContent = m; };
  function openPanel() { panel.innerHTML = form(state); panel.hidden = false; scrim.hidden = false; document.body.style.overflow = 'hidden'; }
  function closePanel() { panel.hidden = true; scrim.hidden = true; document.body.style.overflow = ''; }
  function refreshPanel() { const top = panel.querySelector('.panel-body')?.scrollTop || 0; panel.innerHTML = form(state); const b = panel.querySelector('.panel-body'); if (b) b.scrollTop = top; }

  ownerBtn.addEventListener('click', openPanel);
  scrim.addEventListener('click', closePanel);
  panel.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; setPath(state, k, e.target.value); draw(); });
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-set]'); if (!b) return;
    const act = b.dataset.set, i = Number(b.dataset.i), arr = state[b.dataset.key || 'projects'];
    if (act === 'close') return closePanel();
    if (act === 'cancel') { state = saved(); draw(); closePanel(); return; }
    if (act === 'save') return save();
    if (act === 'look') { state.look = { ...state.look, [b.dataset.f]: b.dataset.v }; mine = {}; keepMine(); }   // owner previews their default as-is
    if (act === 'photo-del') state.photo = '';
    if (act === 'img-del') state.projects[i].image = '';
    if (act === 'add') arr.push({ ...BLANK[b.dataset.key] });
    if (act === 'del') arr.splice(i, 1);
    if (act === 'up' && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    if (act === 'down' && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    draw(); refreshPanel();
  });
  panel.addEventListener('change', async e => {
    const el = e.target; if (el.type !== 'file' || !el.files[0]) return;
    if (!assetsNs) { say('Upload gambar belum tersedia di tampilan ini.'); return; }
    say('Mengunggah gambar…');
    try {
      const r = await assetsNs.upload(el.files[0], el.files[0].type ? undefined : { type: 'image/jpeg' });
      const url = '/_blob/' + r.id;
      if (el.id === 's-photo') state.photo = url; else state.projects[Number(el.dataset.img)].image = url;
      draw(); refreshPanel(); say('Gambar terpasang. Klik Simpan supaya tersimpan.');
    } catch (err) {
      say(err?.code === 'too_large' ? 'Gambar terlalu besar, maksimal 20 MB.' : err?.code === 'unsupported_type' ? 'Pakai gambar JPG, PNG atau WebP.' : 'Gambar gagal diunggah. Coba lagi sebentar.');
    }
  });

  // The page is its own record: Simpan publishes a new version built from the settings.
  const RESET = ':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px/1.4 system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}';
  function documentFor(s) {
    const fonts = Array.from(document.querySelectorAll('link[href*="fonts.g"]')).map(l => l.outerHTML).join('\n');
    const json = JSON.stringify(s, null, 2).replace(/</g, '\\u003c');
    return '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>' + RESET + '</style></head><body>'
      + '<title>' + esc(document.title) + '</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' + fonts + '\n'
      + document.getElementById('pf-style').outerHTML + '\n\n<div id="app"></div>\n\n'
      + '<script type="application/json" id="pf-data">' + json + '<\/script>\n\n'
      + ['pf-three', 'pf-gltf', 'pf-room'].map(id => document.getElementById(id).outerHTML).join('\n') + '\n'
      + '<script id="pf-app">' + document.getElementById('pf-app').textContent + '<\/script>\n</body></html>';
  }
  async function save() {
    if (saving) return;
    if (!artifactNs) { say('Menyimpan belum tersedia di tampilan ini.'); return; }
    saving = true; refreshPanel(); say('Menyimpan…');
    // files form: only the page changes, so car.json and other published files are carried over
    try { await artifactNs.publish({ 'index.html': { content: documentFor(state), contentType: 'text/html' } }); saving = false; refreshPanel(); say('Tersimpan. Semua yang buka link ini sekarang lihat versi baru.'); }
    catch (err) {
      saving = false; refreshPanel();
      const code = err?.code;
      if (code === 'conflict') return say('Ada versi lebih baru, halaman dimuat ulang.');
      if (['not_writer', 'not_granted', 'consent_required', 'capability_disabled', 'not_declared'].includes(code)) { closePanel(); ownerBtn.hidden = true; return; }
      say(code === 'too_large' ? 'Halaman terlalu besar untuk disimpan.' : code === 'rate_limited' ? 'Terlalu sering menyimpan. Tunggu sebentar, lalu Simpan lagi.' : 'Gagal menyimpan. Coba Simpan lagi.');
    }
  }

  draw();
  (async () => {
    const c = window.claude; if (!c?.use) return;
    const [u, a, s] = await Promise.all([c.use('user').catch(() => null), c.use('artifact').catch(() => null), c.use('assets').catch(() => null)]);
    artifactNs = a; assetsNs = s;
    const can = Boolean(a) && ((await u?.canEdit?.().catch(() => false)) ?? false);
    ownerBtn.hidden = !can;
  })();
})();
