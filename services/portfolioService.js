'use strict';
// Portfolio page (/portfolio) and its editor, Diriku Panel (/portfolio/panel).
// Everything on the page is one JSON document in server_settings.portfolio (migration 026).
// Nothing saved yet = the built-in example below. Saved documents always go through
// sanitize(), so the page only ever renders known fields, bounded text and http(s) or
// same-site links.
const { query } = require('../lib/db');

const TTL_MS = 5000;
const PLATFORMS = ['youtube', 'tiktok', 'x', 'instagram', 'whatsapp', 'facebook', 'telegram', 'github', 'linkedin', 'threads', 'spotify', 'discord', 'website'];
const RATIOS = ['16 / 9', '4 / 3', '3 / 1'];
// How the avatar's stories open: 'overlay' = a bubble beside the avatar that opens a card next to
// the profile (with a View button for full screen), 'view' = the ring that opens full screen.
const STORY_STYLES = ['overlay', 'view'];
// Backgrounds for text stories.
const STORY_BGS = ['dark', 'light', 'blue', 'pink', 'green', 'orange', 'purple'];

const DEFAULT = Object.freeze({
  name: 'Yannz',
  username: 'yannz2zworld',
  verified: true,
  bio: 'Web developer & content creator.\nMembangun website, API, dan antarmuka yang rapi.',
  location: 'Indonesia',
  website: 'https://github.com/Yannz2zWorld',
  joined: 'Sejak 2024',
  banner: '',
  bannerRatio: '16 / 9',
  avatar: '',
  stats: [{ value: '24', label: 'Proyek' }, { value: '3+', label: 'Tahun' }, { value: '1.2K', label: 'Pengikut' }],
  storyStyle: 'overlay',
  stories: [],
  highlights: [],
  projects: [
    { title: 'REST API Platform', desc: 'Platform API dengan dashboard, billing, dan manajemen API key.', media: '', link: '', tags: ['Node.js', 'Express', 'PostgreSQL'] },
    { title: 'Landing Page UMKM', desc: 'Landing page responsif untuk usaha kecil.', media: '', link: '', tags: ['HTML', 'CSS'] },
    { title: '3D Scene', desc: 'Scene 3D interaktif berbasis three.js.', media: '', link: '/3d', tags: ['three.js'] },
  ],
  skills: ['JavaScript', 'Node.js', 'Express', 'HTML & CSS', 'PostgreSQL', 'UI/UX'],
  experience: [{ when: '2025 — Sekarang', what: 'Full-stack Developer', where: 'Freelance' }],
  contact: { email: '', phone: '' },
  socials: [],
});

const text = (v, n) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, n);
const line = (v, n) => text(v, n).replace(/\s*\n\s*/g, ' ');
const list = (v, max, map) => (Array.isArray(v) ? v : []).slice(0, max).map(map).filter(Boolean);

// A link the page may use as src/href: http(s) or a path on this site. Anything else
// (javascript:, data:, protocol-relative //host, bare words) is dropped.
function url(v) {
  const s = line(v, 1000);
  if (!s) return '';
  if (/^https?:\/\/[^\s/?#]+[^\s]*$/i.test(s)) return s;
  if (/^\/(?!\/)[^\s]*$/.test(s)) return s;
  return null;
}

class InvalidPortfolio extends Error {
  constructor(field, message) { super(message); this.code = 'INVALID_PORTFOLIO'; this.field = field; }
}
function link(v, field) {
  const u = url(v);
  if (u === null) throw new InvalidPortfolio(field, `Link di "${field}" harus diawali https://, http://, atau / (halaman di website ini).`);
  return u;
}

// A story: a photo/GIF/video link with an optional caption, or a text card on a background.
function storyItem(m, field) {
  if (!m || typeof m !== 'object') return null;
  if (m.type === 'text') {
    const t = text(m.text, 280);
    return t ? { type: 'text', text: t, bg: STORY_BGS.includes(m.bg) ? m.bg : 'dark' } : null;
  }
  const src = link(m.media, field);
  return src ? { type: 'media', media: src, caption: line(m.caption, 200) } : null;
}

function sanitize(input) {
  const p = input && typeof input === 'object' ? input : {};
  const name = line(p.name, 60);
  if (!name) throw new InvalidPortfolio('name', 'Nama tidak boleh kosong.');
  const username = line(p.username, 30).replace(/^@+/, '');
  if (!/^[\w.]{1,30}$/.test(username)) throw new InvalidPortfolio('username', 'Username cuma boleh huruf, angka, titik, dan garis bawah (maks. 30).');
  const email = line(p.contact?.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InvalidPortfolio('contact.email', 'Format email tidak valid.');

  return {
    name,
    username,
    verified: p.verified === true,
    bio: text(p.bio, 300),
    location: line(p.location, 60),
    website: link(p.website, 'website'),
    joined: line(p.joined, 40),
    banner: link(p.banner, 'banner'),
    bannerRatio: RATIOS.includes(p.bannerRatio) ? p.bannerRatio : '16 / 9',
    avatar: link(p.avatar, 'avatar'),
    stats: list(p.stats, 6, s => {
      const value = line(s?.value, 12), label = line(s?.label, 30);
      return value || label ? { value, label } : null;
    }),
    storyStyle: STORY_STYLES.includes(p.storyStyle) ? p.storyStyle : 'overlay',
    stories: list(p.stories, 30, (s, i) => storyItem(s, `cerita #${i + 1}`)),
    highlights: list(p.highlights, 20, (h, i) => {
      const items = list(h?.items, 30, (s, j) => storyItem(s, `sorotan #${i + 1} item #${j + 1}`));
      const title = line(h?.title, 30);
      if (!items.length && !title) return null;
      return { title, cover: link(h?.cover, `sampul sorotan #${i + 1}`), items };
    }),
    projects: list(p.projects, 60, (x, i) => {
      const title = line(x?.title, 80);
      const m = link(x?.media, `media proyek #${i + 1}`), l = link(x?.link, `link proyek #${i + 1}`);
      if (!title && !m) return null;
      return { title, desc: text(x?.desc, 600), media: m, link: l, tags: list(x?.tags, 10, t => line(t, 30) || null) };
    }),
    skills: list(p.skills, 40, s => line(s, 40) || null),
    experience: list(p.experience, 30, x => {
      const r = { when: line(x?.when, 40), what: line(x?.what, 80), where: line(x?.where, 80) };
      return r.when || r.what || r.where ? r : null;
    }),
    contact: { email, phone: line(p.contact?.phone, 30).replace(/[^\d+\-\s()]/g, '') },
    socials: list(p.socials, 15, (s, i) => {
      const platform = PLATFORMS.includes(s?.platform) ? s.platform : null;
      if (!platform) return null;
      const raw = line(s?.url, 1000);
      if (!raw) return null;
      // WhatsApp also takes a plain number, turned into a wa.me link.
      const digits = raw.replace(/[\s\-()+]/g, '');
      if (platform === 'whatsapp' && /^\d{8,16}$/.test(digits)) return { platform, url: 'https://wa.me/' + digits };
      const u = link(raw, `sosial media #${i + 1}`);
      return u ? { platform, url: u } : null;
    }),
  };
}

let cached = null, cachedAt = 0;
async function get() {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  let row = null;
  try {
    row = (await query('SELECT to_jsonb(server_settings.*) AS s FROM server_settings WHERE id=1'))[0]?.s || null;
  } catch (e) {
    console.error('Portfolio read failed:', { code: e?.code || null });
  }
  let profile = DEFAULT, saved = false;
  if (row?.portfolio && typeof row.portfolio === 'object') {
    try { profile = sanitize(row.portfolio); saved = true; } catch { profile = DEFAULT; }
  }
  cached = { profile, saved, updatedAt: row?.portfolio_updated_at || null };
  cachedAt = Date.now();
  return cached;
}

async function save(input, userId) {
  const profile = sanitize(input);
  const r = await query('UPDATE server_settings SET portfolio=$1::jsonb, portfolio_updated_at=now(), updated_by=$2 WHERE id=1 RETURNING portfolio_updated_at', [JSON.stringify(profile), userId]);
  cached = { profile, saved: true, updatedAt: r[0]?.portfolio_updated_at || null };
  cachedAt = Date.now();
  return cached;
}

async function reset(userId) {
  await query('UPDATE server_settings SET portfolio=NULL, portfolio_updated_at=now(), updated_by=$1 WHERE id=1', [userId]);
  cached = null;
}

// JSON for an inline <script>: no "</script>" or "<!--" can end or open anything early.
const inlineJson = v => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

module.exports = { DEFAULT, PLATFORMS, RATIOS, STORY_STYLES, STORY_BGS, sanitize, get, save, reset, inlineJson, InvalidPortfolio };
