// Image endpoints served through api.theresav.eu (see lib/theresav.js). Needs THERESAV_API_KEY.
// They take a photo: uploaded in the Sandbox, or an image URL for API users.
const { makeEndpoint } = require('../lib/theresav');

module.exports = [
  { name: 'Lumi Art', desc: 'Turn a photo into a Lumi Art style image.', category: 'Image', path: '/api/image/lumiart', upstream: '/api/image/lumiart',
    multipart: true, file: { param: 'imageUrl', field: 'image', accept: 'image/*' },
    params: [{ name: 'imageUrl', required: true, type: 'url', aliases: ['url'], placeholder: 'Unggah foto' }] },
  { name: 'Sketch', desc: 'Turn a photo into a pencil sketch.', category: 'Image', path: '/api/image/sketch', upstream: '/image/sketch',
    multipart: true, file: { param: 'imageUrl', field: 'image', accept: 'image/*' },
    params: [{ name: 'imageUrl', required: true, type: 'url', aliases: ['url'], placeholder: 'Unggah foto' }] }
].map(makeEndpoint);
