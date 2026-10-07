// Image endpoints served through api.theresav.eu (see lib/theresav.js). Needs THERESAV_API_KEY.
// They take an image by URL; the server downloads it (https, public hosts, max 8 MB) and forwards
// it as the upstream's file field.
const { makeEndpoint } = require('../lib/theresav');

module.exports = [
  { name: 'Lumi Art', desc: 'Turn a photo into a Lumi Art style image.', category: 'Image', path: '/api/image/lumiart', upstream: '/api/image/lumiart',
    multipart: true, file: { param: 'imageUrl', field: 'image' },
    params: [{ name: 'imageUrl', required: true, type: 'url', aliases: ['url'], placeholder: 'https://… URL gambar' }] }
].map(makeEndpoint);
