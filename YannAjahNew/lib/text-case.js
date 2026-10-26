'use strict';
// Transformasi teks (huruf besar/kecil, gaya penulisan, urutan, pembersihan).
const { textTool } = require('../library/plugin-kit');

const words = t => t.trim().split(/[\s_\-.]+|(?<=[a-z0-9])(?=[A-Z])/).filter(Boolean);
const lowerWords = t => words(t).map(w => w.toLowerCase());
const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
const shuffle = a => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = require('crypto').randomInt(0, i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };

const T = (name, description, fn, tests, extra = {}) => textTool({ id: `text.${name}`, name, category: 'text', description, fn, tests, ...extra });

module.exports = { lowerWords, cap, shuffle, T };
