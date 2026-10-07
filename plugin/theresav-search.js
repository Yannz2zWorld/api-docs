// Search endpoints served through api.theresav.eu (see lib/theresav.js). Needs THERESAV_API_KEY.
const { makeEndpoint } = require('../lib/theresav');

module.exports = [
  { name: 'Sticker.ly Search', desc: 'Search sticker packs on Sticker.ly by keyword.', category: 'Search', path: '/api/search/stickerly', upstream: '/api/search/stickerly',
    params: [{ name: 'q', required: true, aliases: ['query', 'text'], max: 100, placeholder: 'kucing' }] },
  { name: 'Telegram Sticker Search', desc: 'Search Telegram sticker packs by keyword.', category: 'Search', path: '/api/search/telestick', upstream: '/api/search/telestick',
    params: [{ name: 'q', required: true, aliases: ['query', 'text'], max: 100, placeholder: 'anime' }] }
].map(s => makeEndpoint({ ...s, sample: { q: 'kucing' } }));
