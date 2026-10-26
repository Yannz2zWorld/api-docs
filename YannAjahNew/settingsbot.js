/*
 * © YANNAJAH-AI
 * Since     : 2024 - 2026
 *
 * Owner     : https://wa.me/6285282426298
 * Channel   : https://whatsapp.com/channel/0029VbCBj0N3LdQTosP3Hj0T
 */

const fs = require('fs');
const chalk = require('chalk');
const { version } = require("./package.json")
global.baileys = require('./package.json').dependencies['@whiskeysockets/baileys'] || 'unknown';

// custom info bot
global.owner = '6285282426298'
global.versi = version
global.namaOwner = "YannDoangJir"
global.packname = "ꜱᴇɪʜᴀ - ᴍᴅ"
global.author = '© Yann Ai Md'
global.botname = "ꜱᴇɪʜᴀ - ᴍᴅ"
global.botname2 = "ₛₑᵢₕₐ ₋ ₘd"

global.tempatDB = 'database.json' // Jangan ubah
global.botSecretKey = "yannajah" // Jangan ubah

global.custompairing = "YANNAJAH"; /* custom pairing lu */

// Ganti dengan API key mu
global.ramsapikey = ''
// Pakasir Payment GateWay
global.pakasir = {
    project: '',
    apiKey: ''
}

global.harga = {
    prem: "5000",
    sewa: "10000"
}


// settings apk prem
// apikey premku
global.premku = ''
global.profit = 25 // profit

// harga sewa
global.sewa = {
    bulan1: 10000,
    bulan3: 25000,
    bulan6: 45000,
    bulan12: 80000
}

// limit harian bot
global.limitHarian = 10; // Ganti sesuai keinginan

// Batas peringatan (warn) grup sebelum kick (fitur anti-toxic, anti-bot, anti-link, anti-spam, dll.)
global.warnGrup = 3;

// SUBDO CF
global.cloudflareZoneId = 'zode token'
global.cloudflareApiToken = 'token cf'
global.cloudflareDomain = 'domain.com'

// rest api nih
global.apialip = "https://api.clutch.web.id"
global.apikeyalip = "" // kalo mau pake apikey sendiri login aja ke webnya
global.btc = "https://api.botcahx.eu.org"
global.apibotcahx = ""
global.dongtubeapi = "https://api.dongtube.id"
global.apikeydongtube = ""
global.termai = "https://api.termai.cc"
global.apitermai = ""
global.apiPitu = "https://api.pitucode.com"
global.PituKey = ""
global.Theresav = "https://api.theresav.eu"
global.TheresaApi = ""
global.api = {
    xterm: {
        url: global.termai,
        key: global.apitermai
    }
}

// API utama YannAjah = APIZ2Z
global.apiz2z = "https://apiz2z.web.id"
global.apikeyapiz2z = "" // apikey APIZ2Z

// apikey ambil di https://alipshop.clutch.web.id
global.amPremApikey = ''

// ========PANEL SETTING !!!===============
global.egg = "15" // Egg ID
global.nestid = "5" // nest ID
global.loc = "1" // Location ID
global.domain = "https://" // Domain lu
global.apikey = "-" //ptla
global.capikey = "-" //ptlc
// ========================================

// Settings Link / Tautan
global.linkOwner = "https://wa.me/6281249703469"
global.linkGrup = "https://chat.whatsapp.com/BqJAqcdEjijJHrIWHNr1la"

// Delay Jpm & Pushctc || 1000 = 1detik
global.delayJpm = 3000
global.delayPushkontak = 40000

// Settings Channel / Saluran
global.linkSaluran = "https://whatsapp.com/channel/0029VbCBj0N3LdQTosP3Hj0T"
global.idSaluran = "120363409375529920@newsletter"
global.namaSaluran = "# cenel inpo ꜱᴇɪʜᴀ - ᴍᴅ"

// Settings All Payment
global.dana = "085282426298" // ubah jadi nomor dana kalian
global.gopay = "085282426298" // ubah jadi nomor gopay kalian


// Settings Image Url
global.image = {
// gambar menu awal
menu: "https://cdn-alip.clutch.web.id/api/u/mtmyjmca.jpg",
// menu v3
menuv3: "https://cdn-alip.clutch.web.id/api/u/mr8s2q9m.jpg",
//banner welcome
welcome: "https://files.catbox.moe/3fh8c6.jpg",
//banner left
left: "https://files.catbox.moe/3fh8c6.jpg",
// logo saat bot reply pesan
reply: "https://cdn-alip.clutch.web.id/api/u/mtmyi1fe.jpg",
canvas: "https://files.catbox.moe/lvqrmf.jpg",
// ubah jadi qris kalian
qris: "https://files.catbox.moe/o77sec.png"
}

// Message Command
global.mess = {
    limit: `🔔 𝗟𝗶𝗺𝗶𝘁 𝗛𝗮𝗯𝗶𝘀\nSilakan ketik *.claim* untuk klaim bonus limit dan bonus lainnya\nAtau *.buyprem* untuk upgrade ke Premium dengan unlock all fitur dan limit Unlimited.`,
    owner: `🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nFitur ini hanya tersedia untuk *Owner Bot Tercinta*.`,
    verifikasi: `🚫 𝗪𝗸𝘄𝗸 𝗗𝗶𝘁𝗼𝗹𝗮𝗸 😹\nDaftar dulu kids di sini *.daftar nama,umur,gender* untuk mengakses seluruh fitur bot.`,
    admin: `🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nFitur ini khusus untuk *Admin Grup*.`,
    botAdmin: `🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nBot harus menjadi *Admin Grup* untuk menjalankan fitur ini.`,
    group: `🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nFitur ini hanya dapat digunakan di dalam *Grup*.`,
    private: `🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nFitur ini hanya dapat digunakan di *Chat Pribadi*.`,
    prem: `🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nFitur ini hanya tersedia untuk *User Premium*.\nKetik *.prem* untuk informasi upgrade.`,
    wait: `⏳ 𝗖𝗼𝘁𝘁𝗼 𝗠𝗮𝘁𝘁𝗲...\nPermintaan sedang diproses.`,
    error: `❌ 𝗧𝗲𝗿𝗷𝗮𝗱𝗶 𝗸𝗲𝘀𝗮𝗹𝗮𝗵𝗮𝗻\nSilakan coba kembali beberapa saat lagi.`,
    done: `✅ 𝗕𝗲𝗿𝗵𝗮𝘀𝗶𝗹\nProses telah diselesaikan.`
}

// Settings tambahan YannAjah
// prefix bot (bisa juga diubah dari chat: .setprefix / .addprefix)
global.prefix = ['.', '!', '#', '/']
// cara tautkan: 'ask' = ditanya (1 QR / 2 kode), 'qr', atau 'pairing'
global.pairing = 'ask'
// true = bot otomatis follow saluran di atas saat terhubung
global.followSaluran = false
// false = self mode (hanya owner)
global.public = true
// true = user wajib .daftar dulu
global.wajibDaftar = false
// matikan command tertentu, contoh: ['tiktok', 'ai']
global.fiturMati = []


let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(chalk.redBright(`Update ${__filename}`))
	delete require.cache[file]
	require(file)
}).unref()

// Jangan dihapus: dipakai bot untuk membaca settings di atas
module.exports = require('./library/settings-map').settingsMap(global)
