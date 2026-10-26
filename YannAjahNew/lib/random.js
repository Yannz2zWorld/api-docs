'use strict';
// Gambar acak dari daftar URL dataset V15 (data/random/*.json). Set foto orang biasa (bukan publik figur) sengaja tidak disertakan.
const path = require('path');
const crypto = require('crypto');
const { feature } = require('../library/plugin-kit');

const SETS = {
  randomkucing: ['kucing', 'Foto kucing acak'], randomanjing: ['anjing', 'Foto anjing acak'], wallpaperhp: ['wallhp', 'Wallpaper HP acak'],
  wallpaperml: ['wallml', 'Wallpaper Mobile Legends acak'], aesthetic: ['aesthetic', 'Gambar aesthetic acak'], randommobil: ['mobil', 'Foto mobil acak'],
  randommotor: ['montor', 'Foto motor acak'], randomboneka: ['boneka', 'Foto boneka acak'], wallpaperpubg: ['pubg', 'Wallpaper PUBG acak'],
  randomkpop: ['kpop', 'Foto idol K-Pop acak'], randomblackpink: ['blackpink', 'Foto BLACKPINK acak'], randomrose: ['rose', 'Foto Rosé BLACKPINK acak'],
  randomryujin: ['ryujin', 'Foto Ryujin ITZY acak'], randomcosplay: ['cosplay', 'Foto cosplay acak'], randomnotnot: ['notnot', 'Gambar notnot acak'],
  randomantiwork: ['antiwork', 'Meme antiwork acak'], randomhekel: ['hekel', 'Gambar hacker acak']
};
// Alias nama V15 (random<nama>) untuk set yang sudah ada.
const ALIASES = { aesthetic: ['randomaesthetic'], wallpaperhp: ['randomwallhp'], wallpaperml: ['randomwallml'], wallpaperpubg: ['randompubg'], randommotor: ['randommontor'] };
const load = f => require(path.join(__dirname, '..', 'data', 'random', `${f}.json`));

// Satu command gambar acak per kunci SETS (plugins/random/<nama>.js).
function randomImage(name) {
  if (!SETS[name]) throw new Error(`Set gambar '${name}' tidak ada`);
  const [file, desc] = SETS[name];
  return feature({
    id: `random.${name}`, name, aliases: ALIASES[name] || [], category: 'random', description: `${desc} (${load(file).length} gambar)`, cooldown: 5, limit: 1, dataset: `data/random/${file}.json`,
    async run(ctx) { const list = load(file); const url = list[crypto.randomInt(0, list.length)]; await ctx.sendFile(url, { caption: `📸 ${desc}` }); }
  });
}

module.exports = { load, randomImage };
