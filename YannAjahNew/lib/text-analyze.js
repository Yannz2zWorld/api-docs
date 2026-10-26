'use strict';
// Analisis teks: statistik, frekuensi kata, palindrom, anagram, waktu baca, lorem ipsum.
const { textTool, feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');

const norm = s => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
const T = (name, description, fn, tests, extra = {}) => textTool({ id: `analyze.${name}`, name, category: 'text', description, fn, tests, ...extra });

const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat'.split(' ');

module.exports = { norm, T, LOREM };
