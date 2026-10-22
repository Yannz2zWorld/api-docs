'use strict';
// Konversi satuan. Satu command per besaran fisik (panjang, massa, ...) — masing-masing tabel
// faktor sendiri. Format: .<command> <nilai> <dari> <ke>   contoh: .panjang 5 km mil
const { textTool } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { fmt } = require('../../library/mathexpr');

const TABLES = {
  panjang: { desc: 'panjang', units: { mm: 0.001, cm: 0.01, dm: 0.1, m: 1, km: 1000, in: 0.0254, inci: 0.0254, ft: 0.3048, kaki: 0.3048, yd: 0.9144, mil: 1609.344, mi: 1609.344, nmi: 1852 }, test: ['5 km m', '5 km = *5.000* m'] },
  massa: { desc: 'massa / berat', units: { mg: 1e-6, g: 0.001, ons: 0.1, kg: 1, kuintal: 100, ton: 1000, lb: 0.45359237, oz: 0.028349523125 }, test: ['2 kg ons', '2 kg = *20* ons'] },
  luasan: { desc: 'luas', units: { mm2: 1e-6, cm2: 1e-4, m2: 1, are: 100, ha: 10000, km2: 1e6, ft2: 0.09290304, acre: 4046.8564224 }, test: ['1 ha m2', '1 ha = *10.000* m2'] },
  volumesatuan: { desc: 'volume', units: { ml: 0.001, cc: 0.001, l: 1, liter: 1, dl: 0.1, m3: 1000, gal: 3.785411784, galon: 3.785411784, cup: 0.24, sdm: 0.015, sdt: 0.005 }, test: ['1 m3 l', '1 m3 = *1.000* l'] },
  kecepatan: { desc: 'kecepatan', units: { 'm/s': 1, 'km/h': 1 / 3.6, kmh: 1 / 3.6, mph: 0.44704, knot: 0.514444, kn: 0.514444 }, test: ['36 km/h m/s', '36 km/h = *10* m/s'] },
  konversiwaktu: { desc: 'durasi waktu', units: { ms: 0.001, s: 1, detik: 1, menit: 60, min: 60, jam: 3600, h: 3600, hari: 86400, minggu: 604800, bulan: 2629746, tahun: 31556952 }, test: ['2 jam menit', '2 jam = *120* menit'] },
  datasize: { desc: 'ukuran data', units: { bit: 0.125, b: 1, byte: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1048576, gib: 1073741824, tib: 1099511627776 }, test: ['1 gib mib', '1 gib = *1.024* mib'] },
  tekanan: { desc: 'tekanan', units: { pa: 1, kpa: 1000, bar: 1e5, atm: 101325, psi: 6894.757293168, mmhg: 133.322387415 }, test: ['1 atm kpa', '1 atm = *101,325* kpa'] },
  energi: { desc: 'energi', units: { j: 1, kj: 1000, cal: 4.184, kal: 4.184, kcal: 4184, kkal: 4184, wh: 3600, kwh: 3.6e6, ev: 1.602176634e-19 }, test: ['1 kkal kj', '1 kkal = *4,184* kj'] },
  daya: { desc: 'daya', units: { w: 1, kw: 1000, mw: 1e6, hp: 745.699872, pk: 735.49875 }, test: ['1 kw w', '1 kw = *1.000* w'] },
  sudut: { desc: 'sudut', units: { deg: Math.PI / 180, derajat: Math.PI / 180, rad: 1, grad: Math.PI / 200, putaran: 2 * Math.PI }, test: ['180 deg rad', '180 deg = *3,1415926536* rad'] },
  frekuensi: { desc: 'frekuensi', units: { hz: 1, khz: 1e3, mhz: 1e6, ghz: 1e9, rpm: 1 / 60 }, test: ['2 ghz mhz', '2 ghz = *2.000* mhz'] }
};

function parse(t, table) {
  const m = /^\s*(-?[\d.,]+)\s*([^\s]+)\s+(?:ke\s+)?([^\s]+)\s*$/i.exec(t);
  if (!m) throw new UsageError(`Format: <nilai> <dari> <ke>. Satuan: ${Object.keys(table.units).join(', ')}`);
  const raw = Number(m[1].replace(',', '.'));   // koma atau titik sebagai desimal, tanpa pemisah ribuan
  const from = m[2].toLowerCase(), to = m[3].toLowerCase();
  if (!(from in table.units) || !(to in table.units)) throw new UsageError(`Satuan ${table.desc} yang dikenal: ${Object.keys(table.units).join(', ')}`);
  if (!Number.isFinite(raw)) throw new UsageError('Nilai harus angka.');
  return { value: raw, from, to };
}

const convertTool = (name, table) => textTool({
  id: `convert.${name}`, name, category: 'convert', description: `Konversi satuan ${table.desc}: ${Object.keys(table.units).slice(0, 8).join(', ')}…`,
  usage: '<nilai> <dari> <ke>',
  fn: t => { const { value, from, to } = parse(t, table); return `${fmt(value)} ${from} = *${fmt(value * table.units[from] / table.units[to])}* ${to}`; },
  tests: [{ input: table.test[0], expect: table.test[1] }]
});

function temp(t) {
  const m = /^\s*(-?[\d.,]+)\s*([cfkr])\w*\s+(?:ke\s+)?([cfkr])\w*\s*$/i.exec(t);
  if (!m) throw new UsageError('Format: <nilai> <c|f|k|r> <c|f|k|r>');
  const v = Number(m[1].replace(',', '.'));
  const from = m[2].toLowerCase(), to = m[3].toLowerCase();
  const toC = { c: x => x, f: x => (x - 32) * 5 / 9, k: x => x - 273.15, r: x => x * 5 / 4 }[from](v);
  if (toC < -273.15) throw new UsageError('Di bawah nol mutlak.');
  const out = { c: x => x, f: x => x * 9 / 5 + 32, k: x => x + 273.15, r: x => x * 4 / 5 }[to](toC);
  return `${fmt(v)}°${from.toUpperCase()} = *${fmt(Math.round(out * 1e6) / 1e6)}*°${to.toUpperCase()}`;
}

module.exports = [
  ...Object.entries(TABLES).map(([n, t]) => convertTool(n, t)),
  textTool({ id: 'convert.suhu', name: 'suhu', aliases: ['temperature'], category: 'convert', description: 'Konversi suhu Celsius/Fahrenheit/Kelvin/Reamur', usage: '<nilai> <c|f|k|r> <c|f|k|r>', fn: temp,
    tests: [{ input: '100 c f', expect: '100°C = *212*°F' }, { input: '0 k c', expect: '0°K = *-273,15*°C' }] })
];
