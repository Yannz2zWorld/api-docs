'use strict';
const { T, nums } = require('../../lib/calc');

module.exports = T('bmi', 'Indeks massa tubuh: .bmi berat(kg) tinggi(cm)', t => { const [w, h] = nums(t, 2, 'berat tinggi'); const b = w / Math.pow(h / 100, 2); const cat = b < 18.5 ? 'Kurus' : b < 25 ? 'Normal' : b < 30 ? 'Gemuk' : 'Obesitas'; return `BMI: *${b.toFixed(1)}* (${cat})`; }, [{ input: '70 175', expect: 'BMI: *22.9* (Normal)' }], { usage: '<berat kg> <tinggi cm>' });
