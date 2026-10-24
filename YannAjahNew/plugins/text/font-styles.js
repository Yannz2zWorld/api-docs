'use strict';
// font1..font10 (V15): ubah teks jadi gaya Unicode. Murni lokal, tanpa API.
const { textTool } = require('../../library/plugin-kit');

// Peta a-z / A-Z / 0-9 untuk tiap gaya; karakter lain dibiarkan apa adanya.
const L = 'abcdefghijklmnopqrstuvwxyz';
const U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const D = '0123456789';
const build = (low, up, dig) => { const m = {}; [...L].forEach((c, i) => low && (m[c] = [...low][i])); [...U].forEach((c, i) => up && (m[c] = [...up][i])); if (dig) [...D].forEach((c, i) => (m[c] = [...dig][i])); return m; };

const STYLES = {
  font1: build('𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃', '𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩'),
  font2: build('ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ', 'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ', '０１２３４５６７８９'),
  font3: build('ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ', 'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ', '⓪①②③④⑤⑥⑦⑧⑨'),
  font4: build('𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳', '𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙', '𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗'),
  font5: build('𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫', '𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ', '𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡'),
  font6: build('𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏', '𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵'),
  font7: build('𝙖𝙗𝙘𝙙𝙚𝙛𝙜𝙝𝙞𝙟𝙠𝙡𝙢𝙣𝙤𝙥𝙦𝙧𝙨𝙩𝙪𝙫𝙬𝙭𝙮𝙯', '𝘼𝘽𝘾𝘿𝙀𝙁𝙂𝙃𝙄𝙅𝙆𝙇𝙈𝙉𝙊𝙋𝙌𝙍𝙎𝙏𝙐𝙑𝙒𝙓𝙔𝙕', '𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵'),
  font8: build('𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣', '𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉', '𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿'),
  font9: build('ₐbcdₑfgₕᵢⱼₖlₘₙₒₚqᵣₛₜᵤᵥwₓyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
  font10: build('ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘϙʀsᴛᴜᴠᴡxʏᴢ', 'ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘϙʀsᴛᴜᴠᴡxʏᴢ')
};
const apply = map => t => [...t].map(c => map[c] || c).join('');

module.exports = Object.entries(STYLES).map(([name, map], i) => textTool({
  id: `text.${name}`, name, category: 'maker', description: `Gaya teks Unicode #${i + 1} (contoh: ${apply(map)('halo')})`,
  fn: apply(map), usage: '<teks>',
  tests: [{ input: 'ab', expect: apply(map)('ab') }]
}));
