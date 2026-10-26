'use strict';
// Musik bernomor (V15: .sound1..sound250, .sad1..sad55). Ambil mp3 dari repo publik GitHub (raw).
// Diringkas jadi 2 command + alias bernomor supaya .sound23 / .sad10 tetap jalan seperti V15.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

const BASE = 'https://raw.githubusercontent.com/Leoo7z/Music/main';
const range = (p, n) => Array.from({ length: n }, (_, i) => `${p}${i + 1}`);

function builder({ name, max, pathFor, label }) {
  return feature({
    id: `media.${name}`, name, aliases: range(name, max), category: 'media', cooldown: 5, limit: 1,
    description: `${label} 1-${max} (contoh: .${name}5)`, usage: `<1-${max}>`, dependencies: { apis: ['github-raw'] },
    async run(ctx) {
      const n = parseInt((ctx.command.match(/(\d+)$/) || [])[1] || ctx.args[0], 10);
      if (!(n >= 1 && n <= max)) throw new UsageError(`Pilih nomor 1-${max}. Contoh: ${ctx.prefix}${name}5`);
      await ctx.react('⏳');
      await ctx.sendFile(`${BASE}/${pathFor(n)}`, { mimetype: 'audio/mpeg' });
    }
  });
}

module.exports = [
  builder({ name: 'sound', max: 250, label: 'Musik', pathFor: n => `sound${n}.mp3` }),
  builder({ name: 'sad', max: 55, label: 'Musik sedih', pathFor: n => `sad-music/sad${n}.mp3` })
];
