'use strict';
// Ramalan hiburan V15 (.ramalan, .ramalannasib/.nasib, .cinta, .ramalansuamiistri/.suamiistri).
// Hasil konsisten per nama per hari (hash) — jelas hiburan, bukan ramalan sungguhan.
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const { daily } = require('./fun');

const of = (arr, ...seed) => arr[daily(...seed) % arr.length];
const pct = (...seed) => daily(...seed) % 101;
const bar = p => `${'█'.repeat(Math.round(p / 10))}${'░'.repeat(10 - Math.round(p / 10))}`;

const NASIB = ['Rezekimu sedang mengalir deras, jangan lupa berbagi.', 'Hari ini cocok untuk memulai hal baru.', 'Hati-hati dengan janji yang terlalu manis.', 'Ada kabar baik dari orang yang lama tidak dihubungi.', 'Kesabaranmu akan segera berbuah manis.', 'Kurangi begadang, tubuhmu butuh istirahat.', 'Keberuntungan datang lewat teman dekat.', 'Jangan buru-buru mengambil keputusan besar hari ini.', 'Usahamu minggu ini akan dilirik orang penting.', 'Dompet aman, asal tidak tergoda diskon.'];
const RAMALAN = ['Cerah', 'Berawan tapi menyenangkan', 'Penuh kejutan', 'Tenang dan damai', 'Sedikit drama', 'Banyak tawa', 'Produktif', 'Butuh istirahat'];
const CINTA = ['Ada yang diam-diam memperhatikanmu.', 'Jangan gengsi, sapa duluan saja.', 'Hubunganmu sedang di fase manis.', 'Waktunya fokus ke diri sendiri dulu.', 'Komunikasi adalah kunci minggu ini.', 'Seseorang dari masa lalu mungkin kembali menyapa.', 'Cintamu butuh sedikit kejutan kecil.', 'Jodoh tidak ke mana, tetap jadi versi terbaikmu.'];
const RUMAH = ['harmonis dan saling melengkapi', 'sering beda pendapat tapi cepat baikan', 'romantis seperti drama Korea', 'kompak urusan keuangan', 'perlu belajar lebih sabar satu sama lain', 'penuh canda tawa'];

const KINDS = {
  ramalan: ['Ramalan hari ini untuk nama kamu', '<nama>', n => `🔮 *Ramalan ${n}*\n• Suasana hari ini: ${of(RAMALAN, 'r', n)}\n• Keberuntungan: ${pct('rh', n)}% ${bar(pct('rh', n))}\n• Pesan: ${of(NASIB, 'rn', n)}`],
  ramalannasib: ['Ramalan nasib hari ini', '<nama>', n => `🌙 *Nasib ${n} hari ini*\n${of(NASIB, 'n', n)}\n\nKeberuntungan: ${pct('nh', n)}% ${bar(pct('nh', n))}`, ['nasib']],
  cinta: ['Ramalan cinta hari ini', '<nama>', n => `💘 *Ramalan cinta ${n}*\n${of(CINTA, 'c', n)}\n\nPeluang asmara: ${pct('cp', n)}% ${bar(pct('cp', n))}`],
  ramalansuamiistri: ['Ramalan rumah tangga dua nama', '<nama1>|<nama2>', (a, b) => {
    const k = [a, b].map(s => s.toLowerCase()).sort().join('|'); const p = pct('si', k);
    return `💍 *${a} & ${b}*\nKecocokan rumah tangga: *${p}%* ${bar(p)}\nRumah tangga kalian ${of(RUMAH, 'sr', k)}.\n${p >= 70 ? 'Cocok sekali! 🥰' : p >= 40 ? 'Bisa, asal saling mengerti. 🙂' : 'Butuh banyak kompromi. 😅'}`;
  }, ['suamiistri']]
};

function ramalan(name) {
  const [desc, usage, fn, aliases = []] = KINDS[name];
  return feature({
    id: `fun.${name}`, name, aliases, category: 'fun', description: `${desc} (hiburan)`, usage, cooldown: 3,
    async run(ctx) {
      const t = (ctx.text || ctx.m.pushName || '').trim().slice(0, 60);
      if (name === 'ramalansuamiistri') {
        const [a, b] = t.split('|').map(s => s.trim());
        if (!a || !b) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} Budi|Ani`);
        return ctx.reply(fn(a.slice(0, 30), b.slice(0, 30)));
      }
      if (!t) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} Budi`);
      await ctx.reply(fn(t));
    }
  });
}

module.exports = { KINDS, ramalan };
