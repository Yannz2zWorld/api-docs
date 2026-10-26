'use strict';
// Game HTML Yann AI V15 (snake, flappy, dino, dll.) dikirim sebagai file .html: buka file di WhatsApp
// lalu pilih browser untuk main (offline, tanpa internet). V15 mengirimnya sebagai pesan palsu
// "Meta AI"; cara itu tidak dipakai di sini.
const fs = require('fs');
const path = require('path');
const { feature } = require('../library/plugin-kit');

const DIR = path.join(__dirname, '..', 'assets', 'games');
const GAMES = {
  snake: ['Snake', ['snakename', 'gamesnake']],
  flappybird: ['Flappy Bird', ['flappy', 'gameflappy']],
  dino: ['Dino Runner', ['dinorunner', 'gamedino']],
  brickbreaker: ['Brick Breaker', ['breakout', 'brick', 'gamebrick']],
  spaceinvaders: ['Space Invaders', ['spaceshooter', 'galaxian', 'space']],
  stacktower: ['Stack Tower', ['stack', 'stackgame']],
  blockblast: ['Block Blast', ['blockgame', 'blockpuzzle']],
  hillclimb: ['Hill Climb Racing', ['hcr', 'mobil']]
};

function htmlGame(name) {
  if (!GAMES[name]) throw new Error(`Game '${name}' tidak ada`);
  const [title, aliases] = GAMES[name];
  const file = path.join(DIR, `${name}.html`);
  return feature({
    id: `game.html.${name}`, name, aliases, category: 'game', description: `Game ${title} (file HTML, main di browser)`, cooldown: 10,
    dataset: `assets/games/${name}.html`,
    async run(ctx) {
      await ctx.sendFile({ buffer: fs.readFileSync(file), mime: 'text/html' }, { asDocument: true, fileName: `${title.replace(/\s+/g, '-')}.html`,
        caption: `🎮 *${title}*\nBuka file ini → pilih *Chrome/browser* untuk main. Bisa offline.` });
    }
  });
}

module.exports = { GAMES, htmlGame };
