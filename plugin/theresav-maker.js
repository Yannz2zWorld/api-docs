// Maker endpoints served through api.theresav.eu (see lib/theresav.js). Needs THERESAV_API_KEY.
// Brat and Brat Video answer with the image / video itself; Emoji Mix and Emoji to GIF answer JSON
// with image links.
const { makeEndpoint } = require('../lib/theresav');

module.exports = [
  { name: 'Brat', desc: 'Generate viral Brat album aesthetic meme text images.', path: '/api/maker/brat', upstream: '/api/maker/brat',
    params: [{ name: 'text', required: true, max: 300, placeholder: 'hi' }] },
  { name: 'Brat Video', desc: 'Generate an animated Brat word-by-word video in MP4 or GIF format.', path: '/api/maker/bratvid', upstream: '/api/maker/bratvid',
    params: [{ name: 'text', required: true, max: 300, placeholder: 'hi semua' }, { name: 'format', options: ['mp4', 'gif'], default: 'mp4' }] },
  { name: 'Emoji Mix (Emoji Kitchen)', desc: 'Combine two emojis into a custom Google Emoji Kitchen sticker.', path: '/api/maker/emojimix', upstream: '/api/maker/emojimix',
    params: [{ name: 'emoji1', required: true, max: 16, placeholder: '😂' }, { name: 'emoji2', required: true, max: 16, placeholder: '😭' }] },
  { name: 'Emoji to GIF', desc: 'Convert a standard emoji into an animated Google Noto GIF / WebP sticker.', path: '/api/maker/emojitogif', upstream: '/api/maker/emojitogif',
    params: [{ name: 'emoji', required: true, max: 16, placeholder: '🗿' }] }
].map(spec => makeEndpoint({ category: 'Maker', ...spec }));
