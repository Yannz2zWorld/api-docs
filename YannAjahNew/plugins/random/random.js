'use strict';
// Gambar acak dari daftar URL dataset V15 (data/random/*.json). Set foto orang nyata sengaja tidak disertakan.
const path = require('path');
const crypto = require('crypto');
const { feature } = require('../../library/plugin-kit');

const SETS = {
  randomkucing: ['kucing', 'Foto kucing acak'], randomanjing: ['anjing', 'Foto anjing acak'], wallpaperhp: ['wallhp', 'Wallpaper HP acak'],
  wallpaperml: ['wallml', 'Wallpaper Mobile Legends acak'], aesthetic: ['aesthetic', 'Gambar aesthetic acak'], randommobil: ['mobil', 'Foto mobil acak'],
  randommotor: ['montor', 'Foto motor acak'], randomboneka: ['boneka', 'Foto boneka acak'], wallpaperpubg: ['pubg', 'Wallpaper PUBG acak']
};
const load = f => require(path.join(__dirname, '..', '..', 'data', 'random', `${f}.json`));

module.exports = [
  ...Object.entries(SETS).map(([name, [file, desc]]) => feature({
    id: `random.${name}`, name, category: 'random', description: `${desc} (${load(file).length} gambar)`, cooldown: 5, limit: 1, dataset: `data/random/${file}.json`,
    async run(ctx) { const list = load(file); const url = list[crypto.randomInt(0, list.length)]; await ctx.sendFile(url, { caption: `📸 ${desc}` }); }
  })),
  feature({ id: 'random.dadu.sticker', name: 'dadustiker', category: 'random', description: 'Stiker dadu acak 1-6', cooldown: 3,
    async run(ctx) { const d = load('dadu'); const x = d[crypto.randomInt(0, d.length)]; await ctx.sendFile(x.result); } })
];
