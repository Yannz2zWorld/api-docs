'use strict';
// Edit foto dengan AI (seperti command to*/jadi* Yann AI V15 yang memakai bananaai + prompt gaya).
// Endpoint: APIZ2Z /api/maker/bananaai, cadangan /api/ai/nano-banana. Kirim/reply gambar + command.
// Gaya yang membuat foto orang nyata tampak di penjara / demo / parlemen / berpasangan dengan orang lain
// sengaja TIDAK ada (rawan fitnah & hoaks) — lihat status disabled di katalog backlog V15.
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const { callFirst, sendResult } = require('./apiz2z-kit');

const KEEP = 'Keep the same person: face, identity, skin tone, hairstyle and pose must stay recognizable. High quality, no text, no watermark.';
const STYLES = {
  to2d: ['Ubah foto jadi anime 2D', `Convert this photo into a clean 2D anime illustration with crisp line art and flat cel shading. ${KEEP}`, ['anime2d']],
  toanime: ['Ubah foto jadi gaya anime Jepang', `Convert this photo into a classic Japanese anime style portrait: clean line art, soft cinematic lighting, vibrant colors. ${KEEP}`],
  tomanga: ['Ubah foto jadi gaya manga hitam putih', `Convert this photo into a traditional Japanese manga illustration, fully black and white, strong ink lines, screentone and cross-hatching. ${KEEP}`],
  tomanhwa: ['Ubah foto jadi gaya manhwa/webtoon', `Convert this photo into a Korean manhwa / webtoon illustration: sharp detailed line art, bright saturated colors, cel shading. ${KEEP}`],
  todonghua: ['Ubah foto jadi gaya donghua', `Convert this photo into a high-resolution Chinese donghua style portrait with soft lighting and intricate character design. ${KEEP}`],
  tochibi: ['Ubah foto jadi chibi lucu', `Transform the person into a cute anime chibi: larger head, smaller body, expressive eyes, soft colors, same outfit and hairstyle. ${KEEP}`],
  tofigure: ['Ubah foto jadi figure/action figure 1/7', `Turn the character in the photo into a realistic commercial 1/7 scale PVC figurine on a round clear base, placed on a desk, with the figure box beside it. ${KEEP}`],
  tokartun: ['Ubah foto jadi kartun', `Convert this photo into a colorful western cartoon illustration with bold outlines and simple shading. ${KEEP}`],
  toroblox: ['Ubah foto jadi karakter Roblox', `Transform the person into a Roblox-style 3D blocky character, same outfit colors and hairstyle, game screenshot look. ${KEEP}`],
  topunk: ['Ubah foto jadi gaya punk', `Restyle the person with a punk rock look: leather jacket, studs, edgy hairstyle, gritty concert lighting. ${KEEP}`],
  tojawa: ['Ubah foto jadi berpakaian adat Jawa', `Dress the person in traditional Javanese attire (beskap/blangkon or kebaya), elegant cultural photo studio background. ${KEEP}`],
  tosunda: ['Ubah foto jadi berpakaian adat Sunda', `Dress the person in traditional Sundanese attire (pangsi/iket or kebaya Sunda), cultural photo studio background. ${KEEP}`],
  tomoai: ['Ubah foto jadi patung moai', `Turn the person into a stone moai statue on Easter Island while keeping recognizable facial features, sunny sky.`],
  tosatan: ['Ubah foto jadi gaya iblis fantasi', `Restyle the person as a dark fantasy demon character with horns and glowing eyes, cinematic fantasy art. ${KEEP}`],
  tosad: ['Ubah foto jadi suasana sedih sinematik', `Make this photo a moody, sad cinematic scene: rain, blue tones, soft bokeh city lights. ${KEEP}`],
  tomountain: ['Ubah latar foto jadi di pegunungan', `Place the person in a beautiful mountain landscape lying on grass among white wildflowers, golden hour light. ${KEEP}`],
  todino: ['Foto bareng dinosaurus', `Add a friendly realistic dinosaur standing next to the person, as a fun photobooth picture. ${KEEP}`],
  tobotak: ['Ubah rambut jadi botak', `Make the person completely bald, realistic scalp, natural lighting. ${KEEP}`],
  tomirror: ['Ubah foto jadi mirror selfie', `Turn this into a realistic mirror selfie taken with a smartphone in a stylish bedroom. ${KEEP}`],
  jadidisney: ['Ubah foto jadi gaya Disney', `Convert this photo into a Disney 3D animated movie character style. ${KEEP}`],
  jadipixar: ['Ubah foto jadi gaya Pixar', `Convert this photo into a Pixar 3D animation character with soft lighting and expressive features. ${KEEP}`],
  jadigta: ['Ubah foto jadi poster GTA', `Convert this photo into a Grand Theft Auto loading screen artwork style illustration. ${KEEP}`],
  ghibli: ['Ubah foto jadi gaya Studio Ghibli', `Transform this image into the hand-painted Studio Ghibli art style: soft warm colors, whimsical dreamy atmosphere. ${KEEP}`],
  hijabpin: ['Tambahkan hijab ke foto', `Make the woman in the photo wear a neat, modest hijab that matches her outfit. ${KEEP}`],
  polaroid: ['Ubah foto jadi photobooth polaroid 3 grid', `Create a casual 3-grid photobooth polaroid strip of the person, natural expressions, soft flash lighting. ${KEEP}`],
  tofootball: ['Ubah foto jadi pemain bola (nama|nomor|klub)', null],
  hapusobjek: ['Hapus objek dari foto (tulis objeknya)', null, ['removeobj', 'removeobject', 'rmobj']]
};

function promptFor(name, text) {
  if (name === 'tofootball') {
    const [nama = '', nomor = '10', klub = ''] = String(text || '').split('|').map(s => s.trim());
    if (!nama) throw new UsageError('Format: tofootball nama|nomor|klub (reply/kirim foto)');
    return `Turn the person into a professional football player on a stadium pitch wearing ${klub ? `${klub} ` : ''}jersey with name "${nama.slice(0, 20)}" and number ${String(nomor).replace(/\D/g, '').slice(0, 2) || '10'} on the back. ${KEEP}`;
  }
  if (name === 'hapusobjek') {
    const obj = String(text || '').trim().slice(0, 100);
    if (!obj) throw new UsageError('Tulis objek yang mau dihapus. Contoh: hapusobjek orang di belakang (reply/kirim foto)');
    return `Remove the ${obj} from this image completely and fill the area naturally with matching background. Keep everything else unchanged.`;
  }
  return STYLES[name][1];
}

// Satu command edit foto per kunci STYLES (plugins/image/<nama>.js).
function photoEdit(name) {
  if (!STYLES[name]) throw new Error(`Gaya '${name}' tidak ada`);
  const [description, , aliases = []] = STYLES[name];
  return feature({
    id: `image.${name}`, name, aliases, category: 'image', description, cooldown: 15, limit: 2,
    usage: name === 'tofootball' ? 'nama|nomor|klub (+kirim/reply foto)' : name === 'hapusobjek' ? '<objek> (+kirim/reply foto)' : '(kirim/reply foto)',
    dependencies: { apiz2z: '/api/maker/bananaai' },
    async run(ctx) {
      const md = ctx.media();
      if (!md || !/^image\//.test(md.mime)) throw new UsageError(`Kirim atau reply *foto* dengan caption ${ctx.prefix}${ctx.command}`);
      const prompt = promptFor(name, ctx.text);
      await ctx.react('⏳');
      const file = { buffer: await md.download(), mime: md.mime };
      const { result } = await callFirst(ctx, [['/api/maker/bananaai', { prompt }, file], ['/api/ai/nano-banana', { prompt, mode: 'edit' }, file]]);
      await sendResult(ctx, result, { category: 'image', title: description, caption: `✨ ${description}` });
      await ctx.react('✅');
    }
  });
}

module.exports = { STYLES, photoEdit, promptFor };
