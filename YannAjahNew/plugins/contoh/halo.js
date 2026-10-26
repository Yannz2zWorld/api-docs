/*
 * CONTOH PLUGIN (format Yann AI V15 / Lena AI). Salin file ini untuk membuat command baru.
 * 1 file = 1 command. Simpan di folder plugins/<kategori>/, lalu restart bot.
 *
 *   m        = pesan masuk (m.chat, m.sender, m.text, m.quoted, m.isGroup, m.pushName)
 *   sock     = koneksi WhatsApp (sama dengan conn / lena / alip)
 *   text     = teks setelah command, contoh ".halo Budi" -> "Budi"
 *   Reply    = balas pesan
 */

let handler = async (m, { sock, text, command, prefix, isCreator, Reply }) => {
  if (!text) return Reply(`Contoh: ${prefix}${command} Budi`)

  await sock.sendMessage(m.chat, { react: { text: '👋', key: m.key } })
  await Reply(`Halo ${text}! 👋\nAku ${global.botname}, owner-ku ${global.namaOwner}.${isCreator ? '\n(kamu owner bot ini)' : ''}`)
}

handler.command = ['halo', 'hai']          // nama command + alias
handler.category = 'contoh'                // kategori di menu
handler.description = 'Contoh plugin: bot menyapa'
handler.usage = '<nama>'
handler.limit = false                      // true = memotong 1 limit
// handler.owner = true                    // khusus owner
// handler.admin = true                    // khusus admin grup
// handler.group = true                    // khusus di grup
// handler.premium = true                  // khusus premium

module.exports = handler
