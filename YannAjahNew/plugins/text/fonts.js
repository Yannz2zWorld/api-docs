'use strict';
// Gaya huruf Unicode (V15: font1..font10, dsb.). Setiap gaya memetakan A-Z/a-z/0-9 ke blok
// "Mathematical Alphanumeric Symbols" atau tabel khusus, dengan pengecualian huruf yang memang
// berada di blok Letterlike Symbols.
const { textTool } = require('../../library/plugin-kit');

function offsetMap(upper, lower, digit, exceptions = {}) {
  return c => {
    if (exceptions[c]) return exceptions[c];
    const x = c.codePointAt(0);
    if (upper != null && x >= 65 && x <= 90) return String.fromCodePoint(upper + x - 65);
    if (lower != null && x >= 97 && x <= 122) return String.fromCodePoint(lower + x - 97);
    if (digit != null && x >= 48 && x <= 57) return String.fromCodePoint(digit + x - 48);
    return c;
  };
}
const tableMap = (from, to) => { const m = new Map([...from].map((c, i) => [c, [...to][i]])); return c => m.get(c) ?? c; };
const apply = fn => t => [...t].map(fn).join('');

const STYLES = {
  bold: ['Huruf tebal serif', offsetMap(0x1D400, 0x1D41A, 0x1D7CE), 'Ab1', '𝐀𝐛𝟏'],
  italic: ['Huruf miring serif', offsetMap(0x1D434, 0x1D44E, null, { h: 'ℎ' }), 'Ah', '𝐴ℎ'],
  bolditalic: ['Tebal miring serif', offsetMap(0x1D468, 0x1D482), 'Ab', '𝑨𝒃'],
  script: ['Huruf sambung', offsetMap(0x1D49C, 0x1D4B6, null, { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' }), 'Ae', '𝒜ℯ'],
  boldscript: ['Huruf sambung tebal', offsetMap(0x1D4D0, 0x1D4EA), 'Ab', '𝓐𝓫'],
  fraktur: ['Gotik (fraktur)', offsetMap(0x1D504, 0x1D51E, null, { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }), 'Ca', 'ℭ𝔞'],
  boldfraktur: ['Gotik tebal', offsetMap(0x1D56C, 0x1D586), 'Ab', '𝕬𝖇'],
  doublestruck: ['Garis ganda (blackboard)', offsetMap(0x1D538, 0x1D552, 0x1D7D8, { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }), 'Rb1', 'ℝ𝕓𝟙'],
  sans: ['Sans-serif', offsetMap(0x1D5A0, 0x1D5BA, 0x1D7E2), 'Ab1', '𝖠𝖻𝟣'],
  sansbold: ['Sans-serif tebal', offsetMap(0x1D5D4, 0x1D5EE, 0x1D7EC), 'Ab1', '𝗔𝗯𝟭'],
  sansitalic: ['Sans-serif miring', offsetMap(0x1D608, 0x1D622), 'Ab', '𝘈𝘣'],
  sansbolditalic: ['Sans-serif tebal miring', offsetMap(0x1D63C, 0x1D656), 'Ab', '𝘼𝙗'],
  monospace: ['Monospace', offsetMap(0x1D670, 0x1D68A, 0x1D7F6), 'Ab1', '𝙰𝚋𝟷'],
  fullwidth: ['Lebar penuh (vaporwave)', c => (c === ' ' ? '　' : c.codePointAt(0) >= 33 && c.codePointAt(0) <= 126 ? String.fromCodePoint(c.codePointAt(0) + 0xFEE0) : c), 'Ab 1', 'Ａｂ　１'],
  circled: ['Huruf dalam lingkaran', c => { const x = c.codePointAt(0); if (x >= 65 && x <= 90) return String.fromCodePoint(0x24B6 + x - 65); if (x >= 97 && x <= 122) return String.fromCodePoint(0x24D0 + x - 97); if (x === 48) return '⓪'; if (x >= 49 && x <= 57) return String.fromCodePoint(0x2460 + x - 49); return c; }, 'Ab0', 'Ⓐⓑ⓪'],
  squared: ['Huruf dalam kotak', c => { const x = c.toUpperCase().codePointAt(0); return x >= 65 && x <= 90 ? String.fromCodePoint(0x1F130 + x - 65) : c; }, 'ab', '🄰🄱'],
  negsquared: ['Kotak hitam', c => { const x = c.toUpperCase().codePointAt(0); return x >= 65 && x <= 90 ? String.fromCodePoint(0x1F170 + x - 65) : c; }, 'ab', '🅰🅱'],
  smallcaps: ['Kapital kecil', tableMap('abcdefghijklmnopqrstuvwxyz', 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ'), 'halo', 'ʜᴀʟᴏ'],
  superscript: ['Superskrip', tableMap('abcdefghijklmnoprstuvwxyz0123456789+-=()', 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾'), 'x2', 'ˣ²'],
  subscript: ['Subskrip', tableMap('aehijklmnoprstuvx0123456789+-=()', 'ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎'), 'h2o', 'ₕ₂ₒ'],
  upsidedown: ['Terbalik (upside down)', null, 'abc', 'ɔqɐ'],
  strike: ['Coret', c => (c === ' ' ? c : c + '̶'), 'ab', 'a̶b̶'],
  underline: ['Garis bawah', c => (c === ' ' ? c : c + '̲'), 'ab', 'a̲b̲'],
  bubble: ['Gelembung (lingkaran kosong huruf kecil)', c => { const x = c.toLowerCase().codePointAt(0); return x >= 97 && x <= 122 ? String.fromCodePoint(0x24D0 + x - 97) : c; }, 'AB', 'ⓐⓑ']
};
const FLIP = tableMap('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?\'"()[]{}<>_&', 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz∀ᗺƆᗡƎℲ⅁HIſꓘ˥WNOԀΌᴚS⊥∩ΛMX⅄Z0ƖᄅƐㄣϛ9ㄥ86˙\'¡¿,„)(][}{><‾⅋');
const upsideDown = t => [...t].map(FLIP).reverse().join('');

module.exports = [
  ...Object.entries(STYLES).map(([name, [desc, fn, input, expect]]) => textTool({
    id: `font.${name}`, name: `font${name}`, category: 'text', description: `Gaya huruf: ${desc}`,
    fn: name === 'upsidedown' ? upsideDown : apply(fn), tests: [{ input, expect }]
  })),
  textTool({ id: 'font.all', name: 'fancy', aliases: ['font'], category: 'text', description: 'Tampilkan teks dalam semua gaya huruf', maxInput: 200,
    fn: t => Object.entries(STYLES).map(([n, [, fn]]) => `*${n}*: ${n === 'upsidedown' ? upsideDown(t) : apply(fn)(t)}`).join('\n'),
    tests: [{ input: 'Ab', expect: o => o.includes('𝐀𝐛') && o.split('\n').length === Object.keys(STYLES).length }] }),
  textTool({ id: 'text.zalgo', name: 'zalgo', category: 'text', description: 'T̷e̶k̸s̵ ̶z̴a̷l̵g̸o̶ (glitch)', maxInput: 300,
    fn: t => [...t].map(c => (c === ' ' ? c : c + Array.from({ length: 3 }, () => String.fromCharCode(0x0300 + require('crypto').randomInt(0, 0x6f))).join(''))).join(''),
    tests: [{ input: 'ab', expect: o => o.normalize('NFD').replace(/[̀-ͯ]/g, '') === 'ab' }] })
];
