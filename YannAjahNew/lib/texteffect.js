'use strict';
// Efek teks bergaya ephoto360 (V15: .glowingtext, .luxurygold, .makingneon, ...), digambar lokal dengan
// canvas — tanpa API pihak ketiga. Satu command per gaya (plugins/maker/<nama>.js).
const { canvas, fit, font, png } = require('../library/canvas');
const { feature, inputText } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');

const W = 1280, H = 720;
const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function linear(g, stops, x0 = 0, y0 = 0, x1 = 0, y1 = H) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
  return gr;
}
function radialBg(g, inner, outer) {
  const gr = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.75);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
function stars(g, n, color = '#fff', rnd = seeded(7)) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) { g.globalAlpha = 0.3 + rnd() * 0.7; g.beginPath(); g.arc(rnd() * W, rnd() * H, rnd() * 2.2, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
}
function blobs(g, colors, n = 6, rnd = seeded(11)) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 260;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, colors[i % colors.length]); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
}

// Tata letak teks di tengah; draw(g, line, x, y, size) dipanggil per baris.
function layout(g, text, { bold = true, maxW = W - 160, maxH = H - 200, start = 170 } = {}, draw) {
  const f = fit(g, text, maxW, maxH, { start, min: 28, bold, lineHeight: 1.15 });
  g.font = font(f.size, bold); g.textAlign = 'center'; g.textBaseline = 'middle';
  const top = H / 2 - ((f.lines.length - 1) * f.size * 1.15) / 2;
  f.lines.forEach((l, i) => draw(g, l, W / 2, top + i * f.size * 1.15, f.size));
}
const glow = (g, color, blur) => { g.shadowColor = color; g.shadowBlur = blur; };
const noGlow = g => { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0; };
function neon(color, bg = '#07040f') {
  return (g, t) => {
    radialBg(g, '#140a24', bg);
    layout(g, t, {}, (g, l, x, y, s) => {
      g.lineWidth = Math.max(3, s / 22); g.strokeStyle = color;
      for (const b of [60, 30, 12]) { glow(g, color, b); g.strokeText(l, x, y); }
      noGlow(g); g.fillStyle = '#ffffff'; g.globalAlpha = 0.9; g.fillText(l, x, y); g.globalAlpha = 1;
    });
  };
}
function metal(stops, bg, edge) {
  return (g, t) => {
    bg(g);
    layout(g, t, {}, (g, l, x, y, s) => {
      g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 18; g.shadowOffsetY = s / 14;
      g.fillStyle = linear(g, stops, 0, y - s / 2, 0, y + s / 2); g.fillText(l, x, y); noGlow(g);
      g.lineWidth = Math.max(2, s / 40); g.strokeStyle = edge; g.strokeText(l, x, y);
    });
  };
}
function button(fill, plate, label) {
  return (g, t) => {
    radialBg(g, '#2b2b2b', '#0b0b0b');
    g.save(); g.translate(W / 2, H / 2 - 40);
    const gr = g.createLinearGradient(-200, -220, 200, 220); fill.forEach((c, i) => gr.addColorStop(i / (fill.length - 1), c));
    g.fillStyle = gr; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40;
    g.beginPath(); g.roundRect(-230, -230, 460, 400, 40); g.fill(); noGlow(g);
    g.fillStyle = '#ff0000'; g.beginPath(); g.roundRect(-110, -170, 220, 150, 36); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-30, -135); g.lineTo(-30, -55); g.lineTo(45, -95); g.closePath(); g.fill();
    g.fillStyle = plate; g.beginPath(); g.roundRect(-180, 30, 360, 100, 14); g.fill();
    g.fillStyle = '#222'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const f = fit(g, t, 330, 80, { start: 54, min: 18, bold: true }); g.font = font(f.size, true); g.fillText(f.lines[0], 0, 80);
    g.restore();
    g.fillStyle = '#d8d8d8'; g.font = font(30, true); g.textAlign = 'center'; g.fillText(label, W / 2, H - 70);
  };
}

const STYLES = {
  glowingtext: ['Teks bercahaya (glowing)', neon('#00e5ff')],
  makingneon: ['Teks neon pink', neon('#ff2bd6')],
  multicoloredneon: ['Teks neon warna-warni', (g, t) => {
    radialBg(g, '#120720', '#050208');
    layout(g, t, {}, (g, l, x, y, s) => {
      const gr = linear(g, ['#ff2bd6', '#ffd400', '#00ff9d', '#00b3ff', '#b14bff'], x - g.measureText(l).width / 2, 0, x + g.measureText(l).width / 2, 0);
      g.lineWidth = Math.max(3, s / 20); g.strokeStyle = gr;
      for (const b of [50, 22]) { glow(g, '#ffffff', b); g.strokeText(l, x, y); }
      noGlow(g); g.strokeText(l, x, y);
    });
  }],
  advancedglow: ['Teks glow tingkat lanjut', neon('#7cff00', '#020a02')],
  lighteffects: ['Teks efek cahaya', (g, t) => {
    radialBg(g, '#1a1033', '#04020a'); blobs(g, ['rgba(255,200,80,.35)', 'rgba(120,80,255,.35)', 'rgba(0,200,255,.3)'], 7);
    layout(g, t, {}, (g, l, x, y) => { glow(g, '#ffe9a8', 45); g.fillStyle = '#fff6da'; g.fillText(l, x, y); noGlow(g); });
  }],
  incandescent: ['Teks bohlam pijar', (g, t) => {
    radialBg(g, '#2a1606', '#080402');
    layout(g, t, {}, (g, l, x, y, s) => {
      glow(g, '#ff9a1f', 60); g.fillStyle = '#ffd27a'; g.fillText(l, x, y);
      noGlow(g); g.lineWidth = Math.max(2, s / 50); g.strokeStyle = '#fff3cf'; g.strokeText(l, x, y);
    });
  }],
  luxurygold: ['Teks emas mewah', metal(['#fff3b0', '#d4a017', '#8a5a00', '#ffd76a', '#a8740a'], g => radialBg(g, '#1d1d1d', '#000'), '#5a3a00')],
  royaltext: ['Teks royal ungu-emas', metal(['#fff1a8', '#e3b23c', '#9b6a12'], g => { radialBg(g, '#3a0f5c', '#12031f'); stars(g, 80, '#e3b23c'); }, '#4b2a00')],
  silvertext: ['Teks perak metalik', metal(['#ffffff', '#b8b8b8', '#6b6b6b', '#e6e6e6', '#8c8c8c'], g => radialBg(g, '#23272e', '#05070a'), '#3a3a3a')],
  galaxywallpaper: ['Teks wallpaper galaksi', (g, t) => {
    g.fillStyle = '#05010f'; g.fillRect(0, 0, W, H); blobs(g, ['rgba(140,60,255,.45)', 'rgba(255,60,180,.35)', 'rgba(40,140,255,.35)'], 8); stars(g, 400);
    layout(g, t, {}, (g, l, x, y) => { glow(g, '#c79bff', 35); g.fillStyle = linear(g, ['#ffffff', '#d7c2ff', '#ff9be0'], 0, y - 60, 0, y + 60); g.fillText(l, x, y); noGlow(g); });
  }],
  nightstars: ['Teks langit malam berbintang', (g, t) => {
    g.fillStyle = linear(g, ['#020b2b', '#0a1f4d', '#1b2f6b']); g.fillRect(0, 0, W, H); stars(g, 500);
    g.fillStyle = '#fff8d6'; glow(g, '#fff3b0', 50); g.beginPath(); g.arc(W - 170, 140, 60, 0, Math.PI * 2); g.fill(); noGlow(g);
    layout(g, t, {}, (g, l, x, y) => { glow(g, '#9fc4ff', 28); g.fillStyle = '#eaf2ff'; g.fillText(l, x, y); noGlow(g); });
  }],
  gradienttext: ['Teks gradasi warna', (g, t) => {
    g.fillStyle = '#0f0f17'; g.fillRect(0, 0, W, H);
    layout(g, t, {}, (g, l, x, y) => { const w = g.measureText(l).width; g.fillStyle = linear(g, ['#ff512f', '#f09819', '#ffd200', '#3ad29f', '#2f80ed', '#b24bf3'], x - w / 2, 0, x + w / 2, 0); g.fillText(l, x, y); });
  }],
  sunlight: ['Teks cahaya matahari', (g, t) => {
    g.fillStyle = linear(g, ['#ffb347', '#ffcc33', '#fff1b8']); g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, -80); for (let i = 0; i < 18; i++) { g.rotate(Math.PI / 9); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-40, 1200); g.lineTo(40, 1200); g.fill(); } g.restore();
    layout(g, t, {}, (g, l, x, y, s) => { g.shadowColor = 'rgba(160,80,0,.5)'; g.shadowBlur = 20; g.shadowOffsetY = s / 16; g.fillStyle = '#fff'; g.fillText(l, x, y); noGlow(g); g.lineWidth = s / 30; g.strokeStyle = '#e07b00'; g.strokeText(l, x, y); });
  }],
  summerbeach: ['Teks pantai musim panas', (g, t) => {
    g.fillStyle = linear(g, ['#38bdf8', '#7dd3fc', '#bae6fd'], 0, 0, 0, H * 0.6); g.fillRect(0, 0, W, H * 0.62);
    g.fillStyle = linear(g, ['#0ea5e9', '#0369a1'], 0, H * 0.55, 0, H * 0.72); g.fillRect(0, H * 0.55, W, H * 0.17);
    g.fillStyle = linear(g, ['#fde68a', '#f5c66b'], 0, H * 0.7, 0, H); g.fillRect(0, H * 0.7, W, H * 0.3);
    g.fillStyle = '#fff7b0'; glow(g, '#fff3a0', 60); g.beginPath(); g.arc(W - 200, 120, 70, 0, Math.PI * 2); g.fill(); noGlow(g);
    layout(g, t, { maxH: H - 320 }, (g, l, x, y, s) => { g.lineWidth = s / 9; g.strokeStyle = '#ff6b35'; g.lineJoin = 'round'; g.strokeText(l, x, y); g.fillStyle = '#ffffff'; g.fillText(l, x, y); });
  }],
  sandsummer: ['Teks tulisan di pasir', (g, t) => {
    g.fillStyle = linear(g, ['#f3d9a4', '#e6c182', '#d4a95e']); g.fillRect(0, 0, W, H);
    const r = seeded(3); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${120 + r() * 60},${90 + r() * 40},40,${r() * 0.25})`; g.fillRect(r() * W, r() * H, 2, 2); }
    layout(g, t, {}, (g, l, x, y, s) => { g.fillStyle = 'rgba(120,80,30,.55)'; g.fillText(l, x + s / 30, y + s / 30); g.fillStyle = 'rgba(255,240,210,.55)'; g.fillText(l, x - s / 40, y - s / 40); g.fillStyle = '#c9984d'; g.fillText(l, x, y); });
  }],
  underwatertext: ['Teks bawah laut', (g, t) => {
    g.fillStyle = linear(g, ['#0ea5e9', '#0369a1', '#082f49']); g.fillRect(0, 0, W, H);
    const r = seeded(5); g.strokeStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 60; i++) { g.lineWidth = 2; g.beginPath(); g.arc(r() * W, r() * H, 4 + r() * 14, 0, Math.PI * 2); g.stroke(); }
    layout(g, t, {}, (g, l, x, y) => { glow(g, '#67e8f9', 30); g.fillStyle = linear(g, ['#ecfeff', '#a5f3fc', '#22d3ee'], 0, y - 60, 0, y + 60); g.fillText(l, x, y); noGlow(g); });
  }],
  watercolortext: ['Teks cat air', (g, t) => {
    g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, W, H); blobs(g, ['rgba(255,110,150,.35)', 'rgba(90,170,255,.35)', 'rgba(255,200,80,.35)', 'rgba(120,220,160,.35)'], 10);
    layout(g, t, {}, (g, l, x, y) => { g.globalAlpha = 0.85; g.fillStyle = linear(g, ['#e8436f', '#7b5cff', '#1fa2ff'], x - 400, 0, x + 400, 0); g.fillText(l, x, y); g.globalAlpha = 1; });
  }],
  effectclouds: ['Teks di awan', (g, t) => {
    g.fillStyle = linear(g, ['#60a5fa', '#93c5fd', '#dbeafe']); g.fillRect(0, 0, W, H);
    const r = seeded(9); for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H, s = 60 + r() * 120; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2); }
    layout(g, t, {}, (g, l, x, y, s) => { g.shadowColor = 'rgba(30,64,175,.55)'; g.shadowBlur = 25; g.shadowOffsetY = s / 18; g.lineWidth = s / 14; g.lineJoin = 'round'; g.strokeStyle = '#2563eb'; g.strokeText(l, x, y); noGlow(g); g.fillStyle = '#ffffff'; g.fillText(l, x, y); });
  }],
  wood: ['Teks ukiran kayu', (g, t) => {
    g.fillStyle = '#8b5a2b'; g.fillRect(0, 0, W, H);
    const r = seeded(13); for (let y = 0; y < H; y += 3) { g.strokeStyle = `rgba(60,30,10,${0.08 + r() * 0.18})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 80) g.lineTo(x, y + Math.sin(x / 120 + y / 40) * 6); g.stroke(); }
    layout(g, t, {}, (g, l, x, y, s) => { g.fillStyle = 'rgba(255,220,170,.35)'; g.fillText(l, x + s / 40, y + s / 40); g.fillStyle = '#3b2210'; g.fillText(l, x, y); });
  }],
  papercutstyle: ['Teks gaya papercut berlapis', (g, t) => {
    g.fillStyle = '#ffe4e6'; g.fillRect(0, 0, W, H);
    ['#fda4af', '#fb7185', '#f43f5e', '#e11d48'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 40) g.lineTo(x, H - 140 - i * 70 + Math.sin(x / 90 + i) * 30); g.lineTo(W, H); g.fill(); });
    layout(g, t, { maxH: H - 360 }, (g, l, x, y, s) => { g.fillStyle = '#9f1239'; g.fillText(l, x + s / 18, y + s / 18); g.fillStyle = '#ffffff'; g.fillText(l, x, y); });
  }],
  flagtext: ['Teks bendera merah putih', (g, t) => {
    g.fillStyle = '#e11d2a'; g.fillRect(0, 0, W, H / 2); g.fillStyle = '#ffffff'; g.fillRect(0, H / 2, W, H / 2);
    layout(g, t, {}, (g, l, x, y, s) => { g.lineWidth = s / 8; g.strokeStyle = '#111'; g.lineJoin = 'round'; g.strokeText(l, x, y); g.fillStyle = linear(g, ['#e11d2a', '#e11d2a', '#ffffff', '#ffffff'], 0, y - s / 2, 0, y + s / 2); g.fillText(l, x, y); });
  }],
  flag3dtext: ['Teks 3D bendera merah putih', (g, t) => {
    radialBg(g, '#2b2b2b', '#0a0a0a');
    layout(g, t, {}, (g, l, x, y, s) => { for (let d = Math.round(s / 8); d > 0; d--) { g.fillStyle = d % 2 ? '#7a0d14' : '#8e1018'; g.fillText(l, x + d, y + d); } g.fillStyle = linear(g, ['#ff3b47', '#e11d2a', '#ffffff', '#f2f2f2'], 0, y - s / 2, 0, y + s / 2); g.fillText(l, x, y); });
  }],
  deletingtext: ['Teks sedang dihapus (glitch)', (g, t) => {
    g.fillStyle = '#0b0b0f'; g.fillRect(0, 0, W, H);
    layout(g, t, {}, (g, l, x, y, s) => {
      g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,0,80,.8)'; g.fillText(l, x - s / 25, y); g.fillStyle = 'rgba(0,255,255,.8)'; g.fillText(l, x + s / 25, y); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#ffffff'; g.fillText(l, x, y);
      const r = seeded(l.length + 1); for (let i = 0; i < 14; i++) { g.fillStyle = '#0b0b0f'; g.fillRect(x - 500 + r() * 1000, y - s / 2 + r() * s, 40 + r() * 220, 4 + r() * 10); }
    });
  }],
  horor: ['Teks horor berdarah', (g, t) => {
    radialBg(g, '#1a0000', '#000000');
    layout(g, t, {}, (g, l, x, y, s) => {
      glow(g, '#ff0000', 30); g.fillStyle = '#b30000'; g.fillText(l, x, y); noGlow(g);
      const w = g.measureText(l).width; const r = seeded(l.length * 7 + 3);
      g.fillStyle = '#8a0000'; for (let i = 0; i < Math.max(4, l.length); i++) { const dx = x - w / 2 + r() * w, len = 20 + r() * s; g.fillRect(dx, y + s * 0.3, 4 + r() * 6, len); g.beginPath(); g.arc(dx + 4, y + s * 0.3 + len, 6, 0, Math.PI * 2); g.fill(); }
    });
  }],
  dragonfire: ['Teks api naga', (g, t) => {
    radialBg(g, '#2a0800', '#050100'); blobs(g, ['rgba(255,90,0,.45)', 'rgba(255,200,0,.3)'], 6);
    layout(g, t, {}, (g, l, x, y, s) => { glow(g, '#ff4d00', 55); g.fillStyle = linear(g, ['#fff7ae', '#ffcc00', '#ff6a00', '#c41e00'], 0, y - s / 2, 0, y + s / 2); g.fillText(l, x, y); noGlow(g); });
  }],
  '1917style': ['Teks gaya poster film 1917', (g, t) => {
    g.fillStyle = linear(g, ['#2b2b2b', '#4a3b2a', '#1a1a1a']); g.fillRect(0, 0, W, H);
    const r = seeded(17); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,240,220,${r() * 0.06})`; g.fillRect(r() * W, r() * H, 2, 2); }
    layout(g, t, { start: 200 }, (g, l, x, y) => { glow(g, '#ff7a1a', 40); g.fillStyle = '#f2e6d0'; g.fillText(l.toUpperCase(), x, y); noGlow(g); });
  }],
  logomaker: ['Logo teks sederhana', (g, t) => {
    g.fillStyle = '#0f172a'; g.fillRect(0, 0, W, H);
    g.fillStyle = linear(g, ['#22d3ee', '#6366f1'], W / 2 - 110, 120, W / 2 + 110, 340); g.beginPath(); g.roundRect(W / 2 - 110, 110, 220, 220, 48); g.fill();
    g.fillStyle = '#fff'; g.font = font(150, true); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText([...String(t).trim()][0]?.toUpperCase() || 'Y', W / 2, 222);
    const f = fit(g, t, W - 200, 160, { start: 110, min: 28, bold: true }); g.font = font(f.size, true); g.fillStyle = '#e2e8f0'; f.lines.slice(0, 2).forEach((l, i) => g.fillText(l, W / 2, 470 + i * f.size * 1.1));
  }],
  goldbutton: ['Gold Play Button YouTube', button(['#fff1a8', '#e3b23c', '#9b6a12', '#f6d36b'], '#f6e7b0', 'GOLD PLAY BUTTON')],
  silverbutton: ['Silver Play Button YouTube', button(['#ffffff', '#c9c9c9', '#7d7d7d', '#e6e6e6'], '#eeeeee', 'SILVER PLAY BUTTON')]
};
const ALIASES = { goldbutton: ['ytgoldbutton'], silverbutton: ['ytsilverbutton'], silvertext: [], glowingtext: [], deletingtext: [] };

function drawEffect(name, text) {
  const { c, g } = canvas(W, H);
  STYLES[name][1](g, String(text).slice(0, 80));
  return png(c);
}

function textEffect(name) {
  if (!STYLES[name]) throw new Error(`Efek '${name}' tidak ada`);
  const [desc] = STYLES[name];
  return feature({
    id: `maker.${name}`, name, aliases: ALIASES[name] || [], category: 'maker', description: `${desc}: .${name} <teks>`, usage: '<teks>', cooldown: 5, limit: 1,
    async run(ctx) {
      const t = inputText(ctx);
      if (!t) throw new UsageError(`Teksnya mana? Contoh: ${ctx.prefix}${ctx.command} YannAjah`);
      if (t.length > 80) throw new UsageError('Teks maksimal 80 karakter.');
      await ctx.sendFile({ buffer: drawEffect(name, t), mime: 'image/png' }, { caption: `✨ ${desc}` });
    }
  });
}

module.exports = { STYLES, drawEffect, textEffect };
