'use strict';
const { textTool } = require('../../library/plugin-kit');
const { niatsholat } = require('../../lib/primbon');

module.exports = textTool({ id: 'islamic.niatsholat', name: 'niatsholat', aliases: ['niatshalat'], category: 'islamic', usage: '<subuh|dzuhur|ashar|maghrib|isha>', description: 'Niat sholat fardhu (Arab, latin, terjemahan)', fn: niatsholat,
  tests: [{ input: 'subuh', expect: /Niat Sholat subuh[\s\S]*Arab/ }, { input: 'isya', expect: /isha/ }] });
