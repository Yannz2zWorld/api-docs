'use strict';
// Pengganti `canvas` yang dipakai V15 untuk kartu/testimoni/brat/quote: @napi-rs/canvas (biner siap
// pakai, tanpa build tool). Font DejaVu dibundel di assets/fonts agar teks tetap tampil di VPS
// minimal; emoji berwarna tampil kalau sistem punya fonts-noto-color-emoji.

const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  fontsReady = true;
  for (const f of fs.existsSync(FONT_DIR) ? fs.readdirSync(FONT_DIR) : []) if (/\.(ttf|otf)$/i.test(f)) GlobalFonts.registerFromPath(path.join(FONT_DIR, f), 'YannSans');
  for (const p of ['/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', '/usr/share/fonts/noto/NotoColorEmoji.ttf']) if (fs.existsSync(p)) { GlobalFonts.registerFromPath(p, 'YannEmoji'); break; }
}
const FONT = 'YannSans, YannEmoji, sans-serif';
const font = (size, bold = false) => `${bold ? 'bold ' : ''}${Math.round(size)}px ${FONT}`;

function canvas(w, h) { ensureFonts(); const c = createCanvas(w, h); return { c, g: c.getContext('2d') }; }

// Pecah teks ke baris yang muat di lebar `max` (kata terlalu panjang dipotong per karakter).
function wrap(g, text, max) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (g.measureText(w).width > max) {
        let i = w.length - 1;
        while (i > 1 && g.measureText(w.slice(0, i)).width > max) i--;
        if (line) { lines.push(line); line = ''; }
        lines.push(w.slice(0, i)); w = w.slice(i);
      }
      const t = line ? `${line} ${w}` : w;
      if (g.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t;
    }
    lines.push(line);
  }
  return lines;
}

// Ukuran font terbesar (<= start) agar teks muat dalam kotak w x h.
function fit(g, text, w, h, { start = 120, min = 14, bold = false, lineHeight = 1.2 } = {}) {
  for (let s = start; s >= min; s -= 2) {
    g.font = font(s, bold);
    const lines = wrap(g, text, w);
    if (lines.length * s * lineHeight <= h) return { size: s, lines };
  }
  g.font = font(min, bold);
  return { size: min, lines: wrap(g, text, w) };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

const png = c => c.toBuffer('image/png');

module.exports = { canvas, wrap, fit, font, roundRect, png, loadImage, FONT };
