'use strict';
// Menu dibangun otomatis dari feature registry (bukan teks statis seperti menu.js base),
// jadi menu selalu sama dengan fitur yang benar-benar terdaftar dan statusnya.

const CATEGORY_LABELS = {
  core: '🧩 Utama', info: 'ℹ️ Info', group: '👥 Grup', owner: '👑 Owner', user: '🙋 User', economy: '💰 Ekonomi', game: '🎮 Game',
  fun: '🎉 Fun', text: '🔤 Teks', convert: '🔁 Konversi', calc: '🧮 Kalkulator', dev: '🛠️ Developer', security: '🔐 Keamanan',
  datetime: '🗓️ Waktu', random: '🎲 Random', islamic: '🕌 Islami', productivity: '📝 Produktivitas', media: '🎞️ Media', sticker: '🖼️ Stiker',
  ai: '🤖 AI', downloader: '📥 Downloader', search: '🔎 Search', tools: '🧰 Tools', maker: '🎨 Maker', canvas: '🖌️ Canvas', stalk: '👀 Stalk',
  news: '📰 Berita', anime: '🍥 Anime', primbon: '🔮 Primbon', textpro: '✒️ Textpro', image: '🖼️ Image', check: '✅ Check', movie: '🎬 Movie',
  music: '🎵 Musik', ephoto: '📸 Ephoto', games: '🎯 Game API', legacy: '📦 Legacy'
};

const label = c => CATEGORY_LABELS[c] || `📁 ${c.charAt(0).toUpperCase()}${c.slice(1)}`;

function visible(registry, f, statusOpts) {
  const s = registry.effectiveStatus(f, statusOpts);
  return s !== 'planned' && s !== 'disabled';
}

function buildMenu(registry, { prefix = '.', category = null, statusOpts = {}, botName = 'YannAjahNew', isOwner = false } = {}) {
  const cats = registry.categories();
  const names = Object.keys(cats).filter(c => isOwner || c !== 'owner').sort((a, b) => label(a).localeCompare(label(b)));
  if (!category) {
    const lines = names.map(c => `│▣ ${prefix}menu ${c} — ${label(c)} (${cats[c].filter(f => visible(registry, f, statusOpts)).length})`);
    return `╭─❏ *${botName}*\n│ Ketik ${prefix}menu <kategori>\n│ ${prefix}allmenu untuk semua\n├─❏ Kategori\n${lines.join('\n')}\n╰─❏`;
  }
  const c = String(category).toLowerCase();
  if (!cats[c]) return null;
  const list = cats[c].filter(f => visible(registry, f, statusOpts)).sort((a, b) => a.name.localeCompare(b.name));
  return `╭─❏ ${label(c)}\n${list.map(f => `│▣ ${prefix}${f.name}${f.usage ? ' ' + f.usage : ''}${f.permission !== 'user' ? ` (${f.permission})` : ''}`).join('\n')}\n╰─❏`;
}

function buildAllMenu(registry, opts = {}) {
  return Object.keys(registry.categories()).filter(c => opts.isOwner || c !== 'owner').sort().map(c => buildMenu(registry, { ...opts, category: c })).filter(Boolean).join('\n\n');
}

module.exports = { buildMenu, buildAllMenu, CATEGORY_LABELS, label };
