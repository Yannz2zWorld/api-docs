'use strict';
// Gambar karakter anime acak (command karakter Yann AI V15: .asuna, .itachi, .nezuko, ...).
// V15 memakai API pihak ketiga per karakter; di sini dari pencarian Pinterest APIZ2Z (cadangan: Image Search).
// loli/shota sengaja tidak ada.
const crypto = require('crypto');
const { feature } = require('../library/plugin-kit');
const { callFirst } = require('./apiz2z-kit');
const { collectMedia, payloadOf } = require('../library/apiz2z-render');

const CHARS = {
  akiyama: 'Akiyama Mio K-On', ana: 'Ana Coppola Ichigo Mashimaro', asuna: ['Asuna Yuuki Sword Art Online', ['animeasuna']], ayuzawa: 'Ayuzawa Misaki Kaichou wa Maid-sama',
  boruto: 'Boruto Uzumaki', chiho: 'Chiho Sasaki Hataraku Maou-sama', chitoge: 'Chitoge Kirisaki Nisekoi', deidara: 'Deidara Akatsuki Naruto', doraemon: 'Doraemon',
  emilia: ['Emilia Re Zero', ['animeemilia']], erza: 'Erza Scarlet Fairy Tail', gremory: ['Rias Gremory High School DxD', ['animegremory']], hestia: 'Hestia Danmachi',
  hinata: ['Hinata Hyuga Naruto', ['animehinata']], inori: 'Inori Yuzuriha Guilty Crown', isuzu: ['Isuzu Sento Amagi Brilliant Park', ['animeisuzu']], itachi: 'Itachi Uchiha',
  itori: ['Itori Toaru Majutsu no Index', ['animeitori']], kaga: 'Kaga Kantai Collection', kagura: ['Kagura Gintama', ['animekagura']], kaori: 'Kaori Miyazono Shigatsu wa Kimi no Uso',
  kurumi: 'Kurumi Tokisaki Date A Live', madara: 'Madara Uchiha', megumin: ['Megumin Konosuba', ['animemegumin']], mikasa: 'Mikasa Ackerman Attack on Titan',
  miku: ['Hatsune Miku', ['animemiku']], minato: 'Minato Namikaze', nezuko: ['Nezuko Kamado Demon Slayer', ['animenezuko']], onepiece: 'One Piece anime',
  pokemon: ['Pokemon anime', ['animepokemon']], sakura: 'Sakura Haruno Naruto', sasuke: 'Sasuke Uchiha', shina: ['Shina anime girl', ['animeshina']],
  shinka: ['Shinka Nibutani Chuunibyou', ['animeshinka']], shizuka: 'Shizuka Minamoto Doraemon', toukachan: ['Touka Kirishima Tokyo Ghoul', ['animetoukachan']],
  tsunade: 'Tsunade Naruto', yuki: 'Yuki Nagato Haruhi', yuri: 'Yuri Nakamura Angel Beats', neko2: 'neko anime girl cute', waifu2: 'anime waifu aesthetic',
  animeakira: 'Akira anime 1988', animeeba: 'Eba anime girl', animekeneki: 'Ken Kaneki Tokyo Ghoul', animetejina: 'Tejina-senpai anime', animeyotsuba: 'Yotsuba Koiwai',
  animeyuli: 'Yuli anime girl', animeyumeko: 'Yumeko Jabami Kakegurui'
};
const entry = name => (Array.isArray(CHARS[name]) ? CHARS[name] : [CHARS[name], []]);

async function searchImages(ctx, q) {
  const { result } = await callFirst(ctx, [['/api/search/pinterest', { q }], ['/api/search/pinterest-v2', { q }], ['/api/search/image', { q }]]);
  if (result.kind === 'media') return [{ buffer: result.buffer, mime: result.mime }];
  return collectMedia(payloadOf(result.data)).filter(m => m.kind === 'image' && !/thumb|avatar/i.test(m.key)).map(m => m.url);
}

// Satu command per karakter (plugins/anime/<nama>.js).
function animeChar(name) {
  if (!CHARS[name]) throw new Error(`Karakter '${name}' tidak ada`);
  const [query, aliases] = entry(name);
  const title = query.split(' ').slice(0, 2).join(' ');
  return feature({
    id: `anime.${name}`, name, aliases, category: 'anime', description: `Gambar acak ${title}`, cooldown: 5, limit: 1,
    dependencies: { apiz2z: '/api/search/pinterest' },
    async run(ctx) {
      await ctx.react('⏳');
      const list = await searchImages(ctx, query);
      if (!list.length) return ctx.reply(`Gambar ${title} tidak ditemukan, coba lagi nanti.`);
      const pick = list[crypto.randomInt(0, list.length)];
      await ctx.sendFile(pick, { caption: `🌸 ${title}` });
      await ctx.react('✅');
    }
  });
}

module.exports = { CHARS, animeChar, searchImages };
