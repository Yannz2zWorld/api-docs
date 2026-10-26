'use strict';
const { UsageError } = require('../../library/errors');
const { T, hexToRgb, rgbToHsl, toHex } = require('../../lib/devtools');

module.exports = T('color', 'Konversi warna HEX ↔ RGB ↔ HSL', t => { const s = t.trim(); let rgb = hexToRgb(s); if (!rgb) { const m = /^rgb\(?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/i.exec(s); if (m) rgb = m.slice(1).map(Number); } if (!rgb || rgb.some(v => v > 255)) throw new UsageError('Format: #ff8800 atau rgb(255,136,0)'); const [h, sa, l] = rgbToHsl(rgb); return `HEX: ${toHex(rgb)}\nRGB: rgb(${rgb.join(', ')})\nHSL: hsl(${h}, ${sa}%, ${l}%)`; }, [{ input: '#ff8800', expect: 'HEX: #FF8800\nRGB: rgb(255, 136, 0)\nHSL: hsl(32, 100%, 50%)' }], { aliases: ['warna'] });
