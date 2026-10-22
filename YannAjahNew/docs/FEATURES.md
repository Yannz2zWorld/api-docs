# Katalog Fitur YannAjahNew

> File ini DIBUAT OTOMATIS oleh `npm run features:report` dari feature registry dan hasil uji terakhir (`npm test`). Jangan diedit manual.

Dibuat: 2026-10-22T04:43:48.954Z

## Ringkasan

| Ukuran | Jumlah |
|---|---:|
| Entri registry (termasuk backlog) | 1933 |
| **Fitur unik yang berfungsi** (punya implementasi) | **865** |
| — lulus uji otomatis (tested) | 722 |
| &nbsp;&nbsp;· uji unit (fungsi murni) | 187 |
| &nbsp;&nbsp;· uji mock APIZ2Z (bukan live) | 484 |
| &nbsp;&nbsp;· uji nyata ffmpeg/Jimp | 51 |
| — implemented, belum ada uji otomatis | 143 |
| — gagal uji (failed) | 0 |
| Butuh APIZ2Z_API_KEY | 484 |
| Jalan tanpa API key | 381 |
| Backlog V15 (planned; sebagian alias) | 966 |
| Dikecualikan kebijakan (disabled) | 102 |

### Fitur berfungsi per kategori

| Kategori | Jumlah |
|---|---:|
| text | 99 |
| search | 63 |
| tools | 63 |
| ai | 61 |
| downloader | 55 |
| games | 35 |
| fun | 34 |
| canvas | 34 |
| maker | 31 |
| game | 28 |
| group | 28 |
| image | 28 |
| random | 28 |
| calc | 26 |
| owner | 26 |
| media | 25 |
| dev | 21 |
| textpro | 21 |
| news | 19 |
| primbon | 19 |
| stalk | 17 |
| info | 14 |
| convert | 13 |
| islamic | 13 |
| anime | 12 |
| core | 11 |
| datetime | 10 |
| productivity | 10 |
| user | 8 |
| economy | 6 |
| sticker | 3 |
| music | 1 |
| check | 1 |
| ephoto | 1 |
| movie | 1 |

## Fitur berfungsi (865)

| Command | Alias | Kategori | Deskripsi | Permission | Parameter | Dependency | Status | Uji |
|---|---|---|---|---|---|---|---|---|
| .ai | chatgpt, gpt, openai | ai | ChatGPT: Chat with OpenAI ChatGPT for free without login. | user | prompt*, chatId | APIZ2Z /api/ai/chatgpt | tested | 1/1 mock |
| .aigoogle |  | ai | Google AI Search: Performs a Google search using its AI mode (Gemini Bard Frontend) to get a comprehensive answer. | user | query* | APIZ2Z /api/ai/google | tested | 1/1 mock |
| .aigpt |  | ai | GPT-4o: Chat with GPT-4o Mini supporting text and image input with Dragonfly session cache. | user | text*, imageUrl, chatId | APIZ2Z /api/ai/gpt | tested | 1/1 mock |
| .asynt |  | ai | Asyntai AI: Ngobrol sama AI Asyntai pakai bahasa Indonesia. | user | text*, sessionId | APIZ2Z /api/ai/asynt | tested | 1/1 mock |
| .bard |  | ai | Bard Chat: Ngobrol sama AI Bard. | user | query* | APIZ2Z /api/ai/bard | tested | 1/1 mock |
| .bible |  | ai | Bible AI: Find Bible-based answers using Bible AI. | user | text* | APIZ2Z /api/ai/bible | tested | 1/1 mock |
| .blackbox |  | ai | Blackbox AI: Ngobrol sama Blackbox AI, jago soal coding. | user | text* | APIZ2Z /api/ai/blackbox | tested | 1/1 mock |
| .bypassai |  | ai | Bypass AI: Rewrite text to bypass AI detection. | user | text* | APIZ2Z /api/ai/bypassai | tested | 1/1 mock |
| .claude |  | ai | Claude AI: Chat with Claude Haiku 4.5 via Overchat API. | user | text* | APIZ2Z /api/ai/claude | tested | 1/1 mock |
| .claude2 |  | ai | Claude AI v2: Chat with Claude Haiku 4.5 via Overchat API. | user | text* | APIZ2Z /api/ai/claude-v2 | tested | 1/1 mock |
| .copilot |  | ai | Copilot AI: Chat with Microsoft Copilot AI, supports Web Search, Study Mode, Conversation, and Vision. | user | prompt*, mode, conversationId, imageUrl | APIZ2Z /api/ai/copilot | tested | 1/1 mock |
| .copilot2 |  | ai | Copilot AI v2: Chat with Microsoft Copilot AI, supports Web Search, Study Mode, Conversation, and Vision. | user | prompt* | APIZ2Z /api/ai/copilot-v2 | tested | 1/1 mock |
| .deepai |  | ai | DeepAI Chat: Ngobrol sama chatbot DeepAI. | user | text*, model | APIZ2Z /api/ai/deepai | tested | 1/1 mock |
| .deepsearch |  | ai | DeepSearch: Riset pakai AI: cari dari banyak sumber terus dirangkum. | user | text* | APIZ2Z /api/ai/deepsearch | tested | 1/1 mock |
| .dracintts |  | ai | Dracin Tts: Ubah teks jadi suara ala narator drama China. | user | text*, speed, volume, music | APIZ2Z /api/ai/dracin-tts | tested | 1/1 mock |
| .epsilon |  | ai | Epsilon: Cari jurnal/paper akademik pakai AI. | user | text* | APIZ2Z /api/ai/epsilon | tested | 1/1 mock |
| .flux | txt2img | ai | Flux v1: Bikin gambar dari teks pakai AI Flux. | user | prompt* | APIZ2Z /api/ai/flux | tested | 1/1 mock |
| .gandalf |  | ai | Gandalf AI: Ngobrol sama AI asisten berbahasa Indonesia. | user | q* | APIZ2Z /api/ai/gandalf | tested | 1/1 mock |
| .gemini | bard2 | ai | Gemini: Chat with Google Gemini AI for free without login. | user | prompt*, chatId | APIZ2Z /api/ai/gemini | tested | 1/1 mock |
| .geminitts |  | ai | Gemini Tts: Ubah teks jadi suara pakai Gemini TTS. | user | text* | APIZ2Z /api/ai/gemini-tts | tested | 1/1 mock |
| .geminivision | analisisgambar | ai | Gemini Vision: Gemini dengan gambar: kirim teks (+ unggah gambar opsional). | user | text*, url | APIZ2Z /api/ai/gemini-vision | tested | 1/1 mock |
| .gitagpt |  | ai | GitaGPT: Tanya jawab seputar Bhagavad Gita pakai AI. | user | text* | APIZ2Z /api/ai/gitagpt | tested | 1/1 mock |
| .gpt35turbo |  | ai | GPT-3.5 Turbo: Ngobrol sama GPT-3.5 Turbo. | user | text* | APIZ2Z /api/ai/gpt-3.5-turbo | tested | 1/1 mock |
| .hyperai |  | ai | HyperAI: Chat AI serbaguna (HyperAI). | user | prompt* | APIZ2Z /api/ai/hyperai | tested | 1/1 mock |
| .ideogram |  | ai | Ideogram: Bikin gambar dari teks pakai AI Ideogram. | user | prompt* | APIZ2Z /api/ai/ideogram | tested | 1/1 mock |
| .imagegen | genimage | ai | AI Image Generator: Bikin gambar dari teks pakai AI. | user | text* | APIZ2Z /api/ai/image-gen | tested | 1/1 mock |
| .islamic |  | ai | Islamic: Tanya jawab seputar Islam pakai AI. | user | text* | APIZ2Z /api/ai/islamic | tested | 1/1 mock |
| .kimi | kimiai | ai | Kimi: Ngobrol sama Kimi AI. | user | text* | APIZ2Z /api/ai/kimi | tested | 1/1 mock |
| .lumin |  | ai | Lumin: Ngobrol sama Lumin AI. | user | text* | APIZ2Z /api/ai/lumin | tested | 1/1 mock |
| .magicstudio |  | ai | MagicStudio: Bikin gambar dari teks pakai MagicStudio. | user | prompt* | APIZ2Z /api/ai/magicstudio | tested | 1/1 mock |
| .mathgpt |  | ai | MathGPT: Bantu ngerjain soal matematika pakai AI. | user | text* | APIZ2Z /api/ai/mathgpt | tested | 1/1 mock |
| .monica |  | ai | Monica: Ngobrol sama Monica AI. | user | text* | APIZ2Z /api/ai/monica | tested | 1/1 mock |
| .morphic |  | ai | Morphic: Ngobrol sama Morphic AI, jawabannya pakai sumber dari web. | user | text* | APIZ2Z /api/ai/morphic | tested | 1/1 mock |
| .muslimai |  | ai | Muslim AI: Quran-based Q&A using MuslimAI with Dragonfly session support. | user | query*, chatId | APIZ2Z /api/ai/muslimai | tested | 1/1 mock |
| .muslimai2 |  | ai | Muslim AI v2: Quran-based Q&A using MuslimAI with Dragonfly session support. | user | query* | APIZ2Z /api/ai/muslimai-v2 | tested | 1/1 mock |
| .nanobanana | banana | ai | Nano Banana Edit: Edit gambar pakai AI Nano Banana: edit, hapus background/objek/watermark, pertajam, perbesar. | user | image_url*, prompt*, mode | APIZ2Z /api/ai/nano-banana | tested | 1/1 mock |
| .natalie |  | ai | Natalie: Ngobrol sama Natalie AI. | user | text* | APIZ2Z /api/ai/natalie | tested | 1/1 mock |
| .nsfwcheck |  | ai | NSFW Check: Deteksi apakah sebuah gambar NSFW (unggah atau URL). | user | url* | APIZ2Z /api/ai/nsfw-check | tested | 1/1 mock |
| .nsfwcheck2 |  | ai | NSFW Check v2: Deteksi apakah sebuah gambar NSFW (unggah atau URL). | user | url* | APIZ2Z /api/ai/nsfw-check-v2 | tested | 1/1 mock |
| .overchat |  | ai | Overchat: Ngobrol sama Overchat AI. | user | text* | APIZ2Z /api/ai/overchat | tested | 1/1 mock |
| .pollinations |  | ai | Pollinations Image: Bikin gambar dari teks pakai AI. | user | prompt*, width, height | APIZ2Z /api/ai/pollinations | tested | 1/1 mock |
| .powerbrain |  | ai | PowerBrain: Chat AI PowerBrain. | user | prompt* | APIZ2Z /api/ai/powerbrain | tested | 1/1 mock |
| .powerbrain2 |  | ai | PowerBrain v2: Chat AI PowerBrain. | user | prompt* | APIZ2Z /api/ai/powerbrain-v2 | tested | 1/1 mock |
| .publicai |  | ai | Public AI: Chat with Public AI with Dragonfly session support. | user | text*, chatId | APIZ2Z /api/ai/publicai | tested | 1/1 mock |
| .publicai2 |  | ai | Public AI v2: Chat with Public AI with Dragonfly session support. | user | text* | APIZ2Z /api/ai/publicai-v2 | tested | 1/1 mock |
| .qwen |  | ai | Qwen AI: AI Assistant by Alibaba Cloud (Qwen) with universal support for Text and any File format (Image, Audio, Video, PDF, Documents) with Dragonfly session cache. | user | text*, fileUrl, chatId, search, think | APIZ2Z /api/ai/qwen | tested | 1/1 mock |
| .screnapp |  | ai | Scren App: Tanya AI soal isi gambar: kirim gambar plus pertanyaannya. | user | url_image*, text* | APIZ2Z /api/ai/screnapp | tested | 1/1 mock |
| .simi | simisimi | ai | Simi Simi: Ngobrol santai sama SimSimi. | user | text* | APIZ2Z /api/ai/simisimi | tested | 1/1 mock |
| .sologo |  | ai | Sologo: Bikin logo dari deskripsi pakai AI. | user | prompt* | APIZ2Z /api/ai/sologo | tested | 1/1 mock |
| .story |  | ai | Story: Bikin cerita dari ide kamu: pilih genre, panjang, dan tingkat kreatifnya. | user | prompt*, mode, length, creative | APIZ2Z /api/ai/story | tested | 1/1 mock |
| .talefy |  | ai | Talefy AI Story: Generate AI stories based on prompt and genre using Talefy AI. | user | text*, genre* | APIZ2Z /api/ai/talefy | tested | 1/1 mock |
| .texttoimage | buatgambar | ai | Figurine Generator: Bikin gambar figurine 1/7 ala BANDAI dari deskripsi karakter. | user | name* | APIZ2Z /api/ai/text-to-image | tested | 1/1 mock |
| .turboseek |  | ai | TurboSeek AI: Searches for an answer using TurboSeek AI. | user | text* | APIZ2Z /api/ai/turboseek | tested | 1/1 mock |
| .unlimited |  | ai | Unlimited AI: AI Chat with reasoning model from unlimitedai.chat with Dragonfly session support. | user | text*, chatId | APIZ2Z /api/ai/unlimited | tested | 1/1 mock |
| .venice |  | ai | Venice: Chat AI Venice. | user | prompt* | APIZ2Z /api/ai/venice | tested | 1/1 mock |
| .vider |  | ai | Vider: Bikin gambar dari teks pakai AI Vider. | user | prompt* | APIZ2Z /api/ai/vider | tested | 1/1 mock |
| .voice |  | ai | Magic Hour AI Voice: Generate realistic speech and celebrity/character voices from text prompt using Magic Hour AI. | user | prompt*, voice* | APIZ2Z /api/ai/voice | tested | 1/1 mock |
| .webpilot |  | ai | WebPilot AI: Web-searching AI assistant via Webpilot API with Dragonfly session support. | user | text*, threadId | APIZ2Z /api/ai/webpilot | tested | 1/1 mock |
| .webpilot2 |  | ai | WebPilot AI v2: Web-searching AI assistant via Webpilot API with Dragonfly session support. | user | text* | APIZ2Z /api/ai/webpilot-v2 | tested | 1/1 mock |
| .writecream |  | ai | Write Cream: Ngobrol sama AI Writecream, bisa dikasih instruksi peran (logic). | user | text*, logic* | APIZ2Z /api/ai/writecream | tested | 1/1 mock |
| .writecreamimg |  | ai | Write Cream Image: Bikin gambar dari teks dengan pilihan rasio. | user | prompt*, ratio | APIZ2Z /api/ai/writecreamimg | tested | 1/1 mock |
| .animeanichindetail |  | anime | Anichin Detail: Ambil detail dan daftar episode anime dari Anichin.moe. | user | url* | APIZ2Z /api/anime/anichin/detail | tested | 1/1 mock |
| .animeanichinlatest |  | anime | Anichin Latest: Ambil anime terbaru dari Anichin.moe. | user | page | APIZ2Z /api/anime/anichin/latest | tested | 1/1 mock |
| .animeanichinsearch |  | anime | Anichin Search: Cari anime/donghua dari Anichin.moe. | user | q* | APIZ2Z /api/anime/anichin/search | tested | 1/1 mock |
| .animekiryuusearch |  | anime | Kiryuu Manga Search: Search manga di Kiryuu. | user | q* | APIZ2Z /api/anime/kiryuu/search | tested | 1/1 mock |
| .animekomikuchapter |  | anime | Komiku Chapter: Ambil semua gambar halaman dari satu chapter manga Komiku. | user | url* | APIZ2Z /api/anime/komiku/chapter | tested | 1/1 mock |
| .animekomikudetail |  | anime | Komiku Detail: Detail manga Komiku: sinopsis, genre, dan daftar chapter. | user | url* | APIZ2Z /api/anime/komiku/detail | tested | 1/1 mock |
| .animekomikupopular |  | anime | Komiku Popular: Daftar manga populer di Komiku. | user | page | APIZ2Z /api/anime/komiku/popular | tested | 1/1 mock |
| .animekomikusearch |  | anime | Komiku Search: Cari manga di Komiku. | user | q* | APIZ2Z /api/anime/komiku/search | tested | 1/1 mock |
| .animeoploverzongoing |  | anime | Oploverz Ongoing: Daftar anime ongoing Oploverz. | user | page | APIZ2Z /api/anime/oploverz/ongoing | tested | 1/1 mock |
| .animeoploverzsearch |  | anime | Oploverz Search: Cari anime di Oploverz. | user | q* | APIZ2Z /api/anime/oploverz/search | tested | 1/1 mock |
| .animesamehadakuschedule |  | anime | Samehadaku Schedule: Jadwal rilis anime mingguan dari Samehadaku. | user |  | APIZ2Z /api/anime/samehadaku/schedule | tested | 1/1 mock |
| .komikindo |  | anime | KomikIndo: Manga/manhwa dari KomikIndo: terbaru, cari, genre, detail. | user | action, q, genre, type, url, page | APIZ2Z /api/manga/komikindo | tested | 1/1 mock |
| .average | ratarata | calc | Rata-rata nilai (misal nilai rapor) | user | teks* |  | tested | 1/1 unit |
| .basenum |  | calc | Konversi basis bilangan: .basenum 255 10 16 | user | teks* |  | tested | 1/1 unit |
| .bmi |  | calc | Indeks massa tubuh: .bmi berat(kg) tinggi(cm) | user | teks* |  | tested | 1/1 unit |
| .bungamajemuk |  | calc | Bunga majemuk: .bungamajemuk pokok bunga%/tahun tahun | user | teks* |  | tested | 1/1 unit |
| .bungatunggal |  | calc | Bunga tunggal: .bungatunggal pokok bunga%/tahun tahun | user | teks* |  | tested | 1/1 unit |
| .calc | kalkulator, hitung | calc | Kalkulator: + - * / % ^ ! sqrt sin cos log ln pi e (argumen fungsi dipisah ;) | user | teks* |  | tested | 6/6 unit |
| .cicilan |  | calc | Cicilan per bulan (anuitas): .cicilan pokok bunga%/tahun bulan | user | teks* |  | tested | 2/2 unit |
| .deroman |  | calc | Romawi ke angka | user | teks* |  | tested | 1/1 unit |
| .diskon |  | calc | Harga setelah diskon: .diskon 250000 20 | user | teks* |  | tested | 1/1 unit |
| .factorial |  | calc | Faktorial n! (maks 170, eksak sampai 25 dengan BigInt) | user | teks* |  | tested | 1/1 unit |
| .factorize | faktorprima | calc | Faktorisasi prima | user | teks* |  | tested | 1/1 unit |
| .fibonacci |  | calc | Deret Fibonacci n suku pertama (maks 90) | user | teks* |  | tested | 1/1 unit |
| .gcd | fpb | calc | FPB dari beberapa bilangan | user | teks* |  | tested | 1/1 unit |
| .isprime | prima | calc | Cek bilangan prima | user | teks* |  | tested | 2/2 unit |
| .kuadrat |  | calc | Akar persamaan kuadrat ax²+bx+c=0: .kuadrat a b c | user | teks* |  | tested | 1/1 unit |
| .lcm | kpk | calc | KPK dari beberapa bilangan | user | teks* |  | tested | 1/1 unit |
| .luas |  | calc | Luas bangun: .luas persegi 4 \| persegipanjang 3 5 \| segitiga 3 4 \| lingkaran 7 \| trapesium 3 5 4 | user | teks* |  | tested | 2/2 unit |
| .patungan |  | calc | Bagi tagihan: .patungan total orang [tip%] | user | teks* |  | tested | 1/1 unit |
| .persen |  | calc | Hitung persen: .persen 15 200 (15% dari 200) | user | teks* |  | tested | 1/1 unit |
| .ppn |  | calc | Hitung PPN: .ppn 100000 [tarif% default 11] | user | teks* |  | tested | 1/1 unit |
| .pythagoras |  | calc | Sisi miring segitiga siku-siku: .pythagoras a b | user | teks* |  | tested | 1/1 unit |
| .random | acakangka | calc | Angka acak: .random min max | user | teks* |  | tested | 1/1 unit |
| .roman | romawi | calc | Angka ke Romawi | user | teks* |  | tested | 1/1 unit |
| .stats |  | calc | Statistik data: rata-rata, median, modus, simpangan baku | user | teks* |  | tested | 1/1 unit |
| .terbilang |  | calc | Angka ke kata (Bahasa Indonesia) | user | teks* |  | tested | 2/2 unit |
| .volume |  | calc | Volume bangun ruang: .volume kubus 3 \| balok 2 3 4 \| bola 7 \| tabung 7 10 \| kerucut 7 10 \| prisma luasalas tinggi \| limas luasalas tinggi | user | teks* |  | tested | 1/1 unit |
| .canvasquotly |  | canvas | Quotly: Gambar quote chat ala Telegram dengan latar transparan. | user | text*, name*, avatar*, color* | APIZ2Z /api/canvas/quotly | tested | 1/1 mock |
| .canvasyoutube |  | canvas | YouTube-Thumbnail: Thumbnail gaya YouTube Music: cover, judul, dan penyanyi. | user | title*, artist*, coverurl* | APIZ2Z /api/canvas/youtube | tested | 1/1 mock |
| .goodbyecard |  | canvas | Goodbye Card: Gambar perpisahan member ala Discord. | user | username*, avatar*, guildName*, memberCount, background | APIZ2Z /api/canvas/goodbye | tested | 1/1 mock |
| .goodbyev1 |  | canvas | Goodbye Card v1: Gambar perpisahan member, gaya sedih. | user | username*, avatar*, guildName*, memberCount, background | APIZ2Z /api/canvas/goodbyev1 | tested | 1/1 mock |
| .goodbyev2 |  | canvas | Goodbye Card v2: Gambar perpisahan member, gaya gradien. | user | username*, avatar*, guildName* | APIZ2Z /api/canvas/goodbyev2 | tested | 1/1 mock |
| .goodbyev3 |  | canvas | Goodbye Card v3: Gambar perpisahan member, gaya neon gelap. | user | username*, avatar*, guildName* | APIZ2Z /api/canvas/goodbyev3 | tested | 1/1 mock |
| .goodbyev4 |  | canvas | Goodbye Card v4: Gambar perpisahan member, gaya minimalis. | user | username*, avatar*, guildName* | APIZ2Z /api/canvas/goodbyev4 | tested | 1/1 mock |
| .goodbyev5 |  | canvas | Goodbye Card v5: Gambar perpisahan member, gradien ungu. | user | username*, avatar*, guildName* | APIZ2Z /api/canvas/goodbyev5 | tested | 1/1 mock |
| .gura |  | canvas | Gura: Tempel foto kamu ke template Gura. | user | url* | APIZ2Z /api/canvas/gura | tested | 1/1 mock |
| .igqc |  | canvas | Instagram Quote Chat: Gambar quote DM Instagram. | user | text, image | APIZ2Z /api/canvas/igqc | tested | 1/1 mock |
| .iqc |  | canvas | iPhone Quote Chat: Gambar quote chat iPhone. | user | text*, time | APIZ2Z /api/canvas/iqc | tested | 1/1 mock |
| .iqc2 |  | canvas | iPhone Quote Chat v2: Gambar quote chat iPhone. | user | text* | APIZ2Z /api/canvas/iqc-v2 | tested | 1/1 mock |
| .jmk |  | canvas | Tribun JMK48 Twibbon: Twibbon JMK48 dengan bingkai bulat dari foto kamu. | user | url* | APIZ2Z /api/canvas/jmk | tested | 1/1 mock |
| .kalendercanvas |  | canvas | Kalender: Gambar kalender Indonesia lengkap sama tanggal merahnya. | user | year, month | APIZ2Z /api/canvas/kalender | tested | 1/1 mock |
| .memebeautiful |  | canvas | Meme You're Beautiful: Meme 'You're Beautiful' pakai gambar sendiri. | user | image1*, image2 | APIZ2Z /api/canvas/meme-beautiful | tested | 1/1 mock |
| .memedrake |  | canvas | Meme Drake: Meme Drake: nggak suka vs suka. | user | text1*, text2* | APIZ2Z /api/canvas/meme-drake | tested | 1/1 mock |
| .memejarvis |  | canvas | Meme Jarvis: Meme 'Jarvis, tolong…'. | user | text* | APIZ2Z /api/canvas/meme-jarvis | tested | 1/1 mock |
| .memetwobuttons |  | canvas | Meme Two Buttons: Meme dua tombol: kiri vs kanan. | user | text1*, text2* | APIZ2Z /api/canvas/meme-twobuttons | tested | 1/1 mock |
| .musiccard |  | canvas | Music Card: Kartu musik: judul lagu, nama penyanyi, dan foto. | user | judul*, nama*, image_url* | APIZ2Z /api/canvas/musiccard | tested | 1/1 mock |
| .pixelart |  | canvas | Pixel Art: Ubah gambar jadi pixel art. | user | url*, grid | APIZ2Z /api/canvas/pixel-art | tested | 1/1 mock |
| .pixelart2 |  | canvas | Pixel Art v2: Ubah gambar jadi pixel art. | user | url* | APIZ2Z /api/canvas/pixel-art-v2 | tested | 1/1 mock |
| .profilecard |  | canvas | Profile Card: Kartu profil member ala Discord. | user | username*, avatar*, level, exp, requiredExp, rank, background | APIZ2Z /api/canvas/profile | tested | 1/1 mock |
| .qcwa |  | canvas | WhatsApp Quote Chat: Gambar quote chat WhatsApp (gelap/terang). | user | username, phone, tag, pp*, text, image, mode | APIZ2Z /api/canvas/qcwa | tested | 1/1 mock |
| .rankcard |  | canvas | Rank Card: Kartu rank: username, avatar, level, XP, dan status. | user | username*, avatar*, currentxp*, requiredxp*, status*, level*, rank*, progressbarcolor* | APIZ2Z /api/canvas/rankcard | tested | 1/1 mock |
| .rankup |  | canvas | Rank Up Card: Gambar naik rank. | user | username*, avatar*, oldRank*, newRank*, background | APIZ2Z /api/canvas/rankup | tested | 1/1 mock |
| .shipcard |  | canvas | Ship Card: Gambar kecocokan dua orang (ship). | user | avatar1*, avatar2*, percentage, background | APIZ2Z /api/canvas/ship | tested | 1/1 mock |
| .timpateks |  | canvas | Meme Timpa Teks: Meme tulisan di kertas kecil. | user | username, text* | APIZ2Z /api/canvas/timpa-teks | tested | 1/1 mock |
| .ttqc |  | canvas | TikTok Quote Chat: Gambar quote chat TikTok. | user | username, text*, avatar | APIZ2Z /api/canvas/ttqc | tested | 1/1 mock |
| .welcomecard |  | canvas | Welcome Card: Gambar sambutan member baru ala Discord. | user | username*, guildName*, memberCount*, avatar*, background, guildIcon | APIZ2Z /api/canvas/welcome | tested | 1/1 mock |
| .welcomeleave |  | canvas | Welcome-Leave: Gambar welcome/leave grup: judul, deskripsi, avatar, latar. | user | title*, description*, avatar*, background*, color*, cardstroke* | APIZ2Z /api/canvas/welcomeleave | tested | 1/1 mock |
| .welcomev2 |  | canvas | Welcome Card v2: Gambar sambutan member baru, versi ringkas. | user | username*, guildName*, memberCount*, avatar*, background | APIZ2Z /api/canvas/welcomev2 | tested | 1/1 mock |
| .welcomev3 |  | canvas | Welcome Card v3: Gambar sambutan member baru, gaya gradien. | user | username*, guildName*, memberCount*, avatar* | APIZ2Z /api/canvas/welcomev3 | tested | 1/1 mock |
| .welcomev4 |  | canvas | Welcome Card v4: Gambar sambutan member baru, mode gelap. | user | username*, guildName*, memberCount*, avatar*, background | APIZ2Z /api/canvas/welcomev4 | tested | 1/1 mock |
| .welcomev5 |  | canvas | Welcome Card v5: Gambar sambutan member baru, gaya neon. | user | username*, guildName*, memberCount*, avatar* | APIZ2Z /api/canvas/welcomev5 | tested | 1/1 mock |
| .mlstalk | stalkml, cekml | check | Cek Akun MLBB: Cek akun Mobile Legends: nickname, status first recharge, region. | user | uid*, zone* | APIZ2Z /api/check/mlbb | tested | 1/1 mock |
| .datasize |  | convert | Konversi satuan ukuran data: bit, b, byte, kb, mb, gb, tb, kib… | user | teks* |  | tested | 1/1 unit |
| .daya |  | convert | Konversi satuan daya: w, kw, mw, hp, pk… | user | teks* |  | tested | 1/1 unit |
| .energi |  | convert | Konversi satuan energi: j, kj, cal, kal, kcal, kkal, wh, kwh… | user | teks* |  | tested | 1/1 unit |
| .frekuensi |  | convert | Konversi satuan frekuensi: hz, khz, mhz, ghz, rpm… | user | teks* |  | tested | 1/1 unit |
| .kecepatan |  | convert | Konversi satuan kecepatan: m/s, km/h, kmh, mph, knot, kn… | user | teks* |  | tested | 1/1 unit |
| .konversiwaktu |  | convert | Konversi satuan durasi waktu: ms, s, detik, menit, min, jam, h, hari… | user | teks* |  | tested | 1/1 unit |
| .luasan |  | convert | Konversi satuan luas: mm2, cm2, m2, are, ha, km2, ft2, acre… | user | teks* |  | tested | 1/1 unit |
| .massa |  | convert | Konversi satuan massa / berat: mg, g, ons, kg, kuintal, ton, lb, oz… | user | teks* |  | tested | 1/1 unit |
| .panjang |  | convert | Konversi satuan panjang: mm, cm, dm, m, km, in, inci, ft… | user | teks* |  | tested | 1/1 unit |
| .sudut |  | convert | Konversi satuan sudut: deg, derajat, rad, grad, putaran… | user | teks* |  | tested | 1/1 unit |
| .suhu | temperature | convert | Konversi suhu Celsius/Fahrenheit/Kelvin/Reamur | user | teks* |  | tested | 2/2 unit |
| .tekanan |  | convert | Konversi satuan tekanan: pa, kpa, bar, atm, psi, mmhg… | user | teks* |  | tested | 1/1 unit |
| .volumesatuan |  | convert | Konversi satuan volume: ml, cc, l, liter, dl, m3, gal, galon… | user | teks* |  | tested | 1/1 unit |
| .allmenu |  | core | Semua fitur aktif per kategori | user |  |  | implemented |  |
| .apistatus |  | core | Status koneksi ke APIZ2Z (tanpa memakai kuota) | owner |  |  | implemented |  |
| .botinfo | info | core | Informasi bot, versi, statistik | user |  |  | implemented |  |
| .cmdinfo | caracmd, infofitur | core | Detail sebuah command: deskripsi, alias, parameter, permission, status | user |  |  | implemented |  |
| .menu | help, start | core | Daftar kategori & fitur bot | user |  |  | implemented |  |
| .owner | creator, developerbot | core | Kontak owner bot | user |  |  | implemented |  |
| .ping | p | core | Cek respons bot | user |  |  | implemented |  |
| .runtime | uptime | core | Lama bot berjalan | user |  |  | implemented |  |
| .speed | server | core | Info server: CPU, memori, platform | user |  |  | implemented |  |
| .status | lisensi | core | Status lisensi, koneksi WhatsApp, maintenance | user |  |  | implemented |  |
| .totalfitur | fitur | core | Jumlah fitur per status dan kategori (sesuai registry) | user |  |  | implemented |  |
| .countdown |  | datetime | Hitung mundur ke tanggal | user | teks* |  | tested | 1/1 unit |
| .hari |  | datetime | Nama hari dari tanggal | user | teks* |  | tested | 1/1 unit |
| .hijriah | hijri | datetime | Tanggal Hijriah (kalender Islam, perhitungan tabular — bisa beda ±1 hari dari rukyat) | user |  |  | tested | 1/1 unit |
| .jam | waktu, time | datetime | Jam sekarang (WIB/WITA/WIT atau kota/zona IANA) | user |  |  | tested | 2/2 unit |
| .kabisat |  | datetime | Cek tahun kabisat | user | teks* |  | tested | 2/2 unit |
| .kalender | calendar | datetime | Kalender bulan: .kalender [bulan] [tahun] | user |  |  | tested | 1/1 unit |
| .mingguke |  | datetime | Nomor minggu ISO dari tanggal | user | teks* |  | tested | 1/1 unit |
| .selisihhari |  | datetime | Selisih hari dua tanggal: .selisihhari 01-01-2024 31-12-2024 | user | teks* |  | tested | 1/1 unit |
| .tambahhari |  | datetime | Tanggal setelah N hari: .tambahhari 17-08-2024 100 | user | teks* |  | tested | 1/1 unit |
| .umur |  | datetime | Hitung umur dari tanggal lahir | user | teks* |  | tested | 1/1 unit |
| .chmod |  | dev | Konversi izin chmod angka ↔ simbol | user | teks* |  | tested | 2/2 unit |
| .color | warna | dev | Konversi warna HEX ↔ RGB ↔ HSL | user | teks* |  | tested | 1/1 unit |
| .genpassword | passgen | dev | Buat password acak kuat (8-64 karakter) | user/private |  |  | tested | 1/1 unit |
| .hmac |  | dev | HMAC-SHA256: .hmac kunci\|pesan | user | teks* |  | tested | 1/1 unit |
| .httpstatus | statuscode | dev | Arti kode status HTTP | user | teks* |  | tested | 1/1 unit |
| .jsonformat | prettyjson | dev | Rapikan (pretty print) JSON | user | teks* |  | tested | 1/1 unit |
| .jsonkeys |  | dev | Daftar path key di JSON | user | teks* |  | tested | 1/1 unit |
| .jsonminify |  | dev | Minify JSON | user | teks* |  | tested | 1/1 unit |
| .jsonvalidate |  | dev | Validasi JSON | user | teks* |  | tested | 2/2 unit |
| .jwtdecode |  | dev | Decode payload JWT (TANPA verifikasi tanda tangan) | user | teks* |  | tested | 1/1 unit |
| .md5 |  | dev | Hash MD5 (bukan untuk password!) | user | teks* |  | tested | 1/1 unit |
| .mimetype | mime | dev | MIME type dari ekstensi file | user | teks* |  | tested | 1/1 unit |
| .passwordcheck | cekpassword | dev | Cek kekuatan password (tidak disimpan/dicatat) | user/private | teks* |  | tested | 2/2 unit |
| .regex |  | dev | Uji regex: .regex pola\|teks (flag opsional: /pola/gi\|teks) | user | teks* |  | tested | 1/1 unit |
| .sha1 |  | dev | Hash SHA-1 | user | teks* |  | tested | 1/1 unit |
| .sha256 |  | dev | Hash SHA-256 | user | teks* |  | tested | 1/1 unit |
| .sha3 |  | dev | Hash SHA3-256 | user | teks* |  | tested | 1/1 unit |
| .sha512 |  | dev | Hash SHA-512 | user | teks* |  | tested | 1/1 unit |
| .timestamp | epoch | dev | Unix timestamp ↔ tanggal ISO | user |  |  | tested | 2/2 unit |
| .urlparse |  | dev | Uraikan komponen URL | user | teks* |  | tested | 1/1 unit |
| .uuid |  | dev | Generate UUID v4 acak (maks 20) | user |  |  | tested | 1/1 unit |
| .aio | allinone, downloadall | downloader | AIO Downloader: Download videos and music from TikTok, YouTube, Facebook, Instagram and more in one endpoint. | user | url* | APIZ2Z /api/download/aio | tested | 1/1 mock |
| .aio2 |  | downloader | AIO Downloader v2: Download videos and music from TikTok, YouTube, Facebook, Instagram and more in one endpoint. | user | url* | APIZ2Z /api/download/aio-v2 | tested | 1/1 mock |
| .applemusicdl |  | downloader | Apple Music Downloader: Download Apple Music songs as MP3. | user | url* | APIZ2Z /api/download/applemusic | tested | 1/1 mock |
| .bilibili |  | downloader | Bilibili Downloader: Download video dari Bilibili (bilibili.tv). | user | url*, quality | APIZ2Z /api/download/bilibili | tested | 1/1 mock |
| .capcut | capcutdl | downloader | CapCut Template Downloader: Download the video and metadata of a CapCut template. | user | url* | APIZ2Z /api/download/capcut | tested | 1/1 mock |
| .capcut2 |  | downloader | CapCut Template Downloader v2: Download the video and metadata of a CapCut template. | user | url* | APIZ2Z /api/download/capcut-v2 | tested | 1/1 mock |
| .dailymotion |  | downloader | Dailymotion Downloader: Download Dailymotion videos with a choice of resolutions. | user | url* | APIZ2Z /api/download/dailymotion | tested | 1/1 mock |
| .douyin |  | downloader | Douyin Downloader: Download watermark-free videos or slide images from Douyin (TikTok China). | user | url* | APIZ2Z /api/download/douyin | tested | 1/1 mock |
| .downloadnpm |  | downloader | NPM Package Downloader: Download paket npm jadi file .tgz. | user | package*, version | APIZ2Z /api/download/npm | tested | 1/1 mock |
| .downloadytdl |  | downloader | YouTube Stream Extractor: Get the direct video and audio stream links with metadata of a YouTube video. | user | url* | APIZ2Z /api/download/ytdl | tested | 1/1 mock |
| .facebook | fb, fbdl | downloader | Facebook Downloader: Download HD/SD videos or image posts from Facebook. | user | url* | APIZ2Z /api/download/facebook | tested | 1/1 mock |
| .facebook2 |  | downloader | Facebook Downloader v2: Download HD/SD videos or image posts from Facebook. | user | url* | APIZ2Z /api/download/facebook-v2 | tested | 1/1 mock |
| .gdrive | gdrivedl | downloader | Google Drive Downloader: Info & direct link file publik Google Drive. | user | url* | APIZ2Z /api/download/gdrive | tested | 1/1 mock |
| .gdrive2 |  | downloader | Google Drive Downloader v2: Info & direct link file publik Google Drive. | user | url* | APIZ2Z /api/download/gdrive-v2 | tested | 1/1 mock |
| .getsticker |  | downloader | GetStickerPack Downloader: Get the sticker image links of a getstickerpack.com pack. | user | url* | APIZ2Z /api/download/getsticker | tested | 1/1 mock |
| .github |  | downloader | GitHub Downloader: Download repo GitHub jadi ZIP, atau file-nya langsung. | user | url* | APIZ2Z /api/download/github | tested | 1/1 mock |
| .github2 |  | downloader | GitHub Downloader v2: Download repo GitHub jadi ZIP, atau file-nya langsung. | user | url* | APIZ2Z /api/download/github-v2 | tested | 1/1 mock |
| .instagram | ig, igdl | downloader | Instagram Downloader: Download videos and photos from Instagram Reels and posts. | user | url* | APIZ2Z /api/download/instagram | tested | 1/1 mock |
| .iqiyi |  | downloader | iQIYI Detail: Detail dan daftar episode album iQIYI. | user | slug* | APIZ2Z /api/detail/iqiyi | tested | 1/1 mock |
| .kolid |  | downloader | Instagram Downloader (KOL.ID): Download Instagram videos, photos, reels and stories via KOL.ID. | user | url* | APIZ2Z /api/download/kolid | tested | 1/1 mock |
| .lahelu |  | downloader | Lahelu Downloader: Ambil media & info post Lahelu.com. | user | url* | APIZ2Z /api/download/lahelu | tested | 1/1 mock |
| .likee |  | downloader | Likee Downloader: Download watermark-free videos from Likee. | user | url* | APIZ2Z /api/download/likee | tested | 1/1 mock |
| .mediafire | mf | downloader | Mediafire Downloader: Get the file details and direct download link of a Mediafire file. | user | url* | APIZ2Z /api/download/mediafire | tested | 1/1 mock |
| .mediafire2 |  | downloader | Mediafire Downloader v2: Get the file details and direct download link of a Mediafire file. | user | url* | APIZ2Z /api/download/mediafire-v2 | tested | 1/1 mock |
| .mixcloud |  | downloader | Mixcloud Downloader: Get the metadata and stream URLs of Mixcloud music and audio. | user | url* | APIZ2Z /api/download/mixcloud | tested | 1/1 mock |
| .pindl | pinterestdl | downloader | Pinterest Downloader: Download original-quality images and videos from Pinterest. | user | url* | APIZ2Z /api/download/pinterest | tested | 1/1 mock |
| .pinterest2 |  | downloader | Pinterest Downloader v2: Download original-quality images and videos from Pinterest. | user | url* | APIZ2Z /api/download/pinterest-v2 | tested | 1/1 mock |
| .play | song, lagu | downloader | Play (Song Search & MP3): Search a song by title or keywords and download it as MP3 320 kbps with lyrics. | user | query* | APIZ2Z /api/download/play | tested | 1/1 mock |
| .play2 |  | downloader | Play (Song Search & MP3) v2: Search a song by title or keywords and download it as MP3 320 kbps with lyrics. | user | query* | APIZ2Z /api/download/play-v2 | tested | 1/1 mock |
| .play3 |  | downloader | Play (Song Search & MP3) v3: Search a song by title or keywords and download it as MP3 320 kbps with lyrics. | user | query* | APIZ2Z /api/download/play-v3 | tested | 1/1 mock |
| .reddit |  | downloader | Reddit Downloader: Download videos and images from Reddit posts. | user | url* | APIZ2Z /api/download/reddit | tested | 1/1 mock |
| .scribd |  | downloader | Scribd Downloader: Get the image link of every page of a Scribd document. | user | url* | APIZ2Z /api/download/scribd | tested | 1/1 mock |
| .sfile |  | downloader | Sfile Downloader: Get the direct download link of an Sfile.co file. | user | url* | APIZ2Z /api/download/sfile | tested | 1/1 mock |
| .shopee |  | downloader | Shopee Video Downloader: Download videos and metadata from Shopee Video and shp.ee short links. | user | url* | APIZ2Z /api/download/shopee | tested | 1/1 mock |
| .snackvideo |  | downloader | SnackVideo Downloader: Download video SnackVideo tanpa watermark. | user | url* | APIZ2Z /api/download/snackvideo | tested | 1/1 mock |
| .soundclouddl | scdl | downloader | SoundCloud Downloader: Download lagu dari SoundCloud (MP3). | user | url* | APIZ2Z /api/download/soundcloud | tested | 1/1 mock |
| .spotify2 |  | downloader | Spotify Downloader v2: Download a Spotify track as MP3 320 kbps with lyrics (track links only, not albums or playlists). | user | url* | APIZ2Z /api/download/spotify-v2 | tested | 1/1 mock |
| .spotifydl |  | downloader | Spotify Downloader: Download a Spotify track as MP3 320 kbps with lyrics (track links only, not albums or playlists). | user | url* | APIZ2Z /api/download/spotify | tested | 1/1 mock |
| .stickerly |  | downloader | Sticker.ly Downloader: Get the details and stickers of a Sticker.ly pack. | user | url* | APIZ2Z /api/download/stickerly | tested | 1/1 mock |
| .telestick |  | downloader | Telegram Sticker Downloader: Get the details and stickers of a Telegram sticker pack. | user | url* | APIZ2Z /api/download/telestick | tested | 1/1 mock |
| .telestick2 |  | downloader | Telegram Sticker Downloader v2: Get the details and stickers of a Telegram sticker pack. | user | url* | APIZ2Z /api/download/telestick-v2 | tested | 1/1 mock |
| .terabox |  | downloader | Terabox Downloader: Download files and videos from Terabox links. | user | url* | APIZ2Z /api/download/terabox | tested | 1/1 mock |
| .threads | threadsdl | downloader | Threads Downloader: Download videos and images from Threads posts. | user | url* | APIZ2Z /api/download/threads | tested | 1/1 mock |
| .tiktok | tt, ttdl, tiktokdl | downloader | Tiktok Downloader: Download video atau slideshow Tiktok tanpa watermark. | user | url* | APIZ2Z /api/download/tiktok | tested | 1/1 mock |
| .tiktok2 |  | downloader | TikTok Downloader v2: Unduh video TikTok tanpa watermark. | user | url* | APIZ2Z /api/download/tiktok-v2 | tested | 1/1 mock |
| .tiktok3 |  | downloader | Tiktok Downloader v3: Download video atau slideshow Tiktok tanpa watermark. | user | url* | APIZ2Z /api/download/tiktok-v3 | tested | 1/1 mock |
| .twitter | twdl, xdl | downloader | X (Twitter) Downloader: Download videos and images with metadata from X/Twitter posts. | user | url* | APIZ2Z /api/download/twitter | tested | 1/1 mock |
| .twitter2 |  | downloader | X (Twitter) Downloader v2: Download videos and images with metadata from X/Twitter posts. | user | url* | APIZ2Z /api/download/twitter-v2 | tested | 1/1 mock |
| .vdko |  | downloader | VDKO / VDY.TO Downloader: Get the direct MP4 link of a VDKO or VDY.TO video. | user | url* | APIZ2Z /api/download/vdko | tested | 1/1 mock |
| .weibo |  | downloader | Weibo Downloader: Download videos and photos from Weibo posts without logging in. | user | url* | APIZ2Z /api/download/weibo | tested | 1/1 mock |
| .xhs |  | downloader | Xiaohongshu Downloader: Download images and videos with metadata from Xiaohongshu (RED) posts. | user | url* | APIZ2Z /api/download/xhs | tested | 1/1 mock |
| .youtube | ytdl, yt | downloader | YouTube Downloader: Unduh video YouTube. | user | url*, type, quality | APIZ2Z /api/download/youtube | tested | 1/1 mock |
| .youtube2 |  | downloader | YouTube Downloader v2: Unduh video YouTube. | user | url*, quality | APIZ2Z /api/download/youtube-v2 | tested | 1/1 mock |
| .ytmp3 | yta | downloader | YouTube Audio Downloader: Download YouTube audio in the format and bitrate you choose. | user | url*, format, bitrate | APIZ2Z /api/download/ytmp3 | tested | 1/1 mock |
| .ytmp4 | ytv, ytvideo | downloader | YouTube Video Downloader: Download a YouTube video in the resolution you choose. | user | url*, resolution | APIZ2Z /api/download/ytmp4 | tested | 1/1 mock |
| .buylimit | tukarlimit | economy | Tukar saldo virtual dengan limit (1 limit = 500 saldo) | user |  |  | implemented |  |
| .kerja | work | economy | Bekerja untuk mendapat saldo (sekali per jam) | user |  |  | implemented |  |
| .saldo | balance, bal, dompet | economy | Cek saldo virtual kamu (atau @user) | user |  |  | implemented |  |
| .toplevel | topexp | economy | 10 besar exp | user |  |  | implemented |  |
| .topsaldo | leaderboard, lb, richest | economy | 10 besar saldo | user |  |  | implemented |  |
| .transfer | tf | economy | Kirim saldo virtual: .transfer @user jumlah | user |  |  | implemented |  |
| .bravegreen |  | ephoto | Brave Green: Filter duotone hijau-pink buat foto. | user | url* | APIZ2Z /api/ephoto/bravegreen | tested | 1/1 mock |
| .8ball | magicball | fun | Bola ajaib 8 menjawab pertanyaanmu | user |  |  | tested | 1/1 unit |
| .alay2 |  | fun | Teks Alay v2: Ubah teks jadi gaya alay. | user | text* | APIZ2Z /api/fun/alay-v2 | tested | 1/1 mock |
| .alayapi |  | fun | Teks Alay: Ubah teks jadi gaya alay. | user | text* | APIZ2Z /api/fun/alay | tested | 1/1 mock |
| .apakah | bisakah | fun | Tanya jawab ya/tidak acak (hiburan) | user | teks* |  | tested | 1/1 unit |
| .berapa |  | fun | Berapa ...? jawaban angka acak (hiburan) | user | teks* |  | tested | 1/1 unit |
| .cekbaik |  | fun | Seberapa baik hati kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekbucin |  | fun | Seberapa bucin kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekcantik |  | fun | Seberapa cantik kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekgalau |  | fun | Seberapa galau kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekganteng |  | fun | Seberapa ganteng kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekhoki |  | fun | Seberapa hoki hari ini kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekjones |  | fun | Seberapa jomblo kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekkaya |  | fun | Seberapa kaya kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekkeren |  | fun | Seberapa keren kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekkodam |  | fun | Cek "khodam" kamu hari ini (hiburan) | user |  |  | implemented |  |
| .ceklucu |  | fun | Seberapa lucu kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekmalas |  | fun | Seberapa malas kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekpintar |  | fun | Seberapa pintar kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .ceksabar |  | fun | Seberapa sabar kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .ceksial |  | fun | Seberapa sial hari ini kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekstress |  | fun | Seberapa stress kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .cekwibu |  | fun | Seberapa wibu kamu hari ini? (hiburan) | user |  |  | implemented |  |
| .fancytext |  | fun | Fancy Text: Ubah teks jadi 40+ gaya font unik. | user | text* | APIZ2Z /api/fun/fancytext | tested | 1/1 mock |
| .funumur |  | fun | Fakta Umur: Fakta seru dari tanggal lahir: umur detail, statistik, dan lain-lain. | user | birthdate* | APIZ2Z /api/fun/umur | tested | 1/1 mock |
| .kapan | kapankah | fun | Kapan sesuatu terjadi? (hiburan) | user | teks* |  | tested | 1/1 unit |
| .livefunfact |  | fun | Live Fun Facts: Fakta seru soal tubuhmu sejak lahir berdasarkan tanggal lahir. | user | birthdate* | APIZ2Z /api/fun/livefunfact | tested | 1/1 mock |
| .motivasi | quotesmotivasi | fun | Kata-kata motivasi acak | user |  |  | tested | 1/1 unit |
| .nomin |  | fun | Nama Samaran: Nama samaran acak. | user |  | APIZ2Z /api/fun/nomin | tested | 1/1 mock |
| .pantun |  | fun | Pantun acak | user |  |  | tested | 1/1 unit |
| .pasangan | jadian | fun | Pasangkan dua anggota grup secara acak (hiburan) | user/group |  |  | implemented |  |
| .pilih | choose | fun | Pilihkan satu opsi: .pilih nasi\|mie\|roti | user | teks* |  | tested | 1/1 unit |
| .rate | nilai | fun | Beri nilai 1-10 untuk apa saja (konsisten per hari) | user |  |  | tested | 1/1 unit |
| .ship | jodoh, cocok | fun | Persentase kecocokan dua nama (hiburan, hasil konsisten) | user | teks* |  | tested | 2/2 unit |
| .siapa | siapakah | fun | Pilih anggota grup secara acak untuk sebuah pertanyaan | user/group |  |  | implemented |  |
| .asahotak |  | game | Asah otak: jawab pertanyaan pengetahuan umum (228 soal) | user |  | data/game/asahotak.json | implemented |  |
| .caklontong |  | game | Teka-teki nyeleneh ala Cak Lontong (414 soal) | user |  | data/game/caklontong.json | implemented |  |
| .dadu | dice, roll | game | Lempar dadu: .dadu [jumlah dadu] [sisi] | user |  |  | tested | 1/1 unit |
| .family100 |  | game | Family 100: sebutkan jawaban survei sebanyak-banyaknya (7152 soal) | user |  | data/game/family100.json | implemented |  |
| .gamestatus |  | game | Status game yang sedang berjalan di chat ini | user |  |  | implemented |  |
| .hint | petunjuk, bantuan | game | Petunjuk untuk game tebak-tebakan yang sedang berjalan (hadiah berkurang) | user |  |  | implemented |  |
| .koin | coinflip, flip | game | Lempar koin (angka/gambar) | user |  |  | tested | 1/1 unit |
| .kuismath | math, mathquiz | game | Kuis matematika: .kuismath [easy\|medium\|hard] | user |  |  | implemented |  |
| .lengkapikalimat |  | game | Lengkapi peribahasa/kalimat yang rumpang (103 soal) | user |  | data/game/lengkapikalimat.json | implemented |  |
| .nyerah | menyerah, giveup | game | Menyerah pada game yang sedang berjalan | user |  |  | implemented |  |
| .siapakahaku |  | game | Siapakah aku? Tebak dari ciri-cirinya (268 soal) | user |  | data/game/siapakahaku.json | implemented |  |
| .slot |  | game | Mesin slot memakai saldo: .slot <taruhan> | user |  |  | implemented |  |
| .suit | rps | game | Suit melawan bot: .suit batu\|gunting\|kertas | user |  |  | tested | 1/1 unit |
| .susunkata |  | game | Susun huruf acak menjadi kata (353 soal) | user |  | data/game/susunkata.json | implemented |  |
| .tebakangka |  | game | Tebak angka 1-100 dengan petunjuk lebih besar/kecil (7 kesempatan) | user |  |  | implemented |  |
| .tebakanime |  | game | Tebak nama karakter anime dari gambar (145 soal) | user |  | data/game/tebakanime.json | implemented |  |
| .tebakbendera |  | game | Tebak nama negara dari benderanya (254 soal) | user |  | data/game/tebakbendera.json | implemented |  |
| .tebakgambar |  | game | Tebak kata/kalimat dari gambar (1000 soal) | user |  | data/game/tebakgambar.json | implemented |  |
| .tebakgame |  | game | Tebak judul game dari gambar (37 soal) | user |  | data/game/tebakgame.json | implemented |  |
| .tebakgenshin |  | game | Tebak karakter Genshin Impact (66 soal) | user |  | data/game/tebakgenshin.json | implemented |  |
| .tebakhero |  | game | Tebak hero Mobile Legends (52 soal) | user |  | data/game/tebakhero.json | implemented |  |
| .tebakhewan |  | game | Tebak nama hewan dari ciri-cirinya (30 soal) | user |  | data/game/tebakhewan.json | implemented |  |
| .tebakkata |  | game | Tebak kata dari petunjuk-petunjuk (302 soal) | user |  | data/game/tebakkata.json | implemented |  |
| .tebaklagu |  | game | Tebak judul lagu dari cuplikan audio (750 soal) | user |  | data/game/tebaklagu.json | implemented |  |
| .tebaklirik |  | game | Lengkapi lirik lagu yang hilang (38 soal) | user |  | data/game/tebaklirik.json | implemented |  |
| .tebaklogo |  | game | Tebak merek dari logonya (153 soal) | user |  | data/game/tebaklogo.json | implemented |  |
| .tebakmakanan |  | game | Tebak nama makanan dari gambar (48 soal) | user |  | data/game/tebakmakanan.json | implemented |  |
| .tictactoe | ttt | game | Tictactoe 2 pemain: .tictactoe @lawan, lalu kirim angka 1-9 | user/group |  |  | implemented |  |
| .asahotak2 |  | games | Asah Otak v2: Asah Otak kuis acak. | user |  | APIZ2Z /api/games/asahotak-v2 | tested | 1/1 mock |
| .bluearchive |  | games | Blue Archive Database: Database karakter Blue Archive. | user | action, q | APIZ2Z /api/game/bluearchive | tested | 1/1 mock |
| .ccsd |  | games | Cerdas Cermat SD: Kuis cc-sd. | user |  | APIZ2Z /api/games/cc-sd | tested | 1/1 mock |
| .gamesasahotak |  | games | Asah Otak: Asah Otak kuis acak. | user |  | APIZ2Z /api/games/asahotak | tested | 1/1 mock |
| .gamescaklontong |  | games | Cak Lontong: Cak Lontong kuis acak. | user |  | APIZ2Z /api/games/caklontong | tested | 1/1 mock |
| .gamesfamily100 |  | games | Family 100: Family 100 quiz. | user |  | APIZ2Z /api/games/family100 | tested | 1/1 mock |
| .gamesislamic |  | games | Islamic: Kuis seputar Islam acak. | user |  | APIZ2Z /api/games/islamic | tested | 1/1 mock |
| .gameslengkapikalimat |  | games | Lengkapi Kalimat: Kuis lengkapikalimat. | user |  | APIZ2Z /api/games/lengkapikalimat | tested | 1/1 mock |
| .gamesmathquiz |  | games | Math Quiz: Kuis math-quiz. | user |  | APIZ2Z /api/games/math-quiz | tested | 1/1 mock |
| .gamessusunkata |  | games | Susun Kata: Game susun kata. | user |  | APIZ2Z /api/games/susunkata | tested | 1/1 mock |
| .gamestebakbendera |  | games | Tebak Bendera: Game tebak bendera negara. | user |  | APIZ2Z /api/games/tebakbendera | tested | 1/1 mock |
| .gamestebakgambar |  | games | Tebak Gambar: Game tebak gambar. | user |  | APIZ2Z /api/games/tebakgambar | tested | 1/1 mock |
| .gamestebakgame |  | games | Tebak Game: Game tebak-tebakan seputar game. | user |  | APIZ2Z /api/games/tebakgame | tested | 1/1 mock |
| .gamestebakhewan |  | games | Tebak Hewan: Kuis tebak-hewan. | user |  | APIZ2Z /api/games/tebak-hewan | tested | 1/1 mock |
| .gamestebakkata |  | games | Tebak Kata: Game tebak kata. | user |  | APIZ2Z /api/games/tebakkata | tested | 1/1 mock |
| .gamestebaklagu |  | games | Tebak Lagu: Kuis tebak-lagu. | user |  | APIZ2Z /api/games/tebak-lagu | tested | 1/1 mock |
| .gamestebaklirik |  | games | Tebak Lirik: Kuis tebak-lirik. | user |  | APIZ2Z /api/games/tebak-lirik | tested | 1/1 mock |
| .gamestebaklogo |  | games | Tebak Logo: Kuis tebak-logo. | user |  | APIZ2Z /api/games/tebak-logo | tested | 1/1 mock |
| .siapadia |  | games | Siapa Dia: Kuis siapa-dia. | user |  | APIZ2Z /api/games/siapa-dia | tested | 1/1 mock |
| .siapadia2 |  | games | Siapa Dia v2: Kuis siapa-dia. | user |  | APIZ2Z /api/games/siapa-dia-v2 | tested | 1/1 mock |
| .susunkata2 |  | games | Susun Kata v2: Game susun kata. | user |  | APIZ2Z /api/games/susunkata-v2 | tested | 1/1 mock |
| .tebakheroml |  | games | Tebak Hero ML: Game tebak hero Mobile Legends. | user |  | APIZ2Z /api/games/tebakheroml | tested | 1/1 mock |
| .tebakkabupaten |  | games | Tebak Kabupaten: Kuis tebak-kabupaten. | user |  | APIZ2Z /api/games/tebak-kabupaten | tested | 1/1 mock |
| .tebakkalimat |  | games | Tebak Kalimat: Kuis tebak-kalimat. | user |  | APIZ2Z /api/games/tebak-kalimat | tested | 1/1 mock |
| .tebakkarakterff |  | games | Tebak Karakter FF: Kuis tebak-karakter-ff. | user |  | APIZ2Z /api/games/tebak-karakter-ff | tested | 1/1 mock |
| .tebakkartun |  | games | Tebak Kartun: Kuis tebak-kartun. | user |  | APIZ2Z /api/games/tebak-kartun | tested | 1/1 mock |
| .tebakkimia |  | games | Tebak Kimia: Kuis tebak-kimia. | user |  | APIZ2Z /api/games/tebak-kimia | tested | 1/1 mock |
| .tebakkimia2 |  | games | Tebak Kimia v2: Kuis tebak-kimia. | user |  | APIZ2Z /api/games/tebak-kimia-v2 | tested | 1/1 mock |
| .tebaklirik2 |  | games | Tebak Lirik v2: Kuis tebak-lirik. | user |  | APIZ2Z /api/games/tebak-lirik-v2 | tested | 1/1 mock |
| .tebaksiapa |  | games | Tebak Siapa: Kuis tebak-siapa. | user |  | APIZ2Z /api/games/tebak-siapa | tested | 1/1 mock |
| .tebaktebakan |  | games | Tebak Tebak An: Kuis tebak-tebakan. | user |  | APIZ2Z /api/games/tebak-tebakan | tested | 1/1 mock |
| .tebaktebakan2 |  | games | Tebak Tebak An v2: Kuis tebak-tebakan. | user |  | APIZ2Z /api/games/tebak-tebakan-v2 | tested | 1/1 mock |
| .tebakwarna |  | games | Tebak Warna: Kuis tebak-warna. | user |  | APIZ2Z /api/games/tebak-warna | tested | 1/1 mock |
| .tekateki |  | games | Teka-Teki: Teka-teki acak plus jawabannya. | user |  | APIZ2Z /api/games/tekateki | tested | 1/1 mock |
| .tekateki2 |  | games | Teka-Teki v2: Teka-teki acak plus jawabannya. | user |  | APIZ2Z /api/games/tekateki-v2 | tested | 1/1 mock |
| .add |  | group | Tambahkan anggota dengan nomor (hanya nomor yang mengizinkan) | admin/group |  |  | implemented |  |
| .antilink |  | group | Nyalakan/matikan Anti link grup WhatsApp lain: .antilink on/off | admin/group |  |  | implemented |  |
| .antilinkstatus |  | group | Status anti-link grup ini | admin/group |  |  | implemented |  |
| .closegc | tutupgrup, close | group | Tutup grup (hanya admin yang bisa kirim pesan) | admin/group |  |  | implemented |  |
| .del | delete, hapus | group | Hapus pesan yang di-reply (pesan bot, atau pesan anggota jika bot admin) | admin/group |  |  | implemented |  |
| .delwarn | unwarn | group | Hapus peringatan anggota | admin/group |  |  | implemented |  |
| .demote |  | group | Copot admin | admin/group |  |  | implemented |  |
| .groupinfo | infogrup, gcinfo | group | Info grup: nama, anggota, admin, pengaturan bot | user/group |  |  | implemented |  |
| .hidetag | ht, h | group | Kirim pesan yang men-tag semua anggota tanpa daftar | admin/group |  |  | implemented |  |
| .kick | kik, tendang | group | Keluarkan anggota (tag/reply/nomor) | admin/group |  |  | implemented |  |
| .leave | keluar | group | Bot keluar dari grup ini | owner/group |  |  | implemented |  |
| .left |  | group | Nyalakan/matikan Pesan perpisahan: .left on/off | admin/group |  |  | implemented |  |
| .linkgc | linkgrup | group | Link undangan grup | user/group |  |  | implemented |  |
| .listadmin | tagadmin, admins | group | Daftar (dan tag) admin grup | user/group |  |  | implemented |  |
| .listwarn | cekwarn | group | Daftar peringatan di grup ini | user/group |  |  | implemented |  |
| .lockinfo |  | group | Kunci info grup (hanya admin yang bisa ubah info) | admin/group |  |  | implemented |  |
| .mute |  | group | Nyalakan/matikan Mute bot di grup ini (bot hanya merespons owner): .mute on/off | admin/group |  |  | implemented |  |
| .onlyadmin |  | group | Nyalakan/matikan Mode hanya admin yang bisa pakai bot: .onlyadmin on/off | admin/group |  |  | implemented |  |
| .opengc | bukagrup, open | group | Buka grup (semua anggota bisa kirim pesan) | admin/group |  |  | implemented |  |
| .promote | jadiadmin | group | Jadikan admin | admin/group |  |  | implemented |  |
| .resetlinkgc | revoke | group | Reset link undangan grup | admin/group |  |  | implemented |  |
| .setdesc | setdeskripsi | group | Ganti deskripsi grup | admin/group |  |  | implemented |  |
| .setleft |  | group | Atur teks perpisahan (@user @group @count) | admin/group |  |  | implemented |  |
| .setnamagc | setsubject | group | Ganti nama grup | admin/group |  |  | implemented |  |
| .setwelcome |  | group | Atur teks welcome (@user @group @desc @count) | admin/group |  |  | implemented |  |
| .tagall | everyone | group | Tag semua anggota (dengan daftar) | admin/group |  |  | implemented |  |
| .warn | peringatan | group | Beri peringatan; kena batas = dikeluarkan (kalau bot admin) | admin/group |  |  | implemented |  |
| .welcome |  | group | Nyalakan/matikan Pesan selamat datang: .welcome on/off | admin/group |  |  | implemented |  |
| .blurimg |  | image | Efek gambar: Blur gambar: .blurimg [1-50] | user |  |  | tested | 1/1 real |
| .brightness |  | image | Efek gambar: Kecerahan: .brightness [-1..1] | user |  |  | tested | 1/1 real |
| .circleimg |  | image | Efek gambar: Potong bulat | user |  |  | tested | 1/1 real |
| .contrast |  | image | Efek gambar: Kontras: .contrast [-1..1] | user |  |  | tested | 1/1 real |
| .dither |  | image | Efek gambar: Efek dither | user |  |  | tested | 1/1 real |
| .edge |  | image | Efek gambar: Deteksi tepi (sketsa garis) | user |  |  | tested | 1/1 real |
| .emboss |  | image | Efek gambar: Efek emboss | user |  |  | tested | 1/1 real |
| .fade |  | image | Efek gambar: Transparansi: .fade [0-1] | user |  |  | tested | 1/1 real |
| .fliph |  | image | Efek gambar: Balik horizontal (cermin) | user |  |  | tested | 1/1 real |
| .flipv |  | image | Efek gambar: Balik vertikal | user |  |  | tested | 1/1 real |
| .gaussian |  | image | Efek gambar: Gaussian blur halus: .gaussian [1-10] | user |  |  | tested | 1/1 real |
| .grayscale |  | image | Efek gambar: Hitam putih | user |  |  | tested | 1/1 real |
| .imageascii |  | image | Image to ASCII: Ubah gambar jadi ASCII art. | user | url*, width, color | APIZ2Z /api/tools/image-ascii | tested | 1/1 mock |
| .imageascii2 |  | image | Image to ASCII v2: Ubah gambar jadi ASCII art. | user | url* | APIZ2Z /api/tools/image-ascii-v2 | tested | 1/1 mock |
| .imageinfo | infogambar | image | Info gambar: ukuran, resolusi, warna dominan rata-rata | user |  |  | tested | 1/1 real |
| .imgeditpixelate |  | image | Pixelate: Ubah gambar jadi pixel (level 1-40). | user | url*, level | APIZ2Z /api/imgedit/pixelate | tested | 1/1 mock |
| .invert |  | image | Efek gambar: Warna terbalik (negatif) | user |  |  | tested | 1/1 real |
| .lumiart |  | image | Lumi Art: Turn a photo into a Lumi Art style image. | user | imageUrl* | APIZ2Z /api/image/lumiart | tested | 1/1 mock |
| .normalize |  | image | Efek gambar: Normalisasi warna otomatis | user |  |  | tested | 1/1 real |
| .pixelate |  | image | Efek gambar: Pikselasi: .pixelate [2-100] | user |  |  | tested | 1/1 real |
| .posterize |  | image | Efek gambar: Posterize: .posterize [2-20] | user |  |  | tested | 1/1 real |
| .resize |  | image | Efek gambar: Ubah ukuran: .resize <lebar> [tinggi] | user |  |  | tested | 1/1 real |
| .rotate |  | image | Efek gambar: Putar gambar: .rotate [derajat] | user |  |  | tested | 1/1 real |
| .sepia |  | image | Efek gambar: Efek sepia (foto jadul) | user |  |  | tested | 1/1 real |
| .sharpen |  | image | Efek gambar: Pertajam gambar | user |  |  | tested | 1/1 real |
| .sketch |  | image | Sketch: Turn a photo into a pencil sketch. | user | imageUrl* | APIZ2Z /api/image/sketch | tested | 1/1 mock |
| .square |  | image | Efek gambar: Potong jadi persegi (tengah) | user |  |  | tested | 1/1 real |
| .threshold |  | image | Efek gambar: Hitam-putih tegas (threshold): .threshold [0-255] | user |  |  | tested | 1/1 real |
| .cuaca | cekcuaca | info | Cuaca BMKG: Info cuaca dari BMKG. | user | area | APIZ2Z /api/info/cuaca/v1 | tested | 1/1 mock |
| .cuacav2 |  | info | Cuaca Dunia: Cuaca kota di seluruh dunia. | user | kota*, days | APIZ2Z /api/info/cuaca/v2 | tested | 1/1 mock |
| .gempa | infogempa, cekgempa | info | Info Gempa: Info gempa terbaru dari BMKG. | user | type | APIZ2Z /api/info/gempa | tested | 1/1 mock |
| .gempa2 |  | info | Info Gempa v2: Info gempa terbaru dari BMKG. | user |  | APIZ2Z /api/info/gempa-v2 | tested | 1/1 mock |
| .growagarden |  | info | Stok Grow a Garden: Cek stok terbaru game Grow a Garden (Roblox). | user |  | APIZ2Z /api/info/grow-a-garden | tested | 1/1 mock |
| .growagarden2 |  | info | Stok Grow a Garden v2: Cek stok terbaru game Grow a Garden (Roblox). | user |  | APIZ2Z /api/info/grow-a-garden-v2 | tested | 1/1 mock |
| .harilibur | libur | info | Hari Libur: Jadwal hari libur nasional. | user |  | APIZ2Z /api/info/hari-libur | tested | 1/1 mock |
| .harilibur2 |  | info | Hari Libur v2: Jadwal hari libur nasional. | user |  | APIZ2Z /api/info/hari-libur-v2 | tested | 1/1 mock |
| .infobilibili |  | info | Bilibili Info: Info video Bilibili + URL download. | user | url* | APIZ2Z /api/info/bilibili | tested | 1/1 mock |
| .jadwalbola |  | info | Jadwal-Sepakbola: Jadwal pertandingan sepak bola terbaru. | user |  | APIZ2Z /api/info/jadwalbola | tested | 1/1 mock |
| .jadwalsholat | sholat | info | Jadwal Sholat: Jadwal sholat harian & bulanan seluruh Indonesia. | user | kota, bulan, tahun | APIZ2Z /api/info/jadwal-sholat | tested | 1/1 mock |
| .jadwalsholat2 |  | info | Jadwal Sholat v2: Jadwal sholat harian & bulanan seluruh Indonesia. | user | kota* | APIZ2Z /api/info/jadwal-sholat-v2 | tested | 1/1 mock |
| .jadwaltv |  | info | Jadwal TV: Jadwal TV hari ini. | user |  | APIZ2Z /api/info/jadwaltv | tested | 1/1 mock |
| .jadwaltv2 |  | info | Jadwal TV v2: Jadwal TV hari ini. | user | channel* | APIZ2Z /api/info/jadwaltv-v2 | tested | 1/1 mock |
| .asmaulhusna |  | islamic | 99 Asmaul Husna: .asmaulhusna [nomor \| acak \| semua] | user |  |  | tested | 2/2 unit |
| .ayatkursi |  | islamic | Ayat Kursi: Ayat Kursi lengkap: arab, latin, arti, sama tafsirnya. | user |  | APIZ2Z /api/islamic/ayatkursi | tested | 1/1 mock |
| .bacaansholat |  | islamic | Bacaan Shalat: Bacaan shalat dari iftitah sampai salam: arab, latin, arti. | user |  | APIZ2Z /api/islamic/bacaanshalat | tested | 1/1 mock |
| .doaharian | doa | islamic | Doa Harian: Kumpulan doa sehari-hari: arab, latin, arti. | user |  | APIZ2Z /api/islamic/doaharian | tested | 1/1 mock |
| .kisahnabi |  | islamic | Kisah 25 nabi: .kisahnabi <nama> | user |  |  | implemented |  |
| .kisahnabiapi |  | islamic | Kisah Nabi: Kisah 25 nabi: kelahiran, usia wafat, tempat, dan ceritanya. | user | nabi* | APIZ2Z /api/islamic/kisahnabi | tested | 1/1 mock |
| .listnabi |  | islamic | Daftar 25 nabi dan rasul | user |  |  | tested | 1/1 unit |
| .listsurah | daftarsurah | islamic | Daftar 114 surah Al-Quran | user |  |  | tested | 1/1 unit |
| .murottal | audiosurah, audiosurat | islamic | Audio murottal satu surah (Mishary Rashid Alafasy) | user |  |  | implemented |  |
| .surah | quran | islamic | Surah Al-Qur'an: Ayat-ayat satu surah: arab, latin, arti. Nomor surah 1–114. | user | no* | APIZ2Z /api/islamic/surah | tested | 1/1 mock |
| .surahinfo | infosurah | islamic | Info surah: nama, arti, jumlah ayat, golongan | user |  |  | tested | 2/2 unit |
| .tahlil |  | islamic | Tahlil: Susunan bacaan tahlil lengkap sama artinya. | user |  | APIZ2Z /api/islamic/tahlil | tested | 1/1 mock |
| .wirid |  | islamic | Wirid: Bacaan wirid sesudah shalat lima waktu. | user |  | APIZ2Z /api/islamic/wirid | tested | 1/1 mock |
| .animediff |  | maker | Anime Diffusion: Buat gambar anime dari teks. | user | prompt* | APIZ2Z /api/maker/animediff | tested | 1/1 mock |
| .attp |  | maker | ATTP: Teks animasi warna-warni (GIF), cocok buat stiker. | user | text* | APIZ2Z /api/maker/attp | tested | 1/1 mock |
| .attp2 |  | maker | ATTP v2: Teks animasi warna-warni (GIF), cocok buat stiker. | user | text* | APIZ2Z /api/maker/attp-v2 | tested | 1/1 mock |
| .balogo |  | maker | Balogo: Logo teks gaya Blue Archive. | user | text* | APIZ2Z /api/maker/balogo | tested | 1/1 mock |
| .bananaai |  | maker | Banana Edit: Edit gambar dengan AI (unggah gambar + prompt). | user | url*, prompt* | APIZ2Z /api/maker/bananaai | tested | 1/1 mock |
| .bananagen |  | maker | Banana Generate: Buat gambar dari teks (AI). | user | prompt*, model | APIZ2Z /api/maker/bananagen | tested | 1/1 mock |
| .brat |  | maker | Brat: Generate viral Brat album aesthetic meme text images. | user | text* | APIZ2Z /api/maker/brat | tested | 1/1 mock |
| .brat2 |  | maker | Brat v2: Generate viral Brat album aesthetic meme text images. | user | text* | APIZ2Z /api/maker/brat-v2 | tested | 1/1 mock |
| .bratanime |  | maker | Brat Anime: Gambar teks brat versi anime. | user | text* | APIZ2Z /api/maker/bratanime | tested | 1/1 mock |
| .brathd |  | maker | Brat HD: Gambar teks brat resolusi tinggi. | user | text* | APIZ2Z /api/maker/brathd | tested | 1/1 mock |
| .bratvid | bratvideo | maker | Brat Video: Generate an animated Brat word-by-word video in MP4 or GIF format. | user | text*, format | APIZ2Z /api/maker/bratvid | tested | 1/1 mock |
| .bratvid2 |  | maker | Brat Video v2: Generate an animated Brat word-by-word video in MP4 or GIF format. | user | text* | APIZ2Z /api/maker/bratvid-v2 | tested | 1/1 mock |
| .bratvidhd |  | maker | Bratvid HD: Video teks brat resolusi tinggi. | user | text* | APIZ2Z /api/maker/bratvidhd | tested | 1/1 mock |
| .carbon | carbonify | maker | Carbon (Code to Image): Ubah kode jadi gambar PNG tema gelap. | user | code*, lang | APIZ2Z /api/maker/carbon | tested | 1/1 mock |
| .carbon2 |  | maker | Carbon (Code to Image) v2: Ubah kode jadi gambar PNG tema gelap. | user | code* | APIZ2Z /api/maker/carbon-v2 | tested | 1/1 mock |
| .emojimix |  | maker | Emoji Mix (Emoji Kitchen): Combine two emojis into a custom Google Emoji Kitchen sticker. | user | emoji1*, emoji2* | APIZ2Z /api/maker/emojimix | tested | 1/1 mock |
| .emojitogif |  | maker | Emoji to GIF: Convert a standard emoji into an animated Google Noto GIF / WebP sticker. | user | emoji* | APIZ2Z /api/maker/emojitogif | tested | 1/1 mock |
| .emojitogif2 |  | maker | Emoji to GIF v2: Convert a standard emoji into an animated Google Noto GIF / WebP sticker. | user | emoji* | APIZ2Z /api/maker/emojitogif-v2 | tested | 1/1 mock |
| .fakecall |  | maker | Fake Call: Buat gambar fake call (panggilan WhatsApp) dengan foto, nama, dan jam. | user | name*, time*, photo* | APIZ2Z /api/maker/fakecall | tested | 1/1 mock |
| .iqcpink |  | maker | IQC Pink: Bikin gambar IQC Pink dari teks yang kamu kasih | user | q* | APIZ2Z /api/maker/iqc-pink | tested | 1/1 mock |
| .landsatname |  | maker | Landsat Name: Tulis nama kamu pakai foto satelit Landsat NASA. | user | name*, variant | APIZ2Z /api/maker/landsat-name | tested | 1/1 mock |
| .msg |  | maker | Message: Gambar kotak pesan ala Windows. | user | message*, title, icon | APIZ2Z /api/maker/msg | tested | 1/1 mock |
| .nulis | tulis | maker | Nulis: Teks jadi gambar tulisan tangan di buku tulis. | user | text* | APIZ2Z /api/maker/nulis | tested | 1/1 mock |
| .qc | quotly | maker | Qc: Gambar quote chat: teks, nama, avatar, warna. | user | text*, name*, avatar*, color* | APIZ2Z /api/maker/qc | tested | 1/1 mock |
| .quoted |  | maker | Quoted Chat: Buat gambar "quoted" chat (nama + teks + foto opsional). | user | username*, text*, profile, bg | APIZ2Z /api/maker/quoted | tested | 1/1 mock |
| .remini |  | maker | Remini: Perjelas / HD-kan foto (unggah atau URL). | user | url* | APIZ2Z /api/maker/remini | tested | 1/1 mock |
| .remini2 |  | maker | Remini v2: Perjelas / HD-kan foto (unggah atau URL). | user | url* | APIZ2Z /api/maker/remini-v2 | tested | 1/1 mock |
| .smeme | stickermeme | maker | Smeme: Bikin meme dengan teks atas dan bawah. | user | text_atas*, text_bawah*, background* | APIZ2Z /api/maker/smeme | tested | 1/1 mock |
| .ttp |  | maker | TTP: Teks jadi gambar (PNG), cocok buat stiker. | user | text* | APIZ2Z /api/maker/ttp | tested | 1/1 mock |
| .ttp2 |  | maker | TTP v2: Teks jadi gambar (PNG), cocok buat stiker. | user | text* | APIZ2Z /api/maker/ttp-v2 | tested | 1/1 mock |
| .wasted |  | maker | Wasted: Efek "WASTED" ala GTA di foto kamu. | user | url* | APIZ2Z /api/maker/wasted | tested | 1/1 mock |
| .8d | audio8d | media | Efek audio: Audio 8D (berputar kiri-kanan) (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .bass |  | media | Efek audio: Bass boost (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .blown |  | media | Efek audio: Suara pecah (blown) (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .chipmunk | tupai | media | Efek audio: Suara tupai (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .chorus |  | media | Efek audio: Chorus (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .deep |  | media | Efek audio: Suara berat (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .earrape |  | media | Efek audio: Sangat keras (hati-hati) (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .echo |  | media | Efek audio: Gema (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .fast |  | media | Efek audio: Dipercepat 1.5x (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .flanger |  | media | Efek audio: Flanger (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .nightcore |  | media | Efek audio: Nightcore (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .potongaudio | trimaudio, cut | media | Potong audio: .potongaudio <mulai detik> <durasi detik> | user |  | ffmpeg | tested | 1/1 real |
| .radio |  | media | Efek audio: Efek radio jadul (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .reverseaudio |  | media | Efek audio: Diputar terbalik (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .robot |  | media | Efek audio: Suara robot (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .slow |  | media | Efek audio: Diperlambat 0.75x (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .smooth |  | media | Efek audio: Halus (lowpass) (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .togif |  | media | Ubah video (maks 8 detik) jadi GIF | user |  | ffmpeg | tested | 1/1 real |
| .toimg | topng | media | Ubah stiker jadi gambar PNG | user |  | ffmpeg | tested | 1/1 real |
| .tomp3 | toaudio | media | Ubah video/audio jadi MP3 | user |  | ffmpeg | tested | 1/1 real |
| .tovideo | tomp4 | media | Ubah stiker animasi/GIF jadi video MP4 | user |  | ffmpeg | tested | 1/1 real |
| .tovn | toptt, vn | media | Ubah audio/video jadi voice note | user |  | ffmpeg | tested | 1/1 real |
| .tremolo |  | media | Efek audio: Tremolo (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .vibrato |  | media | Efek audio: Vibrato (reply audio/video) | user |  | ffmpeg | tested | 1/1 real |
| .volumeaudio | setvolume | media | Atur volume audio: .volumeaudio 1.5 (0.1 - 10) | user |  | ffmpeg | tested | 1/1 real |
| .browse |  | movie | LK21 Browse: Daftar film LK21 (terbaru/populer). | user | mode, page | APIZ2Z /api/lk21/browse | tested | 1/1 mock |
| .murotalapi |  | music | Murotal Al-Quran: Audio murotal Al-Quran per surat, bisa pilih qari. | user | qari, surah, rehost | APIZ2Z /api/audio/murotal | tested | 1/1 mock |
| .antara |  | news | Antara News: Berita dari antaranews.com. | user |  | APIZ2Z /api/news/antara | tested | 1/1 mock |
| .antara2 |  | news | Antara News v2: Berita dari antaranews.com. | user |  | APIZ2Z /api/news/antara-v2 | tested | 1/1 mock |
| .cnbc |  | news | CNBC Indonesia: Berita terbaru dari CNBC Indonesia. | user |  | APIZ2Z /api/news/cnbc | tested | 1/1 mock |
| .cnbc2 |  | news | CNBC Indonesia v2: Berita terbaru dari CNBC Indonesia. | user |  | APIZ2Z /api/news/cnbc-v2 | tested | 1/1 mock |
| .cnn | berita | news | CNN Indonesia: Berita dari CNN Indonesia. | user |  | APIZ2Z /api/news/cnn | tested | 1/1 mock |
| .cnn2 |  | news | CNN Indonesia v2: Berita dari CNN Indonesia. | user |  | APIZ2Z /api/news/cnn-v2 | tested | 1/1 mock |
| .detik |  | news | Detik News: Berita terbaru dari detik.com. | user |  | APIZ2Z /api/news/detik | tested | 1/1 mock |
| .ffnews |  | news | Free Fire News: Berita terbaru seputar Free Fire. | user |  | APIZ2Z /api/news/ffnews | tested | 1/1 mock |
| .jkt48 |  | news | JKT48 News: Berita JKT48 terbaru. | user |  | APIZ2Z /api/news/jkt48 | tested | 1/1 mock |
| .kompas |  | news | Kompas: Berita dari kompas.com. | user |  | APIZ2Z /api/news/kompas | tested | 1/1 mock |
| .kompas2 |  | news | Kompas v2: Berita dari kompas.com. | user |  | APIZ2Z /api/news/kompas-v2 | tested | 1/1 mock |
| .liputan6 |  | news | Liputan6: Berita terbaru dari Liputan6. | user |  | APIZ2Z /api/news/liputan6 | tested | 1/1 mock |
| .merdeka |  | news | Merdeka: Berita terkini dari Merdeka. | user |  | APIZ2Z /api/news/merdeka | tested | 1/1 mock |
| .mlbb |  | news | MLBB News: Berita terbaru seputar Mobile Legends. | user |  | APIZ2Z /api/news/mlbb | tested | 1/1 mock |
| .okezone |  | news | Okezone News: Berita terbaru dari okezone.com. | user |  | APIZ2Z /api/news/okezone | tested | 1/1 mock |
| .sindonews |  | news | Sindonews: Berita dari sindonews.com. | user |  | APIZ2Z /api/news/sindonews | tested | 1/1 mock |
| .sindonews2 |  | news | Sindonews v2: Berita dari sindonews.com. | user |  | APIZ2Z /api/news/sindonews-v2 | tested | 1/1 mock |
| .suara |  | news | Suara: Berita dari suara.com. | user |  | APIZ2Z /api/news/suara | tested | 1/1 mock |
| .tribun |  | news | Tribunnews: Berita terbaru dari Tribunnews. | user |  | APIZ2Z /api/news/tribun | tested | 1/1 mock |
| .addlimit |  | owner | Tambah limit user: .addlimit <nomor/@tag> <jumlah> | owner |  |  | implemented |  |
| .addowner | addown | owner | Tambah owner bot (disimpan di database lokal) | owner |  |  | implemented |  |
| .addprem | addpremium | owner | Tambah premium: .addprem <nomor/@tag> <hari> | owner |  |  | implemented |  |
| .autoread |  | owner | Tandai pesan masuk sebagai dibaca otomatis | owner |  |  | implemented |  |
| .autotyping |  | owner | Tampilkan "mengetik..." saat memproses command | owner |  |  | implemented |  |
| .backupdb | backup | owner | Kirim file database lokal bot ke chat pribadi owner | owner/private |  |  | implemented |  |
| .banuser | blacklist | owner | Blokir user dari memakai bot (lokal) | owner |  |  | implemented |  |
| .block |  | owner | Blokir kontak di WhatsApp | owner |  |  | implemented |  |
| .delowner | delown | owner | Hapus owner tambahan | owner |  |  | implemented |  |
| .delprem |  | owner | Cabut premium user | owner |  |  | implemented |  |
| .disablefitur | matikanfitur | owner | Nonaktifkan fitur (disimpan di database) | owner |  |  | implemented |  |
| .enablefitur | nyalakanfitur | owner | Aktifkan lagi fitur | owner |  |  | implemented |  |
| .join | joingc | owner | Bot masuk grup lewat link undangan | owner |  |  | implemented |  |
| .listban |  | owner | Daftar user yang diblokir dari bot | owner |  |  | implemented |  |
| .listgc | listgroup | owner | Daftar grup yang diikuti bot | owner |  |  | implemented |  |
| .listowner | listown | owner | Daftar owner | owner |  |  | implemented |  |
| .listprem |  | owner | Daftar user premium aktif | owner |  |  | implemented |  |
| .public |  | owner | Mode public: bot merespons semua orang | owner |  |  | implemented |  |
| .resetlimitall |  | owner | Reset limit harian semua user ke nilai default | owner |  |  | implemented |  |
| .self |  | owner | Mode self: bot hanya merespons owner | owner |  |  | implemented |  |
| .setbio |  | owner | Ganti bio/status bot | owner |  |  | implemented |  |
| .setbotname |  | owner | Ganti nama profil WhatsApp bot | owner |  |  | implemented |  |
| .setppbot |  | owner | Ganti foto profil bot (reply/kirim gambar) | owner |  |  | implemented |  |
| .setprefix |  | owner | Atur prefix (pisah spasi, 1-3 karakter). Kosong = kembali ke settingsbot.js | owner |  |  | implemented |  |
| .unbanuser | unblacklist | owner | Buka blokir user | owner |  |  | implemented |  |
| .unblock |  | owner | Buka blokir kontak di WhatsApp | owner |  |  | implemented |  |
| .artinama |  | primbon | Arti Nama: Cari arti nama berdasarkan numerologi Jawa. | user | nama* | APIZ2Z /api/primbon/artinama | tested | 1/1 mock |
| .artinama2 |  | primbon | Arti Nama v2: Cari arti nama berdasarkan numerologi Jawa. | user | nama* | APIZ2Z /api/primbon/artinama-v2 | tested | 1/1 mock |
| .cocokpasangan |  | primbon | Kecocokan Pasangan: Cek kecocokan pasangan berdasarkan nama (Neptuni Jawa). | user | nama1*, nama2* | APIZ2Z /api/primbon/cocokpasangan | tested | 1/1 mock |
| .cocokpasangan2 |  | primbon | Kecocokan Pasangan v2: Cek kecocokan pasangan berdasarkan nama (Neptuni Jawa). | user | nama1*, nama2* | APIZ2Z /api/primbon/cocokpasangan-v2 | tested | 1/1 mock |
| .nomorhoki |  | primbon | Nomor Hoki: Cek nomor HP kamu hoki atau nggak. | user | nomor* | APIZ2Z /api/primbon/nomorhoki | tested | 1/1 mock |
| .nomorhoki2 |  | primbon | Nomor Hoki v2: Cek nomor HP kamu hoki atau nggak. | user | nomor* | APIZ2Z /api/primbon/nomorhoki-v2 | tested | 1/1 mock |
| .penyakit |  | primbon | Potensi Penyakit: Cek potensi penyakit dari tanggal lahir. | user | tanggal* | APIZ2Z /api/primbon/penyakit | tested | 1/1 mock |
| .penyakit2 |  | primbon | Potensi Penyakit v2: Cek potensi penyakit dari tanggal lahir. | user | tanggal*, bulan*, tahun* | APIZ2Z /api/primbon/penyakit-v2 | tested | 1/1 mock |
| .ramalanjodohbali |  | primbon | Ramalan Jodoh Bali: Ramalan kecocokan jodoh metode Bali. | user | nama1*, tgl1*, bln1*, thn1*, nama2*, tgl2*, bln2*, thn2* | APIZ2Z /api/primbon/ramalan-jodoh-bali | tested | 1/1 mock |
| .ramalanjodohbali2 |  | primbon | Ramalan Jodoh Bali v2: Ramalan kecocokan jodoh metode Bali. | user | nama1*, tanggal1*, bulan1*, tahun1*, nama2*, tanggal2*, bulan2*, tahun2* | APIZ2Z /api/primbon/ramalan-jodoh-bali-v2 | tested | 1/1 mock |
| .ramaljodoh |  | primbon | Ramal Jodoh: Ramal jodoh berdasarkan nama (Neptuni Jawa). | user | nama1*, nama2* | APIZ2Z /api/primbon/ramaljodoh | tested | 1/1 mock |
| .ramaljodoh2 |  | primbon | Ramal Jodoh v2: Ramal jodoh berdasarkan nama (Neptuni Jawa). | user | nama1*, tanggal1*, bulan1*, tahun1*, nama2*, tanggal2*, bulan2*, tahun2* | APIZ2Z /api/primbon/ramaljodoh-v2 | tested | 1/1 mock |
| .rezekihoki |  | primbon | Rezeki & Hoki: Cek rejeki dan hoki berdasarkan weton lahir. | user | tanggal* | APIZ2Z /api/primbon/rezeki-hoki | tested | 1/1 mock |
| .rezekihoki2 |  | primbon | Rezeki & Hoki v2: Cek rejeki dan hoki berdasarkan weton lahir. | user | tanggal*, bulan*, tahun* | APIZ2Z /api/primbon/rezeki-hoki-v2 | tested | 1/1 mock |
| .sifatusaha |  | primbon | Sifat Usaha: Cek sifat usaha/bisnis berdasarkan tanggal lahir. | user | tanggal* | APIZ2Z /api/primbon/sifat-usaha | tested | 1/1 mock |
| .sifatusaha2 |  | primbon | Sifat Usaha v2: Cek sifat usaha/bisnis berdasarkan tanggal lahir. | user | tanggal*, bulan*, tahun* | APIZ2Z /api/primbon/sifat-usaha-v2 | tested | 1/1 mock |
| .tafsirmimpi | mimpi | primbon | Tafsir Mimpi: Tafsir mimpi dari primbon Jawa. | user | mimpi* | APIZ2Z /api/primbon/tafsir-mimpi | tested | 1/1 mock |
| .zodiac2 |  | primbon | Zodiak v2: Cek zodiak dari tanggal lahir. | user | zodiak* | APIZ2Z /api/primbon/zodiac-v2 | tested | 1/1 mock |
| .zodiak | zodiac | primbon | Zodiak: Cek zodiak dari tanggal lahir. | user | tanggal* | APIZ2Z /api/primbon/zodiac | tested | 1/1 mock |
| .bersihtodo | cleartodo | productivity | Hapus to-do yang sudah selesai | user |  |  | implemented |  |
| .catat | addnote | productivity | Simpan catatan pribadi | user |  |  | implemented |  |
| .catatan | notes, listnote | productivity | Daftar catatan kamu | user |  |  | implemented |  |
| .hapuscatatan | delnote | productivity | Hapus catatan: .hapuscatatan <nomor\|semua> | user |  |  | implemented |  |
| .hapusingat | delreminder | productivity | Hapus pengingat | user |  |  | implemented |  |
| .ingatkan | remind, reminder | productivity | Pengingat: .ingatkan 30m minum obat (s/m/jam/hari, maks 30 hari) | user |  |  | implemented |  |
| .listingat | myreminders | productivity | Daftar pengingat aktif | user |  |  | implemented |  |
| .selesai | donetodo | productivity | Tandai to-do selesai | user |  |  | implemented |  |
| .todo | addtodo | productivity | Tambah to-do | user |  |  | implemented |  |
| .todolist | listtodo | productivity | Daftar to-do | user |  |  | implemented |  |
| .aesthetic |  | random | Gambar aesthetic acak (200 gambar) | user |  | data/random/aesthetic.json | implemented |  |
| .anime |  | random | Anime: Gambar anime acak sesuai kategori (waifu, neko, hug, dan lainnya). | user | type* | APIZ2Z /api/random/anime | tested | 1/1 mock |
| .animequote | quotesanime | random | Anime Quote: Quote anime acak. | user |  | APIZ2Z /api/random/anime-quote | tested | 1/1 mock |
| .anjing |  | random | Random Anjing: Foto anjing. | user |  | APIZ2Z /api/random/anjing | tested | 1/1 mock |
| .ba |  | random | Blue-Archive: Gambar karakter Blue Archive acak. | user |  | APIZ2Z /api/random/ba | tested | 1/1 mock |
| .cerpen |  | random | Random Cerpen: Cerpen (cerita pendek). | user |  | APIZ2Z /api/random/cerpen | tested | 1/1 mock |
| .dadustiker |  | random | Stiker dadu acak 1-6 | user |  |  | implemented |  |
| .dare |  | random | Dare: Tantangan dare acak buat main truth or dare. | user |  | APIZ2Z /api/random/dare | tested | 1/1 mock |
| .fakta | faktaunik | random | Random Fakta: Fakta unik. | user |  | APIZ2Z /api/random/fakta | tested | 1/1 mock |
| .katamotivasi |  | random | Kata Motivasi: Kata motivasi dan inspirasi harian. | user |  | APIZ2Z /api/random/kata-motivasi | tested | 1/1 mock |
| .kucing |  | random | Random Kucing: Gambar kucing. | user |  | APIZ2Z /api/random/kucing | tested | 1/1 mock |
| .meme |  | random | Meme Random: Gambar meme acak. | user |  | APIZ2Z /api/random/meme | tested | 1/1 mock |
| .nasehat |  | random | Random Nasehat: Nasehat bijak. | user |  | APIZ2Z /api/random/nasehat | tested | 1/1 mock |
| .neko |  | random | Random Neko: Gambar neko acak. | user |  | APIZ2Z /api/random/neko | tested | 1/1 mock |
| .philosopherquotes |  | random | Quote Filsuf: Kutipan filsuf acak. | user |  | APIZ2Z /api/random/philosopher-quotes | tested | 1/1 mock |
| .puisi |  | random | Random Puisi: Puisi. | user |  | APIZ2Z /api/random/puisi | tested | 1/1 mock |
| .quotes |  | random | Random Quotes: Quote acak. | user |  | APIZ2Z /api/random/quotes | tested | 1/1 mock |
| .randomanjing |  | random | Foto anjing acak (100 gambar) | user |  | data/random/anjing.json | implemented |  |
| .randomboneka |  | random | Foto boneka acak (100 gambar) | user |  | data/random/boneka.json | implemented |  |
| .randomkucing |  | random | Foto kucing acak (100 gambar) | user |  | data/random/kucing.json | implemented |  |
| .randommobil |  | random | Foto mobil acak (100 gambar) | user |  | data/random/mobil.json | implemented |  |
| .randommotor |  | random | Foto motor acak (100 gambar) | user |  | data/random/montor.json | implemented |  |
| .tokohquotes |  | random | Quote Tokoh: Kutipan bijak tokoh dunia & filsuf. | user | type, count | APIZ2Z /api/random/tokoh-quotes | tested | 1/1 mock |
| .truth |  | random | Truth: Pertanyaan truth acak buat main truth or dare. | user |  | APIZ2Z /api/random/truth | tested | 1/1 mock |
| .waifu |  | random | Random Waifu: Gambar waifu anime acak (aman). | user | count | APIZ2Z /api/random/waifu | tested | 1/1 mock |
| .wallpaperhp |  | random | Wallpaper HP acak (100 gambar) | user |  | data/random/wallhp.json | implemented |  |
| .wallpaperml |  | random | Wallpaper Mobile Legends acak (200 gambar) | user |  | data/random/wallml.json | implemented |  |
| .wallpaperpubg |  | random | Wallpaper PUBG acak (100 gambar) | user |  | data/random/pubg.json | implemented |  |
| .an1 |  | search | AN1 APK Search: Cari APK di AN1.com. | user | q* | APIZ2Z /api/apk/an1 | tested | 1/1 mock |
| .apkmody |  | search | APKMODY Search: Cari aplikasi/game mod di APKMODY. | user | q*, limit | APIZ2Z /api/apk/apkmody | tested | 1/1 mock |
| .apkplaystore |  | search | Play Store Search: Cari aplikasi di Google Play Store. | user | q*, limit | APIZ2Z /api/apk/playstore | tested | 1/1 mock |
| .apkpure |  | search | APKPure Search: Cari aplikasi & game di APKPure. | user | q*, limit | APIZ2Z /api/search/apkpure | tested | 1/1 mock |
| .applemusic |  | search | Apple Music: Cari lagu di Apple Music. | user | q* | APIZ2Z /api/search/applemusic | tested | 1/1 mock |
| .brave |  | search | Web Search (Bing): Cari apa aja di web, hasilnya cepat. | user | q*, count | APIZ2Z /api/search/brave | tested | 1/1 mock |
| .cookpad |  | search | Cookpad Resep: Cari resep masakan di Cookpad Indonesia. | user | q* | APIZ2Z /api/search/cookpad | tested | 1/1 mock |
| .deviantart |  | search | DeviantArt Search: Cari artwork di DeviantArt. | user | q*, limit | APIZ2Z /api/search/deviantart | tested | 1/1 mock |
| .douyinhot |  | search | Douyin Trending: Topik & video yang lagi trending di Douyin. | user |  | APIZ2Z /api/douyin/hot | tested | 1/1 mock |
| .duckduckgo |  | search | DuckDuckGo Search: Mesin pencari web DuckDuckGo. | user | q* | APIZ2Z /api/search/duckduckgo | tested | 1/1 mock |
| .gimage | image | search | Image Search: Cari gambar di internet (safe search nyala). | user | q*, limit, size | APIZ2Z /api/search/image | tested | 1/1 mock |
| .githubsearch |  | search | GitHub Repo Search: Cari repository di GitHub. | user | q*, limit | APIZ2Z /api/search/github | tested | 1/1 mock |
| .google |  | search | Google Search: Cari di web: judul, link, sama cuplikannya. | user | q* | APIZ2Z /api/search/google | tested | 1/1 mock |
| .groupsor |  | search | Groupsor: Cari link grup WhatsApp publik. | user | q* | APIZ2Z /api/search/groupsor | tested | 1/1 mock |
| .gsmarena |  | search | GSMArena Search: Cari info HP di GSMArena. | user | q* | APIZ2Z /api/search/gsmarena | tested | 1/1 mock |
| .happymood |  | search | HappyMood: Cari aplikasi mod di HappyMod. | user | q* | APIZ2Z /api/search/happymood | tested | 1/1 mock |
| .istock |  | search | iStock: Cari foto di iStock. | user | q* | APIZ2Z /api/search/istock | tested | 1/1 mock |
| .kbbi |  | search | KBBI: Cari arti kata di KBBI (Bahasa Indonesia). | user | q* | APIZ2Z /api/search/kbbi | tested | 1/1 mock |
| .lirik | lyrics, lyric | search | Spotify Lyrics: Cari lirik lagu. | user | title* | APIZ2Z /api/search/spotify-lirik | tested | 1/1 mock |
| .mal | myanimelist | search | MyAnimeList Search: Cari anime di MyAnimeList. | user | q* | APIZ2Z /api/search/myanimelist | tested | 1/1 mock |
| .mcpedl |  | search | MCPEDL Detail: Detail addon MCPEDL plus link download-nya. | user | slug* | APIZ2Z /api/detail/mcpedl | tested | 1/1 mock |
| .movie |  | search | Movie Search (Cinesubz): Cari film di Cinesubz. | user | q* | APIZ2Z /api/search/movie | tested | 1/1 mock |
| .myinstant |  | search | Myinstants Search: Cari sound button & soundboard Myinstants. | user | q*, limit | APIZ2Z /api/search/myinstant | tested | 1/1 mock |
| .npm2 |  | search | NPM Search v2: Cari paket di npm. | user | q* | APIZ2Z /api/search/npm-v2 | tested | 1/1 mock |
| .npm3 |  | search | NPM Search v3: Cari paket di npm. | user | q* | APIZ2Z /api/search/npm-v3 | tested | 1/1 mock |
| .npm4 |  | search | NPM Search v4: Cari paket di npm. | user | q* | APIZ2Z /api/search/npm-v4 | tested | 1/1 mock |
| .npmsearch | npm | search | NPM Search: Cari paket di npm. | user | q* | APIZ2Z /api/search/npm | tested | 1/1 mock |
| .pexels |  | search | Pexels Search: Cari foto/video gratis di Pexels. | user | q*, type | APIZ2Z /api/search/pexels | tested | 1/1 mock |
| .pinedrama |  | search | PineDrama Search: Cari drama Korea/China/Asia (PineDrama). | user | q* | APIZ2Z /api/search/pinedrama | tested | 1/1 mock |
| .pinterest | pin | search | Pinterest Search: Cari gambar di Pinterest. | user | q* | APIZ2Z /api/search/pinterest | tested | 1/1 mock |
| .pinterestvideo |  | search | Pinterest Video: Cari video di Pinterest. | user | q* | APIZ2Z /api/search/pinterestvideo | tested | 1/1 mock |
| .pixiv |  | search | Pixiv Search: Cari artwork/ilustrasi di Pixiv (konten aman aja). | user | q*, page, order | APIZ2Z /api/search/pixiv | tested | 1/1 mock |
| .pixivdetail |  | search | Pixiv Detail: Detail artwork Pixiv (gambar, tag, penulis). | user | id* | APIZ2Z /api/pixiv/detail | tested | 1/1 mock |
| .resep |  | search | Resep Masakan: Cari resep masakan: bahan, langkah, dan fotonya. | user | q* | APIZ2Z /api/search/resep | tested | 1/1 mock |
| .resep2 |  | search | Resep Masakan v2: Cari resep masakan: bahan, langkah, dan fotonya. | user | q* | APIZ2Z /api/search/resep-v2 | tested | 1/1 mock |
| .searchbilibili |  | search | Bilibili: Cari video di Bilibili. | user | q* | APIZ2Z /api/search/bilibili | tested | 1/1 mock |
| .searchcapcut |  | search | CapCut: Cari template CapCut. | user | q* | APIZ2Z /api/search/capcut | tested | 1/1 mock |
| .searchdouyin |  | search | Douyin: Cari video di Douyin. | user | q* | APIZ2Z /api/search/douyin | tested | 1/1 mock |
| .searchgithub2 |  | search | GitHub Repo Search v2: Cari repository di GitHub. | user | q* | APIZ2Z /api/search/github-v2 | tested | 1/1 mock |
| .searchiqiyi |  | search | iQIYI Search: Cari drama, anime, dan film di iQIYI. | user | q* | APIZ2Z /api/search/iqiyi | tested | 1/1 mock |
| .searchmcpedl |  | search | MCPEDL Search: Cari map/addon/skin Minecraft PE (MCPEDL) + link unduh. | user | q*, page, detail | APIZ2Z /api/search/mcpedl | tested | 1/1 mock |
| .searchpinterest2 |  | search | Pinterest Search v2: Cari gambar di Pinterest. | user | q* | APIZ2Z /api/search/pinterest-v2 | tested | 1/1 mock |
| .searchsfile |  | search | SFile: Cari file di SFile. | user | q* | APIZ2Z /api/search/sfile | tested | 1/1 mock |
| .searchspotify2 |  | search | Spotify Search v2: Cari lagu di Spotify. | user | q* | APIZ2Z /api/search/spotify-v2 | tested | 1/1 mock |
| .searchtelestick |  | search | Telegram Sticker Search: Search Telegram sticker packs by keyword. | user | q* | APIZ2Z /api/search/telestick | tested | 1/1 mock |
| .searchtiktok2 |  | search | TikTok Search v2: Cari video TikTok. | user | q* | APIZ2Z /api/search/tiktok-v2 | tested | 1/1 mock |
| .searchyoutube2 |  | search | YouTube Search v2: Cari video YouTube. | user | q* | APIZ2Z /api/search/youtube-v2 | tested | 1/1 mock |
| .soundcloud | scsearch | search | SoundCloud Search: Search lagu di SoundCloud. | user | q*, limit | APIZ2Z /api/search/soundcloud | tested | 1/1 mock |
| .soundcloud2 |  | search | SoundCloud Search v2: Search lagu di SoundCloud. | user | q* | APIZ2Z /api/search/soundcloud-v2 | tested | 1/1 mock |
| .spotify | spsearch | search | Spotify Search: Cari lagu di Spotify. | user | q* | APIZ2Z /api/search/spotify | tested | 1/1 mock |
| .spotifylirik2 |  | search | Spotify Lyrics v2: Cari lirik lagu. | user | title* | APIZ2Z /api/search/spotify-lirik-v2 | tested | 1/1 mock |
| .stickerly2 |  | search | Sticker.ly Search v2: Search sticker packs on Sticker.ly by keyword. | user | q* | APIZ2Z /api/search/stickerly-v2 | tested | 1/1 mock |
| .stickersearch | caristicker | search | Sticker.ly Search: Search sticker packs on Sticker.ly by keyword. | user | q* | APIZ2Z /api/search/stickerly | tested | 1/1 mock |
| .tiktokphoto |  | search | TikTok Photo: Cari postingan foto (slide) di TikTok. | user | q* | APIZ2Z /api/search/tiktokphoto | tested | 1/1 mock |
| .tiktoktrend |  | search | TikTok Trending: Video TikTok yang lagi trending di satu negara. | user | id* | APIZ2Z /api/search/tiktoktrend | tested | 1/1 mock |
| .topmyanimelist |  | search | Top Anime MyAnimeList: Top anime dari MyAnimeList (peringkat global). | user |  | APIZ2Z /api/top/myanimelist | tested | 1/1 mock |
| .ttsearch | tiktoksearch | search | TikTok Search: Cari video TikTok. | user | q* | APIZ2Z /api/search/tiktok | tested | 1/1 mock |
| .unsplash |  | search | Wallpaper & Photo Search: Cari wallpaper & foto gratis. | user | q*, count, orientation | APIZ2Z /api/search/unsplash | tested | 1/1 mock |
| .wallcraft |  | search | Wallcraft: Cari wallpaper di Wallcraft. | user | q* | APIZ2Z /api/search/wallcraft | tested | 1/1 mock |
| .wiki | wikipedia | search | Wikipedia Search: Cari artikel Wikipedia. | user | q* | APIZ2Z /api/search/wikipedia | tested | 1/1 mock |
| .wikipedia2 |  | search | Wikipedia Search v2: Cari artikel Wikipedia. | user | q* | APIZ2Z /api/search/wikipedia-v2 | tested | 1/1 mock |
| .x8font |  | search | 8 Font: Cari font di 8font. | user | q*, page | APIZ2Z /api/search/8font | tested | 1/1 mock |
| .yts | ytsearch | search | YouTube Search: Cari video YouTube. | user | q* | APIZ2Z /api/search/youtube | tested | 1/1 mock |
| .ffstalk | stalkff | stalk | Free Fire Stalk: Cek nickname akun Free Fire dari ID. | user | id* | APIZ2Z /api/stalk/freefire | tested | 1/1 mock |
| .genshin |  | stalk | Genshin Stalk: Stalk profil Genshin Impact (UID). | user | uid* | APIZ2Z /api/stalk/genshin | tested | 1/1 mock |
| .genshin2 |  | stalk | Genshin Stalk v2: Stalk profil Genshin Impact (UID). | user | uid* | APIZ2Z /api/stalk/genshin-v2 | tested | 1/1 mock |
| .githubstalk | stalkgithub | stalk | GitHub Stalk: Info profil GitHub publik. | user | username* | APIZ2Z /api/stalk/github | tested | 1/1 mock |
| .igstalk | instagramstalk | stalk | Instagram Stalk: Info profil Instagram publik. | user | username* | APIZ2Z /api/stalk/instagram | tested | 1/1 mock |
| .roblox2 |  | stalk | Roblox Stalk v2: Stalk profil Roblox. | user | user* | APIZ2Z /api/stalk/roblox-v2 | tested | 1/1 mock |
| .robloxstalk | stalkroblox | stalk | Roblox Stalk: Stalk profil Roblox. | user | user* | APIZ2Z /api/stalk/roblox | tested | 1/1 mock |
| .stalkfacebook |  | stalk | Facebook Stalk: Info halaman Facebook publik: nama & jumlah followers. | user | username* | APIZ2Z /api/stalk/facebook | tested | 1/1 mock |
| .stalkgithub2 |  | stalk | GitHub Stalk v2: Info profil GitHub publik. | user | username* | APIZ2Z /api/stalk/github-v2 | tested | 1/1 mock |
| .stalkpinterest |  | stalk | Pinterest: Info profil Pinterest. | user | username* | APIZ2Z /api/stalk/pinterest | tested | 1/1 mock |
| .stalkthreads |  | stalk | Threads: Info profil Threads. | user | username* | APIZ2Z /api/stalk/threads | tested | 1/1 mock |
| .stalktiktok2 |  | stalk | TikTok Stalk v2: Info profil TikTok publik. | user | username* | APIZ2Z /api/stalk/tiktok-v2 | tested | 1/1 mock |
| .stalkyoutube2 |  | stalk | YouTube Stalk v2: Info channel YouTube: subscriber, jumlah video, video terbaru. | user | username* | APIZ2Z /api/stalk/youtube-v2 | tested | 1/1 mock |
| .tiktokposts |  | stalk | TikTok Posts: Daftar video yang diposting akun TikTok. | user | user* | APIZ2Z /api/stalk/tiktok-posts | tested | 1/1 mock |
| .tiktokstalk | ttstalk | stalk | TikTok Stalk: Info profil TikTok publik. | user | username* | APIZ2Z /api/stalk/tiktok | tested | 1/1 mock |
| .twitterstalk |  | stalk | X (Twitter) Stalk: Info profil X (Twitter): nama, bio, followers, avatar. | user | username* | APIZ2Z /api/stalk/twitter | tested | 1/1 mock |
| .ytstalk |  | stalk | YouTube Stalk: Info channel YouTube: subscriber, jumlah video, video terbaru. | user | username* | APIZ2Z /api/stalk/youtube | tested | 1/1 mock |
| .getexif | infostiker | sticker | Lihat metadata pack/author sebuah stiker | user |  | ffmpeg | tested | 1/1 real |
| .sticker | s, stiker, sk | sticker | Buat stiker dari gambar/video/GIF (video maks 8 detik). Opsional: .s pack\|author | user |  | ffmpeg | tested | 1/1 real |
| .take | wm, swm, colong | sticker | Ganti nama pack/author stiker: .take pack\|author | user |  | ffmpeg | tested | 1/1 real |
| .acronym |  | text | Buat singkatan dari huruf awal kata | user | teks* |  | tested | 1/1 unit |
| .alay |  | text | Ubah teks jadi gaya alay | user | teks* |  | tested | 1/1 unit |
| .anagram |  | text | Cek anagram: .anagram kata1\|kata2 | user | teks* |  | tested | 2/2 unit |
| .atbash |  | text | Sandi Atbash (A↔Z) | user | teks* |  | tested | 1/1 unit |
| .base32 |  | text | Encode teks ke Base32 (RFC 4648) | user | teks* |  | tested | 1/1 unit |
| .base64 | enc64 | text | Encode teks ke Base64 | user | teks* |  | tested | 1/1 unit |
| .base64url |  | text | Encode teks ke Base64URL | user | teks* |  | tested | 1/1 unit |
| .binary | tobinary | text | Encode teks ke biner | user | teks* |  | tested | 1/1 unit |
| .caesar |  | text | Sandi Caesar: .caesar 3\|teks | user | teks* |  | tested | 1/1 unit |
| .camelcase |  | text | ubahKeCamelCase | user | teks* |  | tested | 1/1 unit |
| .charcode | unicode | text | Kode Unicode setiap karakter | user | teks* |  | tested | 1/1 unit |
| .constantcase |  | text | UBAH_KE_CONSTANT_CASE | user | teks* |  | tested | 1/1 unit |
| .countchar |  | text | Hitung jumlah karakter | user | teks* |  | tested | 1/1 unit |
| .countword |  | text | Hitung jumlah kata | user | teks* |  | tested | 1/1 unit |
| .debase32 |  | text | Decode Base32 | user | teks* |  | tested | 1/1 unit |
| .debase64 | dec64 | text | Decode Base64 ke teks | user | teks* |  | tested | 1/1 unit |
| .debase64url |  | text | Decode Base64URL | user | teks* |  | tested | 1/1 unit |
| .debinary |  | text | Decode biner ke teks | user | teks* |  | tested | 1/1 unit |
| .dehex |  | text | Decode hex ke teks | user | teks* |  | tested | 1/1 unit |
| .demorse |  | text | Kode Morse ke teks | user | teks* |  | tested | 1/1 unit |
| .devigenere |  | text | Dekripsi Vigenère: .devigenere kunci\|teks | user | teks* |  | tested | 1/1 unit |
| .diffline |  | text | Bandingkan dua teks per baris: teks1 \|\|\| teks2 | user | teks* |  | tested | 1/1 unit |
| .dotcase |  | text | ubah.ke.dot.case | user | teks* |  | tested | 1/1 unit |
| .fancy | font | text | Tampilkan teks dalam semua gaya huruf | user | teks* |  | tested | 1/1 unit |
| .fontbold |  | text | Gaya huruf: Huruf tebal serif | user | teks* |  | tested | 1/1 unit |
| .fontboldfraktur |  | text | Gaya huruf: Gotik tebal | user | teks* |  | tested | 1/1 unit |
| .fontbolditalic |  | text | Gaya huruf: Tebal miring serif | user | teks* |  | tested | 1/1 unit |
| .fontboldscript |  | text | Gaya huruf: Huruf sambung tebal | user | teks* |  | tested | 1/1 unit |
| .fontbubble |  | text | Gaya huruf: Gelembung (lingkaran kosong huruf kecil) | user | teks* |  | tested | 1/1 unit |
| .fontcircled |  | text | Gaya huruf: Huruf dalam lingkaran | user | teks* |  | tested | 1/1 unit |
| .fontdoublestruck |  | text | Gaya huruf: Garis ganda (blackboard) | user | teks* |  | tested | 1/1 unit |
| .fontfraktur |  | text | Gaya huruf: Gotik (fraktur) | user | teks* |  | tested | 1/1 unit |
| .fontfullwidth |  | text | Gaya huruf: Lebar penuh (vaporwave) | user | teks* |  | tested | 1/1 unit |
| .fontitalic |  | text | Gaya huruf: Huruf miring serif | user | teks* |  | tested | 1/1 unit |
| .fontmonospace |  | text | Gaya huruf: Monospace | user | teks* |  | tested | 1/1 unit |
| .fontnegsquared |  | text | Gaya huruf: Kotak hitam | user | teks* |  | tested | 1/1 unit |
| .fontsans |  | text | Gaya huruf: Sans-serif | user | teks* |  | tested | 1/1 unit |
| .fontsansbold |  | text | Gaya huruf: Sans-serif tebal | user | teks* |  | tested | 1/1 unit |
| .fontsansbolditalic |  | text | Gaya huruf: Sans-serif tebal miring | user | teks* |  | tested | 1/1 unit |
| .fontsansitalic |  | text | Gaya huruf: Sans-serif miring | user | teks* |  | tested | 1/1 unit |
| .fontscript |  | text | Gaya huruf: Huruf sambung | user | teks* |  | tested | 1/1 unit |
| .fontsmallcaps |  | text | Gaya huruf: Kapital kecil | user | teks* |  | tested | 1/1 unit |
| .fontsquared |  | text | Gaya huruf: Huruf dalam kotak | user | teks* |  | tested | 1/1 unit |
| .fontstrike |  | text | Gaya huruf: Coret | user | teks* |  | tested | 1/1 unit |
| .fontsubscript |  | text | Gaya huruf: Subskrip | user | teks* |  | tested | 1/1 unit |
| .fontsuperscript |  | text | Gaya huruf: Superskrip | user | teks* |  | tested | 1/1 unit |
| .fontunderline |  | text | Gaya huruf: Garis bawah | user | teks* |  | tested | 1/1 unit |
| .fontupsidedown |  | text | Gaya huruf: Terbalik (upside down) | user | teks* |  | tested | 1/1 unit |
| .fromcharcode |  | text | Angka kode Unicode ke karakter: .fromcharcode 72 105 | user | teks* |  | tested | 1/1 unit |
| .hex | tohex | text | Encode teks ke hex | user | teks* |  | tested | 1/1 unit |
| .htmlescape |  | text | Escape karakter HTML | user | teks* |  | tested | 1/1 unit |
| .htmlunescape |  | text | Unescape entitas HTML | user | teks* |  | tested | 1/1 unit |
| .kebabcase |  | text | ubah-ke-kebab-case | user | teks* |  | tested | 1/1 unit |
| .leet |  | text | 1337 sp34k (leet) | user | teks* |  | tested | 1/1 unit |
| .longestword |  | text | Kata terpanjang dalam teks | user | teks* |  | tested | 1/1 unit |
| .lorem |  | text | Generate teks lorem ipsum: .lorem [jumlah kata] | user |  |  | tested | 1/1 unit |
| .lower | kecil | text | Ubah teks jadi huruf kecil | user | teks* |  | tested | 1/1 unit |
| .mock |  | text | tEkS gAyA mEnGeJeK (selang-seling) | user | teks* |  | tested | 1/1 unit |
| .morse |  | text | Teks ke kode Morse | user | teks* |  | tested | 1/1 unit |
| .nato |  | text | Ejaan alfabet fonetik NATO | user | teks* |  | tested | 1/1 unit |
| .nospace |  | text | Hapus semua spasi | user | teks* |  | tested | 1/1 unit |
| .numberlines |  | text | Beri nomor setiap baris | user | teks* |  | tested | 1/1 unit |
| .octal |  | text | Encode teks ke oktal | user | teks* |  | tested | 1/1 unit |
| .onlyletter |  | text | Ambil hurufnya saja | user | teks* |  | tested | 1/1 unit |
| .onlynumber |  | text | Ambil angkanya saja | user | teks* |  | tested | 1/1 unit |
| .palindrome |  | text | Cek apakah teks palindrom | user | teks* |  | tested | 2/2 unit |
| .pascalcase |  | text | UbahKePascalCase | user | teks* |  | tested | 1/1 unit |
| .piglatin |  | text | Ubah ke Pig Latin (bahasa Inggris) | user | teks* |  | tested | 1/1 unit |
| .readmore |  | text | Teks "Baca selengkapnya" WhatsApp: .readmore depan\|belakang | user | teks* |  | tested | 1/1 unit |
| .readtime |  | text | Perkiraan waktu baca (200 kata/menit) | user | teks* |  | tested | 1/1 unit |
| .removeemoji |  | text | Hapus emoji dari teks | user | teks* |  | tested | 1/1 unit |
| .removenumber |  | text | Hapus angka dari teks | user | teks* |  | tested | 1/1 unit |
| .removepunct |  | text | Hapus tanda baca | user | teks* |  | tested | 1/1 unit |
| .repeat |  | text | Ulangi teks: .repeat 3\|teks | user | teks* |  | tested | 1/1 unit |
| .reverse | balik | text | Balik urutan huruf | user | teks* |  | tested | 1/1 unit |
| .reverseeach |  | text | Balik huruf di setiap kata | user | teks* |  | tested | 1/1 unit |
| .reversewords |  | text | Balik urutan kata | user | teks* |  | tested | 1/1 unit |
| .rot13 |  | text | Sandi ROT13 (encode = decode) | user | teks* |  | tested | 1/1 unit |
| .rot47 |  | text | Sandi ROT47 (ASCII 33-126) | user | teks* |  | tested | 1/1 unit |
| .sentencecase |  | text | Huruf besar di awal setiap kalimat | user | teks* |  | tested | 1/1 unit |
| .shufflelines |  | text | Acak urutan baris | user | teks* |  | tested | 1/1 unit |
| .shufflewords |  | text | Acak urutan kata | user | teks* |  | tested | 1/1 unit |
| .slug |  | text | Buat slug URL dari teks | user | teks* |  | tested | 1/1 unit |
| .snakecase |  | text | ubah_ke_snake_case | user | teks* |  | tested | 1/1 unit |
| .sortlines |  | text | Urutkan baris A-Z | user | teks* |  | tested | 1/1 unit |
| .sortlinesdesc |  | text | Urutkan baris Z-A | user | teks* |  | tested | 1/1 unit |
| .swapcase |  | text | Tukar besar/kecil setiap huruf | user | teks* |  | tested | 1/1 unit |
| .textstat | hitungteks | text | Statistik teks: karakter, kata, kalimat, baris | user | teks* |  | tested | 1/1 unit |
| .titlecase |  | text | Setiap Kata Diawali Huruf Besar | user | teks* |  | tested | 1/1 unit |
| .trimspace |  | text | Rapikan spasi berlebih | user | teks* |  | tested | 1/1 unit |
| .uniquelines |  | text | Hapus baris duplikat | user | teks* |  | tested | 1/1 unit |
| .upper | kapital | text | Ubah teks jadi HURUF BESAR | user | teks* |  | tested | 1/1 unit |
| .urldecode |  | text | URL-decode teks | user | teks* |  | tested | 1/1 unit |
| .urlencode |  | text | URL-encode teks | user | teks* |  | tested | 1/1 unit |
| .vigenere |  | text | Enkripsi Vigenère: .vigenere kunci\|teks | user | teks* |  | tested | 1/1 unit |
| .vowelcount |  | text | Hitung huruf vokal & konsonan | user | teks* |  | tested | 1/1 unit |
| .wordfreq |  | text | Frekuensi kata terbanyak | user | teks* |  | tested | 1/1 unit |
| .wrap |  | text | Bungkus teks per N karakter: .wrap 20\|teks | user | teks* |  | tested | 1/1 unit |
| .zalgo |  | text | T̷e̶k̸s̵ ̶z̴a̷l̵g̸o̶ (glitch) | user | teks* |  | tested | 1/1 unit |
| .avengers |  | textpro | Avengers: Logo teks gaya Avengers (dua teks). | user | text1*, text2* | APIZ2Z /api/textpro/avengers | tested | 1/1 mock |
| .bear |  | textpro | Bear: Efek teks gaya beruang. | user | text* | APIZ2Z /api/textpro/bear | tested | 1/1 mock |
| .blackpink |  | textpro | BlackPink: Efek teks gaya BLACKPINK. | user | text* | APIZ2Z /api/textpro/blackpink | tested | 1/1 mock |
| .cartoongraffiti |  | textpro | Cartoon Graffiti: Efek teks graffiti kartun. | user | text* | APIZ2Z /api/textpro/cartoon-graffiti | tested | 1/1 mock |
| .comic |  | textpro | Comic: Efek teks gaya komik. | user | text* | APIZ2Z /api/textpro/comic | tested | 1/1 mock |
| .devilwings |  | textpro | Devil Wings: Efek teks sayap iblis. | user | text* | APIZ2Z /api/textpro/devil-wings | tested | 1/1 mock |
| .dragonball |  | textpro | Dragon Ball: Efek teks gaya Dragon Ball. | user | text* | APIZ2Z /api/textpro/dragonball | tested | 1/1 mock |
| .foggyglass |  | textpro | Foggy Glass: Tulisan tangan di kaca berembun, ada pilihan latar. | user | text*, background | APIZ2Z /api/textpro/foggy-glass | tested | 1/1 mock |
| .glitch |  | textpro | Glitch: Efek teks glitch digital. | user | text* | APIZ2Z /api/textpro/glitch | tested | 1/1 mock |
| .graffiti |  | textpro | Graffiti v1: Efek teks graffiti dengan dua teks. | user | text1*, text2* | APIZ2Z /api/textpro/graffiti | tested | 1/1 mock |
| .graffiti2 |  | textpro | Graffiti v5: Efek teks graffiti dengan satu teks. | user | text* | APIZ2Z /api/textpro/graffiti-v2 | tested | 1/1 mock |
| .marvel |  | textpro | Marvel: Logo teks gaya Marvel (dua teks), ada pilihan latar. | user | text1*, text2*, background | APIZ2Z /api/textpro/marvel | tested | 1/1 mock |
| .mascot |  | textpro | Mascot: Logo maskot (dua teks) dengan 90+ pilihan gaya. | user | text1*, text2*, style | APIZ2Z /api/textpro/mascot | tested | 1/1 mock |
| .naruto |  | textpro | Naruto: Efek teks gaya Naruto. | user | text* | APIZ2Z /api/textpro/naruto | tested | 1/1 mock |
| .painting |  | textpro | Painting: Efek teks lukisan (dua teks). | user | text1*, text2* | APIZ2Z /api/textpro/painting | tested | 1/1 mock |
| .pavement |  | textpro | Pavement: Efek tulisan di aspal. | user | text* | APIZ2Z /api/textpro/pavement | tested | 1/1 mock |
| .pixelglitch |  | textpro | Pixel Glitch: Efek teks pixel glitch. | user | text* | APIZ2Z /api/textpro/pixel-glitch | tested | 1/1 mock |
| .typography |  | textpro | Typography: Efek teks tipografi. | user | text* | APIZ2Z /api/textpro/typography | tested | 1/1 mock |
| .wetglass |  | textpro | Wet Glass: Efek tulisan di kaca basah. | user | text* | APIZ2Z /api/textpro/wetglass | tested | 1/1 mock |
| .wolfgalaxy |  | textpro | Wolf Galaxy: Logo serigala galaksi (dua teks). | user | text1*, text2* | APIZ2Z /api/textpro/wolf-galaxy | tested | 1/1 mock |
| .writegraffiti |  | textpro | Write Graffiti: Efek tulisan graffiti di tembok. | user | text* | APIZ2Z /api/textpro/write-graffiti | tested | 1/1 mock |
| .alightmotion |  | tools | Alight-Motion: Info project Alight Motion dari link-nya. | user | url* | APIZ2Z /api/tools/alightmotion | tested | 1/1 mock |
| .base642text |  | tools | Base64 to Text: Konversi base64 ke teks. | user | base64* | APIZ2Z /api/tools/base642text | tested | 1/1 mock |
| .binary2text |  | tools | Binary to Text: Konversi binary ke teks. | user | binary* | APIZ2Z /api/tools/binary2text | tested | 1/1 mock |
| .blurface |  | tools | Blur-Face: Blur wajah di foto otomatis. | user | url* | APIZ2Z /api/tools/blurface | tested | 1/1 mock |
| .commentstiktok |  | tools | TikTok Comments: Ambil semua komentar video TikTok, plus balasannya. | user | url*, replies, limit | APIZ2Z /api/comments/tiktok | tested | 1/1 mock |
| .comparephone |  | tools | Compare Phone: Bandingkan spesifikasi dua HP berdampingan. | user | phone1*, phone2* | APIZ2Z /api/tools/compare-phone | tested | 1/1 mock |
| .compress | kompres | tools | Image Compress: Kecilin ukuran gambar JPEG/WebP. | user | url, quality | APIZ2Z /api/tools/compress | tested | 1/1 mock |
| .convert |  | tools | Image Convert: Ubah format gambar (webp/jpeg/png/tiff). | user | url, format | APIZ2Z /api/tools/convert | tested | 1/1 mock |
| .convert2 |  | tools | Image Convert v2: Ubah format gambar (webp/jpeg/png/tiff). | user | url*, format | APIZ2Z /api/tools/convert-v2 | tested | 1/1 mock |
| .countryinfo |  | tools | Country Info: Info lengkap tentang suatu negara. | user | name* | APIZ2Z /api/tools/countryinfo | tested | 1/1 mock |
| .dewatermark | hapuswm, removewm | tools | DeWatermark: Hapus watermark dari gambar. | user | url* | APIZ2Z /api/tools/dewatermark | tested | 1/1 mock |
| .dns |  | tools | DNS Lookup: Cek record DNS sebuah domain. | user | domain*, type | APIZ2Z /api/tools/dns | tested | 1/1 mock |
| .enhance |  | tools | Photo Enhance: Bikin foto lebih cerah, lebih hidup, dan lebih tajam. | user | url, brightness, saturation | APIZ2Z /api/tools/enhance | tested | 1/1 mock |
| .enhancer |  | tools | Enhancer: Perjelas kualitas gambar. | user | url* | APIZ2Z /api/tools/enhancer | tested | 1/1 mock |
| .fontinterceptor |  | tools | Font Detector: Cek font apa aja yang dipakai sebuah website. | user | url* | APIZ2Z /api/tools/font-interceptor | tested | 1/1 mock |
| .githubroast |  | tools | GitHub Roast: Roast profil GitHub pakai AI. | user | user* | APIZ2Z /api/tools/github-roast | tested | 1/1 mock |
| .grammarchecker |  | tools | Grammar Checker: Cek & benerin grammar bahasa Inggris. | user | text* | APIZ2Z /api/tools/grammar-checker | tested | 1/1 mock |
| .grammarchecker2 |  | tools | Grammar Checker v2: Cek & benerin grammar bahasa Inggris. | user | text* | APIZ2Z /api/tools/grammar-checker-v2 | tested | 1/1 mock |
| .iloveimgcrop |  | tools | Image Crop: Potong gambar. | user | url, x, y, width, height | APIZ2Z /api/tools/iloveimg-crop | tested | 1/1 mock |
| .iloveimgrotate |  | tools | Image Rotate: Putar gambar. | user | url*, degrees | APIZ2Z /api/tools/iloveimg-rotate | tested | 1/1 mock |
| .imagetoprompt2 |  | tools | Image to Prompt v2: Ubah gambar jadi prompt AI (Midjourney, DALL-E, Stable Diffusion, Flux). | user | url* | APIZ2Z /api/tools/image-to-prompt-v2 | tested | 1/1 mock |
| .ipinfo | trackip | tools | Track IP: Info lokasi dan jaringan sebuah IP atau domain. | user | target* | APIZ2Z /api/tools/trackip | tested | 1/1 mock |
| .jawa |  | tools | Bahasa Jawa: Terjemahin ke bahasa Jawa (ngoko/krama) atau ubah ke aksara Jawa. | user | text*, mode, from, to, direction | APIZ2Z /api/tools/jawa | tested | 1/1 mock |
| .kodepos |  | tools | Kode Pos: Cari kode pos Indonesia. | user | kota | APIZ2Z /api/tools/kodepos | tested | 1/1 mock |
| .kurs | currency | tools | Currency Converter: Konversi mata uang. | user | amount, from, to | APIZ2Z /api/tools/currency | tested | 1/1 mock |
| .ocr |  | tools | OCR: Baca teks dari gambar (unggah atau URL). | user | url* | APIZ2Z /api/tools/ocr | tested | 1/1 mock |
| .ocr2 |  | tools | OCR v2: Baca teks dari gambar (unggah atau URL). | user | url* | APIZ2Z /api/tools/ocr-v2 | tested | 1/1 mock |
| .qr | qrcode, text2qr | tools | Text to QR: Bikin QR code dari teks atau link. | user | text* | APIZ2Z /api/tools/text2qr | tested | 1/1 mock |
| .removebg | rbg, nobg, hapusbg | tools | Remove Background: Hapus background gambar pakai AI. | user | url* | APIZ2Z /api/tools/removebg | tested | 1/1 mock |
| .removebg2 |  | tools | Remove Background v2: Hapus background gambar pakai AI. | user | url* | APIZ2Z /api/tools/removebg-v2 | tested | 1/1 mock |
| .removevokal |  | tools | Remove Vocal: Pisahin vokal dari musik (audio). | user | url* | APIZ2Z /api/tools/removevokal | tested | 1/1 mock |
| .screenshot2 |  | tools | Website Screenshot v2: Screenshot halaman web (PNG). | user | url*, width, height, device_scale | APIZ2Z /api/tools/screenshot-v2 | tested | 1/1 mock |
| .shortlink | shorturl | tools | Shortlink: Pendekin link panjang. | user | url* | APIZ2Z /api/tools/shortlink | tested | 1/1 mock |
| .skiplink |  | tools | Skip Link: Lewatin link shortener, langsung ke tujuannya. | user | url* | APIZ2Z /api/tools/skiplink | tested | 1/1 mock |
| .ssweb | screenshot | tools | Website Screenshot: Screenshot halaman web (PNG). | user | url*, width, height, device | APIZ2Z /api/tools/screenshot | tested | 1/1 mock |
| .subdomainfinder |  | tools | Subdomain Finder: Cari subdomain publik sebuah domain. | user | domain* | APIZ2Z /api/tools/subdomainfinder | tested | 1/1 mock |
| .text2base64 |  | tools | Text to Base64: Konversi teks ke base64. | user | text* | APIZ2Z /api/tools/text2base64 | tested | 1/1 mock |
| .text2binary |  | tools | Text to Binary: Konversi teks ke binary. | user | text* | APIZ2Z /api/tools/text2binary | tested | 1/1 mock |
| .text2qr2 |  | tools | Text to QR v2: Bikin QR code dari teks atau link. | user | text* | APIZ2Z /api/tools/text2qr-v2 | tested | 1/1 mock |
| .tiktokearnings |  | tools | TikTok Earnings: Perkiraan penghasilan dan statistik akun TikTok. | user | username* | APIZ2Z /api/tools/tiktokearnings | tested | 1/1 mock |
| .tiktokhashtag |  | tools | TikTok Hashtag Analyzer: Analisis hashtag TikTok: top 10, yang terkait, dan yang lagi trending. | user | tag* | APIZ2Z /api/analyze/tiktok-hashtag | tested | 1/1 mock |
| .tiktokhashtag2 |  | tools | TikTok Hashtag Analyzer v2: Analisis hashtag TikTok: top 10, yang terkait, dan yang lagi trending. | user | tag* | APIZ2Z /api/analyze/tiktok-hashtag-v2 | tested | 1/1 mock |
| .tinyurl |  | tools | TinyURL: Pendekin link pakai TinyURL. | user | url* | APIZ2Z /api/tools/tinyurl | tested | 1/1 mock |
| .toolsemojitogif |  | tools | Emoji to GIF: Ubah emoji jadi GIF animasi. | user | emoji* | APIZ2Z /api/tools/emojitogif | tested | 1/1 mock |
| .toolsping |  | tools | Ping: Cek API key/sesi dan sisa kuota harian tanpa memanggil layanan pihak ketiga. | user |  | APIZ2Z /api/tools/ping | tested | 1/1 mock |
| .toolsresize |  | tools | Image Resize: Ubah ukuran gambar, rasionya tetap. | user | url, width, height | APIZ2Z /api/tools/resize | tested | 1/1 mock |
| .toprompt | imagetoprompt | tools | Image to Prompt: Ubah gambar jadi prompt AI (Midjourney, DALL-E, Stable Diffusion, Flux). | user | url*, model, language | APIZ2Z /api/tools/image-to-prompt | tested | 1/1 mock |
| .translate | tr, terjemah | tools | Translate: Terjemahin teks, bahasa asalnya dideteksi otomatis. | user | text*, source, target | APIZ2Z /api/tools/translate | tested | 1/1 mock |
| .translate2 |  | tools | Translate v2: Terjemahin teks, bahasa asalnya dideteksi otomatis. | user | text*, target* | APIZ2Z /api/tools/translate-v2 | tested | 1/1 mock |
| .tts | texttospeech | tools | Text to Speech: Ubah teks jadi suara. | user | text*, voice | APIZ2Z /api/tools/text-to-speech | tested | 1/1 mock |
| .upscale | hd, hdr | tools | Image Upscale: Perbesar gambar 2x atau 4x. | user | url*, factor | APIZ2Z /api/tools/upscale | tested | 1/1 mock |
| .upscale2 |  | tools | Image Upscale v2: Perbesar gambar 2x atau 4x. | user | url* | APIZ2Z /api/tools/upscale-v2 | tested | 1/1 mock |
| .upscale3 |  | tools | Image Upscale v3: Perbesar gambar 2x atau 4x. | user | url*, resolusi* | APIZ2Z /api/tools/upscale-v3 | tested | 1/1 mock |
| .usernamegen |  | tools | Username Generator: Bikin ide username/gamertag. | user | keyword*, mode, theme, word2 | APIZ2Z /api/tools/username-gen | tested | 1/1 mock |
| .usernamegen2 |  | tools | Username Generator v2: Bikin ide username/gamertag. | user | keyword*, mode, theme | APIZ2Z /api/tools/username-gen-v2 | tested | 1/1 mock |
| .vision |  | tools | AI Vision: Analisis gambar pakai AI: deskripsi, baca teks, atau jadi prompt. | user | url*, mode, lang, question | APIZ2Z /api/tools/vision | tested | 1/1 mock |
| .webphishing |  | tools | Web Phishing: Cek apakah sebuah link termasuk situs phishing. | user | url* | APIZ2Z /api/tools/webphishing | tested | 1/1 mock |
| .webtozip |  | tools | Web to ZIP: Download isi website jadi file ZIP. | user | url* | APIZ2Z /api/tools/webtozip | tested | 1/1 mock |
| .whatmusic | whatmusik | tools | Whats-Music: Kenali judul lagu dari link audio. | user | url* | APIZ2Z /api/tools/whatsmusic | tested | 1/1 mock |
| .winratemlbb |  | tools | Hitung Winrate MLBB: Hitung berapa kali menang beruntun buat ngejar target winrate MLBB. | user | total_match*, wr_now*, wr_target* | APIZ2Z /api/tools/winrate-mlbb | tested | 1/1 mock |
| .youtubesummarize2 |  | tools | YouTube Summarize v2: Ringkas isi video YouTube. | user | url* | APIZ2Z /api/tools/youtube-summarize-v2 | tested | 1/1 mock |
| .ytsummarizer | ytsummary | tools | YouTube Summarize: Ringkas isi video YouTube. | user | url* | APIZ2Z /api/tools/youtube-summarize | tested | 1/1 mock |
| .yttranscribe |  | tools | YouTube Transcribe: Ambil transkrip/subtitle video YouTube. | user | url* | APIZ2Z /api/tools/yt-transcribe | tested | 1/1 mock |
| .afk |  | user | Set status AFK; yang menyebut kamu akan diberi tahu | user |  |  | implemented |  |
| .cekprem | premium | user | Cek status premium | user |  |  | implemented |  |
| .claim | daily | user | Klaim bonus harian: +5 limit, +500 saldo, +50 exp (sekali per hari) | user |  |  | tested | 1/1 unit |
| .daftar | register, reg | user | Daftar sebagai user bot: .daftar nama,umur | user |  |  | tested | 2/2 unit |
| .level | mylevel, exp | user | Naik level berdasarkan exp (exp didapat dari claim & game) | user |  |  | implemented |  |
| .limit | ceklimit | user | Sisa limit harian | user |  |  | implemented |  |
| .profile | profil, me, myprofile | user | Profil kamu: limit, premium, level, saldo | user |  |  | implemented |  |
| .unreg |  | user | Hapus data pendaftaran kamu | user |  |  | implemented |  |

## Dikecualikan (disabled) (102)

| Command V15 | Alasan |
|---|---|
| addaksesprem | Penjualan akses aplikasi premium pihak ketiga — di luar cakupan. |
| aiundress | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| amprem | Penjualan akses aplikasi premium pihak ketiga — di luar cakupan. |
| animensfwloli | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| apkprem | Penjualan akses aplikasi premium pihak ketiga — di luar cakupan. |
| batalpremku | Penjualan akses aplikasi premium pihak ketiga — di luar cakupan. |
| bayar_apk | Penjualan akses aplikasi premium pihak ketiga — di luar cakupan. |
| beliapk | Penjualan akses aplikasi premium pihak ketiga — di luar cakupan. |
| bom | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| bugil | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| bugilin | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| buyapkprem | Penjualan akses aplikasi premium pihak ketiga — di luar cakupan. |
| cekgay | Konten vulgar / merendahkan — tidak akan diimplementasikan. |
| cekkontol | Konten vulgar / merendahkan — tidak akan diimplementasikan. |
| cekmemek | Konten vulgar / merendahkan — tidak akan diimplementasikan. |
| culikmember | Mengambil alih / memindahkan anggota grup tanpa izin — tidak akan diimplementasikan. |
| darkjoke | Konten vulgar / merendahkan — tidak akan diimplementasikan. |
| deepnude | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| delaksesprem | Penjualan akses aplikasi premium pihak ketiga — di luar cakupan. |
| fakedana | Pemalsuan bukti transaksi / pesan / akun — tidak akan diimplementasikan. |
| fakeff | Pemalsuan bukti transaksi / pesan / akun — tidak akan diimplementasikan. |
| fakeml | Pemalsuan bukti transaksi / pesan / akun — tidak akan diimplementasikan. |
| fakereply | Pemalsuan bukti transaksi / pesan / akun — tidak akan diimplementasikan. |
| fakestory | Pemalsuan bukti transaksi / pesan / akun — tidak akan diimplementasikan. |
| fitnah | Pemalsuan bukti transaksi / pesan / akun — tidak akan diimplementasikan. |
| gamebom | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| gore | Konten kekerasan ekstrem — tidak akan diimplementasikan. |
| hitamin | Mengubah foto orang nyata secara merendahkan (warna kulit / hewan) — tidak akan diimplementasikan. |
| jawabbom | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| joinallgc | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| jpm | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| jpmexec | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| jpmtesti | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| kirimchat | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| kirimchatvo | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| kudeta | Mengambil alih / memindahkan anggota grup tanpa izin — tidak akan diimplementasikan. |
| listaksesprem | Penjualan akses aplikasi premium pihak ketiga — di luar cakupan. |
| logoporn | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| loli | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| naked | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nglspam | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| nsfw | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwahegao | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwass | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwbdsm | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwblowjob | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwcuckold | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwcum | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfweba | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwero | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwfemdom | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwfoot | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwgangbang | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwgay | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwgifs | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwglasses | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwhentai | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwjahy | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwkasedaiki | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwloli | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwmanga | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwmanstrubation | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwmasturbation | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwneko | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwneko2 | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwopai | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwopaianime | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfworgy | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwpanties | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwpussy | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwtentacles | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwthighs | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwyuri | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nsfwzettai | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nude | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| nyerahbom | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| pornhublogo | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| pushkontak | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| pushkontak_process | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| pushkontak2 | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| putihkan | Mengubah foto orang nyata secara merendahkan (warna kulit / hewan) — tidak akan diimplementasikan. |
| quitbom | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| randomgore | Konten kekerasan ekstrem — tidak akan diimplementasikan. |
| rgore | Konten kekerasan ekstrem — tidak akan diimplementasikan. |
| savekontak | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| savekontak2 | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| sendchat | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| sendchatvo | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| sendmessage | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| sendmessagevo | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| shota | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| sprem | Penjualan akses aplikasi premium pihak ketiga — di luar cakupan. |
| struk | Pemalsuan bukti transaksi / pesan / akun — tidak akan diimplementasikan. |
| swgc_allprocess | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| swgcall | Pengiriman massal / spam / pesan ke nomor sembarang — dinonaktifkan (melanggar ketentuan WhatsApp). |
| telanjang | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| tobabi | Mengubah foto orang nyata secara merendahkan (warna kulit / hewan) — tidak akan diimplementasikan. |
| tohitam | Mengubah foto orang nyata secara merendahkan (warna kulit / hewan) — tidak akan diimplementasikan. |
| tomonyet | Mengubah foto orang nyata secara merendahkan (warna kulit / hewan) — tidak akan diimplementasikan. |
| uncensored | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| unsensored | Konten seksual / eksploitasi — tidak akan diimplementasikan. |
| wormgpt | AI tanpa batasan untuk kegiatan berbahaya — tidak akan diimplementasikan. |

## Backlog V15 (planned) (966)

| Command V15 | Catatan |
|---|---|
| 1917style | Command Yann AI V15 "1917style" — belum diimplementasikan. |
| 1gb | Command Yann AI V15 "1gb" — belum diimplementasikan. |
| 2048 | Command Yann AI V15 "2048" — belum diimplementasikan. |
| 2gb | Command Yann AI V15 "2gb" — belum diimplementasikan. |
| 3gb | Command Yann AI V15 "3gb" — belum diimplementasikan. |
| 4gb | Command Yann AI V15 "4gb" — belum diimplementasikan. |
| 5gb | Command Yann AI V15 "5gb" — belum diimplementasikan. |
| 6gb | Command Yann AI V15 "6gb" — belum diimplementasikan. |
| 7gb | Command Yann AI V15 "7gb" — belum diimplementasikan. |
| abu | Command Yann AI V15 "abu" — belum diimplementasikan. |
| abu-abutua | Command Yann AI V15 "abu-abutua" — belum diimplementasikan. |
| acc | Command Yann AI V15 "acc" — belum diimplementasikan. |
| addbadword | Command Yann AI V15 "addbadword" — belum diimplementasikan. |
| addcase | Command Yann AI V15 "addcase" — belum diimplementasikan. |
| addlimitall | Command Yann AI V15 "addlimitall" — belum diimplementasikan. |
| addlist | Command Yann AI V15 "addlist" — belum diimplementasikan. |
| addmoney | Command Yann AI V15 "addmoney" — belum diimplementasikan. |
| addp | Command Yann AI V15 "addp" — belum diimplementasikan. |
| addplug | Command Yann AI V15 "addplug" — belum diimplementasikan. |
| addplugin | Command Yann AI V15 "addplugin" — belum diimplementasikan. |
| addplugins | Command Yann AI V15 "addplugins" — belum diimplementasikan. |
| addprefix | Command Yann AI V15 "addprefix" — belum diimplementasikan. |
| addpremgc | Command Yann AI V15 "addpremgc" — belum diimplementasikan. |
| addpremgrup | Command Yann AI V15 "addpremgrup" — belum diimplementasikan. |
| addpremiumgc | Command Yann AI V15 "addpremiumgc" — belum diimplementasikan. |
| addres | Command Yann AI V15 "addres" — belum diimplementasikan. |
| addreseller | Command Yann AI V15 "addreseller" — belum diimplementasikan. |
| addreselleram | Command Yann AI V15 "addreselleram" — belum diimplementasikan. |
| addrespon | Command Yann AI V15 "addrespon" — belum diimplementasikan. |
| addsewagc | Command Yann AI V15 "addsewagc" — belum diimplementasikan. |
| advancedglow | Command Yann AI V15 "advancedglow" — belum diimplementasikan. |
| ah-ah-ah | Command Yann AI V15 "ah-ah-ah" — belum diimplementasikan. |
| aiedit | Command Yann AI V15 "aiedit" — belum diimplementasikan. |
| ailabs | Command Yann AI V15 "ailabs" — belum diimplementasikan. |
| aimention | Command Yann AI V15 "aimention" — belum diimplementasikan. |
| airealtime | Command Yann AI V15 "airealtime" — belum diimplementasikan. |
| aitts | Command Yann AI V15 "aitts" — belum diimplementasikan. |
| aivideo | Command Yann AI V15 "aivideo" — belum diimplementasikan. |
| akiyama | Command Yann AI V15 "akiyama" — belum diimplementasikan. |
| amai | Command Yann AI V15 "amai" — belum diimplementasikan. |
| ambilsw | Command Yann AI V15 "ambilsw" — belum diimplementasikan. |
| ana | Command Yann AI V15 "ana" — belum diimplementasikan. |
| anime2d | Command Yann AI V15 "anime2d" — belum diimplementasikan. |
| animeakira | Command Yann AI V15 "animeakira" — belum diimplementasikan. |
| animeasuna | Command Yann AI V15 "animeasuna" — belum diimplementasikan. |
| animeeba | Command Yann AI V15 "animeeba" — belum diimplementasikan. |
| animeemilia | Command Yann AI V15 "animeemilia" — belum diimplementasikan. |
| animegremory | Command Yann AI V15 "animegremory" — belum diimplementasikan. |
| animehinata | Command Yann AI V15 "animehinata" — belum diimplementasikan. |
| animeinfo | Command Yann AI V15 "animeinfo" — belum diimplementasikan. |
| animeisuzu | Command Yann AI V15 "animeisuzu" — belum diimplementasikan. |
| animeitori | Command Yann AI V15 "animeitori" — belum diimplementasikan. |
| animekagura | Command Yann AI V15 "animekagura" — belum diimplementasikan. |
| animekeneki | Command Yann AI V15 "animekeneki" — belum diimplementasikan. |
| animemegumin | Command Yann AI V15 "animemegumin" — belum diimplementasikan. |
| animemiku | Command Yann AI V15 "animemiku" — belum diimplementasikan. |
| animenezuko | Command Yann AI V15 "animenezuko" — belum diimplementasikan. |
| animepokemon | Command Yann AI V15 "animepokemon" — belum diimplementasikan. |
| animequotes | Command Yann AI V15 "animequotes" — belum diimplementasikan. |
| animeshina | Command Yann AI V15 "animeshina" — belum diimplementasikan. |
| animeshinka | Command Yann AI V15 "animeshinka" — belum diimplementasikan. |
| animeshota | Command Yann AI V15 "animeshota" — belum diimplementasikan. |
| animetejina | Command Yann AI V15 "animetejina" — belum diimplementasikan. |
| animetoukachan | Command Yann AI V15 "animetoukachan" — belum diimplementasikan. |
| animeyotsuba | Command Yann AI V15 "animeyotsuba" — belum diimplementasikan. |
| animeyuli | Command Yann AI V15 "animeyuli" — belum diimplementasikan. |
| animeyumeko | Command Yann AI V15 "animeyumeko" — belum diimplementasikan. |
| antibot | Command Yann AI V15 "antibot" — belum diimplementasikan. |
| anubis | Command Yann AI V15 "anubis" — belum diimplementasikan. |
| api | Command Yann AI V15 "api" — belum diimplementasikan. |
| arti-nama | Command Yann AI V15 "arti-nama" — belum diimplementasikan. |
| asuna | Command Yann AI V15 "asuna" — belum diimplementasikan. |
| asupan | Command Yann AI V15 "asupan" — belum diimplementasikan. |
| asupanbocil | Command Yann AI V15 "asupanbocil" — belum diimplementasikan. |
| asupandouyin | Command Yann AI V15 "asupandouyin" — belum diimplementasikan. |
| asupangeayubi | Command Yann AI V15 "asupangeayubi" — belum diimplementasikan. |
| asupangheayubi | Command Yann AI V15 "asupangheayubi" — belum diimplementasikan. |
| asupanhijaber | Command Yann AI V15 "asupanhijaber" — belum diimplementasikan. |
| asupanrikagusriani | Command Yann AI V15 "asupanrikagusriani" — belum diimplementasikan. |
| asupansantuy | Command Yann AI V15 "asupansantuy" — belum diimplementasikan. |
| asupanukhty | Command Yann AI V15 "asupanukhty" — belum diimplementasikan. |
| autoabsen | Command Yann AI V15 "autoabsen" — belum diimplementasikan. |
| autoai | Command Yann AI V15 "autoai" — belum diimplementasikan. |
| autobackup | Command Yann AI V15 "autobackup" — belum diimplementasikan. |
| autocorrect | Command Yann AI V15 "autocorrect" — belum diimplementasikan. |
| autolevel | Command Yann AI V15 "autolevel" — belum diimplementasikan. |
| autolv | Command Yann AI V15 "autolv" — belum diimplementasikan. |
| autoreactsw | Command Yann AI V15 "autoreactsw" — belum diimplementasikan. |
| autosambut | Command Yann AI V15 "autosambut" — belum diimplementasikan. |
| autosholat | Command Yann AI V15 "autosholat" — belum diimplementasikan. |
| ayuzawa | Command Yann AI V15 "ayuzawa" — belum diimplementasikan. |
| banfitur | Command Yann AI V15 "banfitur" — belum diimplementasikan. |
| bank | Command Yann AI V15 "bank" — belum diimplementasikan. |
| batalkantrx | Command Yann AI V15 "batalkantrx" — belum diimplementasikan. |
| batalkostum | Command Yann AI V15 "batalkostum" — belum diimplementasikan. |
| batalpolaroid | Command Yann AI V15 "batalpolaroid" — belum diimplementasikan. |
| bataltrx | Command Yann AI V15 "bataltrx" — belum diimplementasikan. |
| beliprem | Command Yann AI V15 "beliprem" — belum diimplementasikan. |
| belipremium | Command Yann AI V15 "belipremium" — belum diimplementasikan. |
| beritacnbc | Command Yann AI V15 "beritacnbc" — belum diimplementasikan. |
| bintang | Command Yann AI V15 "bintang" — belum diimplementasikan. |
| biru | Command Yann AI V15 "biru" — belum diimplementasikan. |
| birulangit | Command Yann AI V15 "birulangit" — belum diimplementasikan. |
| birulangitcerah | Command Yann AI V15 "birulangitcerah" — belum diimplementasikan. |
| birulaut | Command Yann AI V15 "birulaut" — belum diimplementasikan. |
| birumuda | Command Yann AI V15 "birumuda" — belum diimplementasikan. |
| birumudalangit | Command Yann AI V15 "birumudalangit" — belum diimplementasikan. |
| birutua | Command Yann AI V15 "birutua" — belum diimplementasikan. |
| blackpinklogo | Command Yann AI V15 "blackpinklogo" — belum diimplementasikan. |
| blackpinkstyle | Command Yann AI V15 "blackpinkstyle" — belum diimplementasikan. |
| blockblast | Command Yann AI V15 "blockblast" — belum diimplementasikan. |
| blockgame | Command Yann AI V15 "blockgame" — belum diimplementasikan. |
| blockpuzzle | Command Yann AI V15 "blockpuzzle" — belum diimplementasikan. |
| blok | Command Yann AI V15 "blok" — belum diimplementasikan. |
| blokir | Command Yann AI V15 "blokir" — belum diimplementasikan. |
| boost | Command Yann AI V15 "boost" — belum diimplementasikan. |
| boruto | Command Yann AI V15 "boruto" — belum diimplementasikan. |
| bratbiasa | Command Yann AI V15 "bratbiasa" — belum diimplementasikan. |
| bratbiasahd | Command Yann AI V15 "bratbiasahd" — belum diimplementasikan. |
| bratgambar | Command Yann AI V15 "bratgambar" — belum diimplementasikan. |
| bratgambar3 | Command Yann AI V15 "bratgambar3" — belum diimplementasikan. |
| bratgambarhd | Command Yann AI V15 "bratgambarhd" — belum diimplementasikan. |
| bratgura | Command Yann AI V15 "bratgura" — belum diimplementasikan. |
| bratimg3 | Command Yann AI V15 "bratimg3" — belum diimplementasikan. |
| bratpink | Command Yann AI V15 "bratpink" — belum diimplementasikan. |
| bratt | Command Yann AI V15 "bratt" — belum diimplementasikan. |
| breakout | Command Yann AI V15 "breakout" — belum diimplementasikan. |
| brick | Command Yann AI V15 "brick" — belum diimplementasikan. |
| brickbreaker | Command Yann AI V15 "brickbreaker" — belum diimplementasikan. |
| broadcast | Command Yann AI V15 "broadcast" — belum diimplementasikan. |
| buatkode | Command Yann AI V15 "buatkode" — belum diimplementasikan. |
| buatlagu | Command Yann AI V15 "buatlagu" — belum diimplementasikan. |
| buatstreak | Command Yann AI V15 "buatstreak" — belum diimplementasikan. |
| buatvideo | Command Yann AI V15 "buatvideo" — belum diimplementasikan. |
| buronan | Command Yann AI V15 "buronan" — belum diimplementasikan. |
| buyprem | Command Yann AI V15 "buyprem" — belum diimplementasikan. |
| buypremium | Command Yann AI V15 "buypremium" — belum diimplementasikan. |
| buysewagc | Command Yann AI V15 "buysewagc" — belum diimplementasikan. |
| bzirrt | Command Yann AI V15 "bzirrt" — belum diimplementasikan. |
| cadp | Command Yann AI V15 "cadp" — belum diimplementasikan. |
| capcutdownload | Command Yann AI V15 "capcutdownload" — belum diimplementasikan. |
| cardmusik | Command Yann AI V15 "cardmusik" — belum diimplementasikan. |
| carianime | Command Yann AI V15 "carianime" — belum diimplementasikan. |
| carigrouptele | Command Yann AI V15 "carigrouptele" — belum diimplementasikan. |
| carigroupv2 | Command Yann AI V15 "carigroupv2" — belum diimplementasikan. |
| carigroupv3 | Command Yann AI V15 "carigroupv3" — belum diimplementasikan. |
| carigruptele | Command Yann AI V15 "carigruptele" — belum diimplementasikan. |
| carigrupwa | Command Yann AI V15 "carigrupwa" — belum diimplementasikan. |
| carigrupwav2 | Command Yann AI V15 "carigrupwav2" — belum diimplementasikan. |
| carigrupwav3 | Command Yann AI V15 "carigrupwav3" — belum diimplementasikan. |
| caristickerdown | Command Yann AI V15 "caristickerdown" — belum diimplementasikan. |
| caristiker | Command Yann AI V15 "caristiker" — belum diimplementasikan. |
| caristikerdown | Command Yann AI V15 "caristikerdown" — belum diimplementasikan. |
| caritele | Command Yann AI V15 "caritele" — belum diimplementasikan. |
| cartoonstyle | Command Yann AI V15 "cartoonstyle" — belum diimplementasikan. |
| casino | Command Yann AI V15 "casino" — belum diimplementasikan. |
| catbox | Command Yann AI V15 "catbox" — belum diimplementasikan. |
| cecan | Command Yann AI V15 "cecan" — belum diimplementasikan. |
| cecanchina | Command Yann AI V15 "cecanchina" — belum diimplementasikan. |
| cecanhijaber | Command Yann AI V15 "cecanhijaber" — belum diimplementasikan. |
| cecanindonesia | Command Yann AI V15 "cecanindonesia" — belum diimplementasikan. |
| cecanjapan | Command Yann AI V15 "cecanjapan" — belum diimplementasikan. |
| cecanjeni | Command Yann AI V15 "cecanjeni" — belum diimplementasikan. |
| cecanjiso | Command Yann AI V15 "cecanjiso" — belum diimplementasikan. |
| cecanjustinaxie | Command Yann AI V15 "cecanjustinaxie" — belum diimplementasikan. |
| cecankorea | Command Yann AI V15 "cecankorea" — belum diimplementasikan. |
| cecanmalaysia | Command Yann AI V15 "cecanmalaysia" — belum diimplementasikan. |
| cecannaxie | Command Yann AI V15 "cecannaxie" — belum diimplementasikan. |
| cecanrandom | Command Yann AI V15 "cecanrandom" — belum diimplementasikan. |
| cecanrose | Command Yann AI V15 "cecanrose" — belum diimplementasikan. |
| cecanryujin | Command Yann AI V15 "cecanryujin" — belum diimplementasikan. |
| cecanthailand | Command Yann AI V15 "cecanthailand" — belum diimplementasikan. |
| cecanvietnam | Command Yann AI V15 "cecanvietnam" — belum diimplementasikan. |
| cekaura | Command Yann AI V15 "cekaura" — belum diimplementasikan. |
| cekbeban | Command Yann AI V15 "cekbeban" — belum diimplementasikan. |
| cekfemboy | Command Yann AI V15 "cekfemboy" — belum diimplementasikan. |
| cekff | Command Yann AI V15 "cekff" — belum diimplementasikan. |
| cekidch | Command Yann AI V15 "cekidch" — belum diimplementasikan. |
| cekidgc | Command Yann AI V15 "cekidgc" — belum diimplementasikan. |
| cekjadwal | Command Yann AI V15 "cekjadwal" — belum diimplementasikan. |
| cekjadwalpesan | Command Yann AI V15 "cekjadwalpesan" — belum diimplementasikan. |
| cekjodoh | Command Yann AI V15 "cekjodoh" — belum diimplementasikan. |
| ceklistwarn | Command Yann AI V15 "ceklistwarn" — belum diimplementasikan. |
| cekmasadepan | Command Yann AI V15 "cekmasadepan" — belum diimplementasikan. |
| ceknim | Command Yann AI V15 "ceknim" — belum diimplementasikan. |
| ceknohp | Command Yann AI V15 "ceknohp" — belum diimplementasikan. |
| ceknomor | Command Yann AI V15 "ceknomor" — belum diimplementasikan. |
| cekres | Command Yann AI V15 "cekres" — belum diimplementasikan. |
| ceksewagc | Command Yann AI V15 "ceksewagc" — belum diimplementasikan. |
| ceksider | Command Yann AI V15 "ceksider" — belum diimplementasikan. |
| cekstreak | Command Yann AI V15 "cekstreak" — belum diimplementasikan. |
| cekultah | Command Yann AI V15 "cekultah" — belum diimplementasikan. |
| cfsub | Command Yann AI V15 "cfsub" — belum diimplementasikan. |
| charinfo | Command Yann AI V15 "charinfo" — belum diimplementasikan. |
| chiho | Command Yann AI V15 "chiho" — belum diimplementasikan. |
| chitoge | Command Yann AI V15 "chitoge" — belum diimplementasikan. |
| cinta | Command Yann AI V15 "cinta" — belum diimplementasikan. |
| clearchat | Command Yann AI V15 "clearchat" — belum diimplementasikan. |
| cleardb | Command Yann AI V15 "cleardb" — belum diimplementasikan. |
| clearlist | Command Yann AI V15 "clearlist" — belum diimplementasikan. |
| clearprem | Command Yann AI V15 "clearprem" — belum diimplementasikan. |
| clearreseller | Command Yann AI V15 "clearreseller" — belum diimplementasikan. |
| clearrespon | Command Yann AI V15 "clearrespon" — belum diimplementasikan. |
| clearsesi | Command Yann AI V15 "clearsesi" — belum diimplementasikan. |
| clearsession | Command Yann AI V15 "clearsession" — belum diimplementasikan. |
| closetime | Command Yann AI V15 "closetime" — belum diimplementasikan. |
| clsesi | Command Yann AI V15 "clsesi" — belum diimplementasikan. |
| cnbcnews | Command Yann AI V15 "cnbcnews" — belum diimplementasikan. |
| cocoknama | Command Yann AI V15 "cocoknama" — belum diimplementasikan. |
| cogan | Command Yann AI V15 "cogan" — belum diimplementasikan. |
| cokelat | Command Yann AI V15 "cokelat" — belum diimplementasikan. |
| colorize | Command Yann AI V15 "colorize" — belum diimplementasikan. |
| confes | Command Yann AI V15 "confes" — belum diimplementasikan. |
| configurewings | Command Yann AI V15 "configurewings" — belum diimplementasikan. |
| convertweb | Command Yann AI V15 "convertweb" — belum diimplementasikan. |
| copilotvoice | Command Yann AI V15 "copilotvoice" — belum diimplementasikan. |
| copy | Command Yann AI V15 "copy" — belum diimplementasikan. |
| coverpubg | Command Yann AI V15 "coverpubg" — belum diimplementasikan. |
| createadp | Command Yann AI V15 "createadp" — belum diimplementasikan. |
| creategc | Command Yann AI V15 "creategc" — belum diimplementasikan. |
| creategroup | Command Yann AI V15 "creategroup" — belum diimplementasikan. |
| creategrup | Command Yann AI V15 "creategrup" — belum diimplementasikan. |
| createhtml | Command Yann AI V15 "createhtml" — belum diimplementasikan. |
| createimage | Command Yann AI V15 "createimage" — belum diimplementasikan. |
| createsong | Command Yann AI V15 "createsong" — belum diimplementasikan. |
| createsubdo | Command Yann AI V15 "createsubdo" — belum diimplementasikan. |
| crop | Command Yann AI V15 "crop" — belum diimplementasikan. |
| custom-encrypt | Command Yann AI V15 "custom-encrypt" — belum diimplementasikan. |
| customenc | Command Yann AI V15 "customenc" — belum diimplementasikan. |
| customjsen | Command Yann AI V15 "customjsen" — belum diimplementasikan. |
| cyan | Command Yann AI V15 "cyan" — belum diimplementasikan. |
| daftarbadword | Command Yann AI V15 "daftarbadword" — belum diimplementasikan. |
| dai | Command Yann AI V15 "dai" — belum diimplementasikan. |
| deeppink | Command Yann AI V15 "deeppink" — belum diimplementasikan. |
| deidara | Command Yann AI V15 "deidara" — belum diimplementasikan. |
| delbadword | Command Yann AI V15 "delbadword" — belum diimplementasikan. |
| delcase | Command Yann AI V15 "delcase" — belum diimplementasikan. |
| deletepanel | Command Yann AI V15 "deletepanel" — belum diimplementasikan. |
| deletepremgc | Command Yann AI V15 "deletepremgc" — belum diimplementasikan. |
| deletingtext | Command Yann AI V15 "deletingtext" — belum diimplementasikan. |
| dellimit | Command Yann AI V15 "dellimit" — belum diimplementasikan. |
| dellist | Command Yann AI V15 "dellist" — belum diimplementasikan. |
| delmoney | Command Yann AI V15 "delmoney" — belum diimplementasikan. |
| delpanel | Command Yann AI V15 "delpanel" — belum diimplementasikan. |
| delpay | Command Yann AI V15 "delpay" — belum diimplementasikan. |
| delplugin | Command Yann AI V15 "delplugin" — belum diimplementasikan. |
| delplugins | Command Yann AI V15 "delplugins" — belum diimplementasikan. |
| delprefix | Command Yann AI V15 "delprefix" — belum diimplementasikan. |
| delpremgc | Command Yann AI V15 "delpremgc" — belum diimplementasikan. |
| delpremgrup | Command Yann AI V15 "delpremgrup" — belum diimplementasikan. |
| delreseller | Command Yann AI V15 "delreseller" — belum diimplementasikan. |
| delreselleram | Command Yann AI V15 "delreselleram" — belum diimplementasikan. |
| delrespon | Command Yann AI V15 "delrespon" — belum diimplementasikan. |
| delsewagc | Command Yann AI V15 "delsewagc" — belum diimplementasikan. |
| delsrv | Command Yann AI V15 "delsrv" — belum diimplementasikan. |
| delstikercmd | Command Yann AI V15 "delstikercmd" — belum diimplementasikan. |
| delsubdo | Command Yann AI V15 "delsubdo" — belum diimplementasikan. |
| delsubdomain | Command Yann AI V15 "delsubdomain" — belum diimplementasikan. |
| delultah | Command Yann AI V15 "delultah" — belum diimplementasikan. |
| deluser | Command Yann AI V15 "deluser" — belum diimplementasikan. |
| denia | Command Yann AI V15 "denia" — belum diimplementasikan. |
| denia-run | Command Yann AI V15 "denia-run" — belum diimplementasikan. |
| deniarunner | Command Yann AI V15 "deniarunner" — belum diimplementasikan. |
| developer | Command Yann AI V15 "developer" — belum diimplementasikan. |
| dino | Command Yann AI V15 "dino" — belum diimplementasikan. |
| dinorunner | Command Yann AI V15 "dinorunner" — belum diimplementasikan. |
| donate | Command Yann AI V15 "donate" — belum diimplementasikan. |
| done | Command Yann AI V15 "done" — belum diimplementasikan. |
| doraemon | Command Yann AI V15 "doraemon" — belum diimplementasikan. |
| downloadpin | Command Yann AI V15 "downloadpin" — belum diimplementasikan. |
| downpin | Command Yann AI V15 "downpin" — belum diimplementasikan. |
| dragonfire | Command Yann AI V15 "dragonfire" — belum diimplementasikan. |
| dsd | Command Yann AI V15 "dsd" — belum diimplementasikan. |
| duckai | Command Yann AI V15 "duckai" — belum diimplementasikan. |
| duckaiimage | Command Yann AI V15 "duckaiimage" — belum diimplementasikan. |
| dzikir | Command Yann AI V15 "dzikir" — belum diimplementasikan. |
| editai | Command Yann AI V15 "editai" — belum diimplementasikan. |
| editimg | Command Yann AI V15 "editimg" — belum diimplementasikan. |
| effectclouds | Command Yann AI V15 "effectclouds" — belum diimplementasikan. |
| ehbtw | Command Yann AI V15 "ehbtw" — belum diimplementasikan. |
| emas | Command Yann AI V15 "emas" — belum diimplementasikan. |
| emilia | Command Yann AI V15 "emilia" — belum diimplementasikan. |
| emoji | Command Yann AI V15 "emoji" — belum diimplementasikan. |
| emojigif | Command Yann AI V15 "emojigif" — belum diimplementasikan. |
| emojiwa | Command Yann AI V15 "emojiwa" — belum diimplementasikan. |
| emojix | Command Yann AI V15 "emojix" — belum diimplementasikan. |
| enc-custom | Command Yann AI V15 "enc-custom" — belum diimplementasikan. |
| enc-invis | Command Yann AI V15 "enc-invis" — belum diimplementasikan. |
| enc-invisible | Command Yann AI V15 "enc-invisible" — belum diimplementasikan. |
| enc-siu | Command Yann AI V15 "enc-siu" — belum diimplementasikan. |
| enc-strong | Command Yann AI V15 "enc-strong" — belum diimplementasikan. |
| enc-ultra | Command Yann AI V15 "enc-ultra" — belum diimplementasikan. |
| enccustom | Command Yann AI V15 "enccustom" — belum diimplementasikan. |
| enccustomjs | Command Yann AI V15 "enccustomjs" — belum diimplementasikan. |
| encinvis | Command Yann AI V15 "encinvis" — belum diimplementasikan. |
| encinvisible | Command Yann AI V15 "encinvisible" — belum diimplementasikan. |
| encjsinvis | Command Yann AI V15 "encjsinvis" — belum diimplementasikan. |
| encrypt-custom | Command Yann AI V15 "encrypt-custom" — belum diimplementasikan. |
| encrypt-invis | Command Yann AI V15 "encrypt-invis" — belum diimplementasikan. |
| encrypt-invisible | Command Yann AI V15 "encrypt-invisible" — belum diimplementasikan. |
| encrypt-siu | Command Yann AI V15 "encrypt-siu" — belum diimplementasikan. |
| encrypt-strong | Command Yann AI V15 "encrypt-strong" — belum diimplementasikan. |
| encrypt-ultra | Command Yann AI V15 "encrypt-ultra" — belum diimplementasikan. |
| encryptcustom | Command Yann AI V15 "encryptcustom" — belum diimplementasikan. |
| encryptcustomjs | Command Yann AI V15 "encryptcustomjs" — belum diimplementasikan. |
| encryptinvis | Command Yann AI V15 "encryptinvis" — belum diimplementasikan. |
| encryptinvisible | Command Yann AI V15 "encryptinvisible" — belum diimplementasikan. |
| encryptsiu | Command Yann AI V15 "encryptsiu" — belum diimplementasikan. |
| encryptstrong | Command Yann AI V15 "encryptstrong" — belum diimplementasikan. |
| encryptultra | Command Yann AI V15 "encryptultra" — belum diimplementasikan. |
| encsiu | Command Yann AI V15 "encsiu" — belum diimplementasikan. |
| encsiujs | Command Yann AI V15 "encsiujs" — belum diimplementasikan. |
| encstrong | Command Yann AI V15 "encstrong" — belum diimplementasikan. |
| encstrongjs | Command Yann AI V15 "encstrongjs" — belum diimplementasikan. |
| encultra | Command Yann AI V15 "encultra" — belum diimplementasikan. |
| encultrajs | Command Yann AI V15 "encultrajs" — belum diimplementasikan. |
| eninvisiblejs | Command Yann AI V15 "eninvisiblejs" — belum diimplementasikan. |
| eraser | Command Yann AI V15 "eraser" — belum diimplementasikan. |
| error | Command Yann AI V15 "error" — belum diimplementasikan. |
| erza | Command Yann AI V15 "erza" — belum diimplementasikan. |
| exchange | Command Yann AI V15 "exchange" — belum diimplementasikan. |
| failed | Command Yann AI V15 "failed" — belum diimplementasikan. |
| fakewa | Command Yann AI V15 "fakewa" — belum diimplementasikan. |
| fakewhatsapp | Command Yann AI V15 "fakewhatsapp" — belum diimplementasikan. |
| fakexnxx | Command Yann AI V15 "fakexnxx" — belum diimplementasikan. |
| faktadunia | Command Yann AI V15 "faktadunia" — belum diimplementasikan. |
| flag3dtext | Command Yann AI V15 "flag3dtext" — belum diimplementasikan. |
| flagtext | Command Yann AI V15 "flagtext" — belum diimplementasikan. |
| flappy | Command Yann AI V15 "flappy" — belum diimplementasikan. |
| flappybird | Command Yann AI V15 "flappybird" — belum diimplementasikan. |
| font1 | Command Yann AI V15 "font1" — belum diimplementasikan. |
| font10 | Command Yann AI V15 "font10" — belum diimplementasikan. |
| font2 | Command Yann AI V15 "font2" — belum diimplementasikan. |
| font3 | Command Yann AI V15 "font3" — belum diimplementasikan. |
| font4 | Command Yann AI V15 "font4" — belum diimplementasikan. |
| font5 | Command Yann AI V15 "font5" — belum diimplementasikan. |
| font6 | Command Yann AI V15 "font6" — belum diimplementasikan. |
| font7 | Command Yann AI V15 "font7" — belum diimplementasikan. |
| font8 | Command Yann AI V15 "font8" — belum diimplementasikan. |
| font9 | Command Yann AI V15 "font9" — belum diimplementasikan. |
| freecreate | Command Yann AI V15 "freecreate" — belum diimplementasikan. |
| freestalk | Command Yann AI V15 "freestalk" — belum diimplementasikan. |
| fuchsia | Command Yann AI V15 "fuchsia" — belum diimplementasikan. |
| fwa | Command Yann AI V15 "fwa" — belum diimplementasikan. |
| galaxian | Command Yann AI V15 "galaxian" — belum diimplementasikan. |
| galaxy | Command Yann AI V15 "galaxy" — belum diimplementasikan. |
| galaxystyle | Command Yann AI V15 "galaxystyle" — belum diimplementasikan. |
| galaxywallpaper | Command Yann AI V15 "galaxywallpaper" — belum diimplementasikan. |
| gambartopdf | Command Yann AI V15 "gambartopdf" — belum diimplementasikan. |
| game2048 | Command Yann AI V15 "game2048" — belum diimplementasikan. |
| gamebrick | Command Yann AI V15 "gamebrick" — belum diimplementasikan. |
| gamedino | Command Yann AI V15 "gamedino" — belum diimplementasikan. |
| gameflappy | Command Yann AI V15 "gameflappy" — belum diimplementasikan. |
| gamesnake | Command Yann AI V15 "gamesnake" — belum diimplementasikan. |
| gcsider | Command Yann AI V15 "gcsider" — belum diimplementasikan. |
| generateimage | Command Yann AI V15 "generateimage" — belum diimplementasikan. |
| genvideo | Command Yann AI V15 "genvideo" — belum diimplementasikan. |
| get | Command Yann AI V15 "get" — belum diimplementasikan. |
| getaudio | Command Yann AI V15 "getaudio" — belum diimplementasikan. |
| getcase | Command Yann AI V15 "getcase" — belum diimplementasikan. |
| getidgc | Command Yann AI V15 "getidgc" — belum diimplementasikan. |
| getp | Command Yann AI V15 "getp" — belum diimplementasikan. |
| getpastebin | Command Yann AI V15 "getpastebin" — belum diimplementasikan. |
| getplugin | Command Yann AI V15 "getplugin" — belum diimplementasikan. |
| getplugins | Command Yann AI V15 "getplugins" — belum diimplementasikan. |
| getpp | Command Yann AI V15 "getpp" — belum diimplementasikan. |
| getsc | Command Yann AI V15 "getsc" — belum diimplementasikan. |
| ghibli | Command Yann AI V15 "ghibli" — belum diimplementasikan. |
| gitclone | Command Yann AI V15 "gitclone" — belum diimplementasikan. |
| glitchimg | Command Yann AI V15 "glitchimg" — belum diimplementasikan. |
| glitchtext | Command Yann AI V15 "glitchtext" — belum diimplementasikan. |
| glowingtext | Command Yann AI V15 "glowingtext" — belum diimplementasikan. |
| goldbutton | Command Yann AI V15 "goldbutton" — belum diimplementasikan. |
| goldenrod | Command Yann AI V15 "goldenrod" — belum diimplementasikan. |
| gp | Command Yann AI V15 "gp" — belum diimplementasikan. |
| gpt5plus | Command Yann AI V15 "gpt5plus" — belum diimplementasikan. |
| gptimage | Command Yann AI V15 "gptimage" — belum diimplementasikan. |
| gptimg | Command Yann AI V15 "gptimg" — belum diimplementasikan. |
| gptonline | Command Yann AI V15 "gptonline" — belum diimplementasikan. |
| gradienttext | Command Yann AI V15 "gradienttext" — belum diimplementasikan. |
| grafitti | Command Yann AI V15 "grafitti" — belum diimplementasikan. |
| gremory | Command Yann AI V15 "gremory" — belum diimplementasikan. |
| groupsider | Command Yann AI V15 "groupsider" — belum diimplementasikan. |
| gtmp3 | Command Yann AI V15 "gtmp3" — belum diimplementasikan. |
| hadits | Command Yann AI V15 "hadits" — belum diimplementasikan. |
| hapusbadword | Command Yann AI V15 "hapusbadword" — belum diimplementasikan. |
| hapuskode | Command Yann AI V15 "hapuskode" — belum diimplementasikan. |
| hapusobjek | Command Yann AI V15 "hapusobjek" — belum diimplementasikan. |
| hapussemuareseller | Command Yann AI V15 "hapussemuareseller" — belum diimplementasikan. |
| hapuswatermark | Command Yann AI V15 "hapuswatermark" — belum diimplementasikan. |
| hcr | Command Yann AI V15 "hcr" — belum diimplementasikan. |
| hd2 | Command Yann AI V15 "hd2" — belum diimplementasikan. |
| hdvid | Command Yann AI V15 "hdvid" — belum diimplementasikan. |
| hdvideo | Command Yann AI V15 "hdvideo" — belum diimplementasikan. |
| hestia | Command Yann AI V15 "hestia" — belum diimplementasikan. |
| hidetagpoll | Command Yann AI V15 "hidetagpoll" — belum diimplementasikan. |
| hiitwixtor | Command Yann AI V15 "hiitwixtor" — belum diimplementasikan. |
| hijabpin | Command Yann AI V15 "hijabpin" — belum diimplementasikan. |
| hijau | Command Yann AI V15 "hijau" — belum diimplementasikan. |
| hijaugelap | Command Yann AI V15 "hijaugelap" — belum diimplementasikan. |
| hijaulaut | Command Yann AI V15 "hijaulaut" — belum diimplementasikan. |
| hijaulumut | Command Yann AI V15 "hijaulumut" — belum diimplementasikan. |
| hijautua | Command Yann AI V15 "hijautua" — belum diimplementasikan. |
| hinata | Command Yann AI V15 "hinata" — belum diimplementasikan. |
| hitam | Command Yann AI V15 "hitam" — belum diimplementasikan. |
| hoki | Command Yann AI V15 "hoki" — belum diimplementasikan. |
| horor | Command Yann AI V15 "horor" — belum diimplementasikan. |
| hotpink | Command Yann AI V15 "hotpink" — belum diimplementasikan. |
| idch | Command Yann AI V15 "idch" — belum diimplementasikan. |
| idgc | Command Yann AI V15 "idgc" — belum diimplementasikan. |
| image2video | Command Yann AI V15 "image2video" — belum diimplementasikan. |
| imagetopdf | Command Yann AI V15 "imagetopdf" — belum diimplementasikan. |
| img2pdf | Command Yann AI V15 "img2pdf" — belum diimplementasikan. |
| img2prompt | Command Yann AI V15 "img2prompt" — belum diimplementasikan. |
| img2video | Command Yann AI V15 "img2video" — belum diimplementasikan. |
| imgai | Command Yann AI V15 "imgai" — belum diimplementasikan. |
| imgquotes | Command Yann AI V15 "imgquotes" — belum diimplementasikan. |
| incandescent | Command Yann AI V15 "incandescent" — belum diimplementasikan. |
| infonegara | Command Yann AI V15 "infonegara" — belum diimplementasikan. |
| infosubdo | Command Yann AI V15 "infosubdo" — belum diimplementasikan. |
| infosubdomain | Command Yann AI V15 "infosubdomain" — belum diimplementasikan. |
| infouser | Command Yann AI V15 "infouser" — belum diimplementasikan. |
| infowarn | Command Yann AI V15 "infowarn" — belum diimplementasikan. |
| inori | Command Yann AI V15 "inori" — belum diimplementasikan. |
| installpanel | Command Yann AI V15 "installpanel" — belum diimplementasikan. |
| intro | Command Yann AI V15 "intro" — belum diimplementasikan. |
| invis-encrypt | Command Yann AI V15 "invis-encrypt" — belum diimplementasikan. |
| invisenc | Command Yann AI V15 "invisenc" — belum diimplementasikan. |
| invisible-encrypt | Command Yann AI V15 "invisible-encrypt" — belum diimplementasikan. |
| invisibleenc | Command Yann AI V15 "invisibleenc" — belum diimplementasikan. |
| iphonequoted | Command Yann AI V15 "iphonequoted" — belum diimplementasikan. |
| iphonequoted2 | Command Yann AI V15 "iphonequoted2" — belum diimplementasikan. |
| iqc3 | Command Yann AI V15 "iqc3" — belum diimplementasikan. |
| isidompet | Command Yann AI V15 "isidompet" — belum diimplementasikan. |
| isuzu | Command Yann AI V15 "isuzu" — belum diimplementasikan. |
| itachi | Command Yann AI V15 "itachi" — belum diimplementasikan. |
| itori | Command Yann AI V15 "itori" — belum diimplementasikan. |
| jadidisney | Command Yann AI V15 "jadidisney" — belum diimplementasikan. |
| jadigta | Command Yann AI V15 "jadigta" — belum diimplementasikan. |
| jadipixar | Command Yann AI V15 "jadipixar" — belum diimplementasikan. |
| jadpes | Command Yann AI V15 "jadpes" — belum diimplementasikan. |
| jadwalkirim | Command Yann AI V15 "jadwalkirim" — belum diimplementasikan. |
| jadwalngirimpesan | Command Yann AI V15 "jadwalngirimpesan" — belum diimplementasikan. |
| jadwalpesan | Command Yann AI V15 "jadwalpesan" — belum diimplementasikan. |
| jawab | Command Yann AI V15 "jawab" — belum diimplementasikan. |
| jawabasah | Command Yann AI V15 "jawabasah" — belum diimplementasikan. |
| jawabkuis | Command Yann AI V15 "jawabkuis" — belum diimplementasikan. |
| jawabtebak | Command Yann AI V15 "jawabtebak" — belum diimplementasikan. |
| jawabteka | Command Yann AI V15 "jawabteka" — belum diimplementasikan. |
| jingga | Command Yann AI V15 "jingga" — belum diimplementasikan. |
| jodohbali | Command Yann AI V15 "jodohbali" — belum diimplementasikan. |
| jodohmakanan | Command Yann AI V15 "jodohmakanan" — belum diimplementasikan. |
| joinch | Command Yann AI V15 "joinch" — belum diimplementasikan. |
| joingcall | Command Yann AI V15 "joingcall" — belum diimplementasikan. |
| jscustomenc | Command Yann AI V15 "jscustomenc" — belum diimplementasikan. |
| jsinvisenc | Command Yann AI V15 "jsinvisenc" — belum diimplementasikan. |
| jssiuenc | Command Yann AI V15 "jssiuenc" — belum diimplementasikan. |
| jsstrongenc | Command Yann AI V15 "jsstrongenc" — belum diimplementasikan. |
| jsultraenc | Command Yann AI V15 "jsultraenc" — belum diimplementasikan. |
| jumlahuser | Command Yann AI V15 "jumlahuser" — belum diimplementasikan. |
| kaga | Command Yann AI V15 "kaga" — belum diimplementasikan. |
| kagura | Command Yann AI V15 "kagura" — belum diimplementasikan. |
| kaori | Command Yann AI V15 "kaori" — belum diimplementasikan. |
| kapanreset | Command Yann AI V15 "kapanreset" — belum diimplementasikan. |
| kecocokannama | Command Yann AI V15 "kecocokannama" — belum diimplementasikan. |
| kecocokanpasangan | Command Yann AI V15 "kecocokanpasangan" — belum diimplementasikan. |
| kicksider | Command Yann AI V15 "kicksider" — belum diimplementasikan. |
| kirimch | Command Yann AI V15 "kirimch" — belum diimplementasikan. |
| kontolscan | Command Yann AI V15 "kontolscan" — belum diimplementasikan. |
| kuis | Command Yann AI V15 "kuis" — belum diimplementasikan. |
| kuning | Command Yann AI V15 "kuning" — belum diimplementasikan. |
| kurumi | Command Yann AI V15 "kurumi" — belum diimplementasikan. |
| lbmoney | Command Yann AI V15 "lbmoney" — belum diimplementasikan. |
| leaderboardmoney | Command Yann AI V15 "leaderboardmoney" — belum diimplementasikan. |
| lighteffects | Command Yann AI V15 "lighteffects" — belum diimplementasikan. |
| list | Command Yann AI V15 "list" — belum diimplementasikan. |
| listbadword | Command Yann AI V15 "listbadword" — belum diimplementasikan. |
| listcase | Command Yann AI V15 "listcase" — belum diimplementasikan. |
| listkode | Command Yann AI V15 "listkode" — belum diimplementasikan. |
| listpanel | Command Yann AI V15 "listpanel" — belum diimplementasikan. |
| listpay | Command Yann AI V15 "listpay" — belum diimplementasikan. |
| listplugin | Command Yann AI V15 "listplugin" — belum diimplementasikan. |
| listplugins | Command Yann AI V15 "listplugins" — belum diimplementasikan. |
| listprefix | Command Yann AI V15 "listprefix" — belum diimplementasikan. |
| listreseller | Command Yann AI V15 "listreseller" — belum diimplementasikan. |
| listreselleram | Command Yann AI V15 "listreselleram" — belum diimplementasikan. |
| listrespon | Command Yann AI V15 "listrespon" — belum diimplementasikan. |
| listschedmsg | Command Yann AI V15 "listschedmsg" — belum diimplementasikan. |
| listsewagc | Command Yann AI V15 "listsewagc" — belum diimplementasikan. |
| listsubdo | Command Yann AI V15 "listsubdo" — belum diimplementasikan. |
| listsubdomain | Command Yann AI V15 "listsubdomain" — belum diimplementasikan. |
| listultah | Command Yann AI V15 "listultah" — belum diimplementasikan. |
| listuser | Command Yann AI V15 "listuser" — belum diimplementasikan. |
| listwarning | Command Yann AI V15 "listwarning" — belum diimplementasikan. |
| logicbell | Command Yann AI V15 "logicbell" — belum diimplementasikan. |
| logomaker | Command Yann AI V15 "logomaker" — belum diimplementasikan. |
| lsd | Command Yann AI V15 "lsd" — belum diimplementasikan. |
| luma | Command Yann AI V15 "luma" — belum diimplementasikan. |
| luxurygold | Command Yann AI V15 "luxurygold" — belum diimplementasikan. |
| madara | Command Yann AI V15 "madara" — belum diimplementasikan. |
| magenta | Command Yann AI V15 "magenta" — belum diimplementasikan. |
| magentagelap | Command Yann AI V15 "magentagelap" — belum diimplementasikan. |
| maintenance | Command Yann AI V15 "maintenance" — belum diimplementasikan. |
| makingneon | Command Yann AI V15 "makingneon" — belum diimplementasikan. |
| manusialidi | Command Yann AI V15 "manusialidi" — belum diimplementasikan. |
| mathchallenge | Command Yann AI V15 "mathchallenge" — belum diimplementasikan. |
| mbg | Command Yann AI V15 "mbg" — belum diimplementasikan. |
| megumin | Command Yann AI V15 "megumin" — belum diimplementasikan. |
| memekprimbon | Command Yann AI V15 "memekprimbon" — belum diimplementasikan. |
| memekscan | Command Yann AI V15 "memekscan" — belum diimplementasikan. |
| menu-ai | Command Yann AI V15 "menu-ai" — belum diimplementasikan. |
| menu-anime | Command Yann AI V15 "menu-anime" — belum diimplementasikan. |
| menu-animetheme | Command Yann AI V15 "menu-animetheme" — belum diimplementasikan. |
| menu-asupan | Command Yann AI V15 "menu-asupan" — belum diimplementasikan. |
| menu-cecan | Command Yann AI V15 "menu-cecan" — belum diimplementasikan. |
| menu-download | Command Yann AI V15 "menu-download" — belum diimplementasikan. |
| menu-ehpoto | Command Yann AI V15 "menu-ehpoto" — belum diimplementasikan. |
| menu-enc | Command Yann AI V15 "menu-enc" — belum diimplementasikan. |
| menu-fun | Command Yann AI V15 "menu-fun" — belum diimplementasikan. |
| menu-game | Command Yann AI V15 "menu-game" — belum diimplementasikan. |
| menu-group | Command Yann AI V15 "menu-group" — belum diimplementasikan. |
| menu-islami | Command Yann AI V15 "menu-islami" — belum diimplementasikan. |
| menu-maker | Command Yann AI V15 "menu-maker" — belum diimplementasikan. |
| menu-nsfw | Command Yann AI V15 "menu-nsfw" — belum diimplementasikan. |
| menu-owner | Command Yann AI V15 "menu-owner" — belum diimplementasikan. |
| menu-panel | Command Yann AI V15 "menu-panel" — belum diimplementasikan. |
| menu-potoanime | Command Yann AI V15 "menu-potoanime" — belum diimplementasikan. |
| menu-prem | Command Yann AI V15 "menu-prem" — belum diimplementasikan. |
| menu-primbon | Command Yann AI V15 "menu-primbon" — belum diimplementasikan. |
| menu-random | Command Yann AI V15 "menu-random" — belum diimplementasikan. |
| menu-rpg | Command Yann AI V15 "menu-rpg" — belum diimplementasikan. |
| menu-search | Command Yann AI V15 "menu-search" — belum diimplementasikan. |
| menu-shop | Command Yann AI V15 "menu-shop" — belum diimplementasikan. |
| menu-stickers | Command Yann AI V15 "menu-stickers" — belum diimplementasikan. |
| menu-stk | Command Yann AI V15 "menu-stk" — belum diimplementasikan. |
| menu-store | Command Yann AI V15 "menu-store" — belum diimplementasikan. |
| menu-tools | Command Yann AI V15 "menu-tools" — belum diimplementasikan. |
| merah | Command Yann AI V15 "merah" — belum diimplementasikan. |
| merahgelap | Command Yann AI V15 "merahgelap" — belum diimplementasikan. |
| merahmuda | Command Yann AI V15 "merahmuda" — belum diimplementasikan. |
| merahtua | Command Yann AI V15 "merahtua" — belum diimplementasikan. |
| mikasa | Command Yann AI V15 "mikasa" — belum diimplementasikan. |
| miku | Command Yann AI V15 "miku" — belum diimplementasikan. |
| minato | Command Yann AI V15 "minato" — belum diimplementasikan. |
| mirror | Command Yann AI V15 "mirror" — belum diimplementasikan. |
| mirror2 | Command Yann AI V15 "mirror2" — belum diimplementasikan. |
| mirrorimg | Command Yann AI V15 "mirrorimg" — belum diimplementasikan. |
| mirrorimg2 | Command Yann AI V15 "mirrorimg2" — belum diimplementasikan. |
| mixemoji | Command Yann AI V15 "mixemoji" — belum diimplementasikan. |
| mixing | Command Yann AI V15 "mixing" — belum diimplementasikan. |
| mobil | Command Yann AI V15 "mobil" — belum diimplementasikan. |
| moneylb | Command Yann AI V15 "moneylb" — belum diimplementasikan. |
| multicoloredneon | Command Yann AI V15 "multicoloredneon" — belum diimplementasikan. |
| musikcard | Command Yann AI V15 "musikcard" — belum diimplementasikan. |
| mutegc | Command Yann AI V15 "mutegc" — belum diimplementasikan. |
| mutegc_proses | Command Yann AI V15 "mutegc_proses" — belum diimplementasikan. |
| mypanel | Command Yann AI V15 "mypanel" — belum diimplementasikan. |
| mywarn | Command Yann AI V15 "mywarn" — belum diimplementasikan. |
| namacocok | Command Yann AI V15 "namacocok" — belum diimplementasikan. |
| nasib | Command Yann AI V15 "nasib" — belum diimplementasikan. |
| nasibbatere | Command Yann AI V15 "nasibbatere" — belum diimplementasikan. |
| neko2 | Command Yann AI V15 "neko2" — belum diimplementasikan. |
| neonglitch | Command Yann AI V15 "neonglitch" — belum diimplementasikan. |
| news | Command Yann AI V15 "news" — belum diimplementasikan. |
| nezuko | Command Yann AI V15 "nezuko" — belum diimplementasikan. |
| ngl | Command Yann AI V15 "ngl" — belum diimplementasikan. |
| nglgenerator | Command Yann AI V15 "nglgenerator" — belum diimplementasikan. |
| niatsholat | Command Yann AI V15 "niatsholat" — belum diimplementasikan. |
| nightstars | Command Yann AI V15 "nightstars" — belum diimplementasikan. |
| nohoki | Command Yann AI V15 "nohoki" — belum diimplementasikan. |
| nomerhoki | Command Yann AI V15 "nomerhoki" — belum diimplementasikan. |
| nomorinfo | Command Yann AI V15 "nomorinfo" — belum diimplementasikan. |
| notif | Command Yann AI V15 "notif" — belum diimplementasikan. |
| npmjs | Command Yann AI V15 "npmjs" — belum diimplementasikan. |
| npmstalk | Command Yann AI V15 "npmstalk" — belum diimplementasikan. |
| nyalainstreak | Command Yann AI V15 "nyalainstreak" — belum diimplementasikan. |
| off | Command Yann AI V15 "off" — belum diimplementasikan. |
| on | Command Yann AI V15 "on" — belum diimplementasikan. |
| onepiece | Command Yann AI V15 "onepiece" — belum diimplementasikan. |
| onlygc | Command Yann AI V15 "onlygc" — belum diimplementasikan. |
| onlygrup | Command Yann AI V15 "onlygrup" — belum diimplementasikan. |
| onlyprem | Command Yann AI V15 "onlyprem" — belum diimplementasikan. |
| opentime | Command Yann AI V15 "opentime" — belum diimplementasikan. |
| orange | Command Yann AI V15 "orange" — belum diimplementasikan. |
| oranyemerah | Command Yann AI V15 "oranyemerah" — belum diimplementasikan. |
| oranyetua | Command Yann AI V15 "oranyetua" — belum diimplementasikan. |
| otakudesu | Command Yann AI V15 "otakudesu" — belum diimplementasikan. |
| own | Command Yann AI V15 "own" — belum diimplementasikan. |
| pakustad | Command Yann AI V15 "pakustad" — belum diimplementasikan. |
| papercutstyle | Command Yann AI V15 "papercutstyle" — belum diimplementasikan. |
| pastebin | Command Yann AI V15 "pastebin" — belum diimplementasikan. |
| pay | Command Yann AI V15 "pay" — belum diimplementasikan. |
| payment | Command Yann AI V15 "payment" — belum diimplementasikan. |
| pb | Command Yann AI V15 "pb" — belum diimplementasikan. |
| peachpuff | Command Yann AI V15 "peachpuff" — belum diimplementasikan. |
| perak | Command Yann AI V15 "perak" — belum diimplementasikan. |
| perpanjangsewa | Command Yann AI V15 "perpanjangsewa" — belum diimplementasikan. |
| photoai | Command Yann AI V15 "photoai" — belum diimplementasikan. |
| pig | Command Yann AI V15 "pig" — belum diimplementasikan. |
| pindown | Command Yann AI V15 "pindown" — belum diimplementasikan. |
| pink | Command Yann AI V15 "pink" — belum diimplementasikan. |
| pixhost | Command Yann AI V15 "pixhost" — belum diimplementasikan. |
| planet | Command Yann AI V15 "planet" — belum diimplementasikan. |
| play1 | Command Yann AI V15 "play1" — belum diimplementasikan. |
| playch | Command Yann AI V15 "playch" — belum diimplementasikan. |
| playmusik | Command Yann AI V15 "playmusik" — belum diimplementasikan. |
| playtiktok | Command Yann AI V15 "playtiktok" — belum diimplementasikan. |
| playtiktok2 | Command Yann AI V15 "playtiktok2" — belum diimplementasikan. |
| playv2 | Command Yann AI V15 "playv2" — belum diimplementasikan. |
| playvid | Command Yann AI V15 "playvid" — belum diimplementasikan. |
| playvidyt | Command Yann AI V15 "playvidyt" — belum diimplementasikan. |
| pokemon | Command Yann AI V15 "pokemon" — belum diimplementasikan. |
| polaroid | Command Yann AI V15 "polaroid" — belum diimplementasikan. |
| posterwanted | Command Yann AI V15 "posterwanted" — belum diimplementasikan. |
| prem | Command Yann AI V15 "prem" — belum diimplementasikan. |
| processing | Command Yann AI V15 "processing" — belum diimplementasikan. |
| profesiku | Command Yann AI V15 "profesiku" — belum diimplementasikan. |
| proses | Command Yann AI V15 "proses" — belum diimplementasikan. |
| ptv | Command Yann AI V15 "ptv" — belum diimplementasikan. |
| ptv2 | Command Yann AI V15 "ptv2" — belum diimplementasikan. |
| ptvch | Command Yann AI V15 "ptvch" — belum diimplementasikan. |
| ptvtovid | Command Yann AI V15 "ptvtovid" — belum diimplementasikan. |
| ptvtovideo | Command Yann AI V15 "ptvtovideo" — belum diimplementasikan. |
| putih | Command Yann AI V15 "putih" — belum diimplementasikan. |
| puzzle2048 | Command Yann AI V15 "puzzle2048" — belum diimplementasikan. |
| qanime | Command Yann AI V15 "qanime" — belum diimplementasikan. |
| qc1 | Command Yann AI V15 "qc1" — belum diimplementasikan. |
| qc2 | Command Yann AI V15 "qc2" — belum diimplementasikan. |
| qu | Command Yann AI V15 "qu" — belum diimplementasikan. |
| quax | Command Yann AI V15 "quax" — belum diimplementasikan. |
| quotesimg | Command Yann AI V15 "quotesimg" — belum diimplementasikan. |
| quotesislami | Command Yann AI V15 "quotesislami" — belum diimplementasikan. |
| ramalan | Command Yann AI V15 "ramalan" — belum diimplementasikan. |
| ramalancinta | Command Yann AI V15 "ramalancinta" — belum diimplementasikan. |
| ramalanjodoh | Command Yann AI V15 "ramalanjodoh" — belum diimplementasikan. |
| ramalannasib | Command Yann AI V15 "ramalannasib" — belum diimplementasikan. |
| ramalansuamiistri | Command Yann AI V15 "ramalansuamiistri" — belum diimplementasikan. |
| ramalanzodiak | Command Yann AI V15 "ramalanzodiak" — belum diimplementasikan. |
| randomaesthetic | Command Yann AI V15 "randomaesthetic" — belum diimplementasikan. |
| randomantiwork | Command Yann AI V15 "randomantiwork" — belum diimplementasikan. |
| randomblackpink | Command Yann AI V15 "randomblackpink" — belum diimplementasikan. |
| randomcecan | Command Yann AI V15 "randomcecan" — belum diimplementasikan. |
| randomcogan | Command Yann AI V15 "randomcogan" — belum diimplementasikan. |
| randomcosplay | Command Yann AI V15 "randomcosplay" — belum diimplementasikan. |
| randomdadu | Command Yann AI V15 "randomdadu" — belum diimplementasikan. |
| randomhekel | Command Yann AI V15 "randomhekel" — belum diimplementasikan. |
| randomjustina | Command Yann AI V15 "randomjustina" — belum diimplementasikan. |
| randomkayes | Command Yann AI V15 "randomkayes" — belum diimplementasikan. |
| randomkpop | Command Yann AI V15 "randomkpop" — belum diimplementasikan. |
| randommeme | Command Yann AI V15 "randommeme" — belum diimplementasikan. |
| randommontor | Command Yann AI V15 "randommontor" — belum diimplementasikan. |
| randomnotnot | Command Yann AI V15 "randomnotnot" — belum diimplementasikan. |
| randomppcp | Command Yann AI V15 "randomppcp" — belum diimplementasikan. |
| randomprofil | Command Yann AI V15 "randomprofil" — belum diimplementasikan. |
| randomprofile | Command Yann AI V15 "randomprofile" — belum diimplementasikan. |
| randompubg | Command Yann AI V15 "randompubg" — belum diimplementasikan. |
| randomquotenime | Command Yann AI V15 "randomquotenime" — belum diimplementasikan. |
| randomrose | Command Yann AI V15 "randomrose" — belum diimplementasikan. |
| randomryujin | Command Yann AI V15 "randomryujin" — belum diimplementasikan. |
| randomwaifu | Command Yann AI V15 "randomwaifu" — belum diimplementasikan. |
| randomwallhp | Command Yann AI V15 "randomwallhp" — belum diimplementasikan. |
| randomwallml | Command Yann AI V15 "randomwallml" — belum diimplementasikan. |
| redeem | Command Yann AI V15 "redeem" — belum diimplementasikan. |
| rembg | Command Yann AI V15 "rembg" — belum diimplementasikan. |
| removeobj | Command Yann AI V15 "removeobj" — belum diimplementasikan. |
| removeobject | Command Yann AI V15 "removeobject" — belum diimplementasikan. |
| removewatermark | Command Yann AI V15 "removewatermark" — belum diimplementasikan. |
| renamebot | Command Yann AI V15 "renamebot" — belum diimplementasikan. |
| renew | Command Yann AI V15 "renew" — belum diimplementasikan. |
| renewserver | Command Yann AI V15 "renewserver" — belum diimplementasikan. |
| renewsewa | Command Yann AI V15 "renewsewa" — belum diimplementasikan. |
| renewsewagc | Command Yann AI V15 "renewsewagc" — belum diimplementasikan. |
| report | Command Yann AI V15 "report" — belum diimplementasikan. |
| req | Command Yann AI V15 "req" — belum diimplementasikan. |
| resetdb | Command Yann AI V15 "resetdb" — belum diimplementasikan. |
| resetjadwal | Command Yann AI V15 "resetjadwal" — belum diimplementasikan. |
| resetlist | Command Yann AI V15 "resetlist" — belum diimplementasikan. |
| resetreseller | Command Yann AI V15 "resetreseller" — belum diimplementasikan. |
| resettotalchat | Command Yann AI V15 "resettotalchat" — belum diimplementasikan. |
| resetwarn | Command Yann AI V15 "resetwarn" — belum diimplementasikan. |
| resimg | Command Yann AI V15 "resimg" — belum diimplementasikan. |
| resolusiimage | Command Yann AI V15 "resolusiimage" — belum diimplementasikan. |
| resolusivideo | Command Yann AI V15 "resolusivideo" — belum diimplementasikan. |
| restart | Command Yann AI V15 "restart" — belum diimplementasikan. |
| resvid | Command Yann AI V15 "resvid" — belum diimplementasikan. |
| rmobj | Command Yann AI V15 "rmobj" — belum diimplementasikan. |
| royaltext | Command Yann AI V15 "royaltext" — belum diimplementasikan. |
| rst | Command Yann AI V15 "rst" — belum diimplementasikan. |
| rstdb | Command Yann AI V15 "rstdb" — belum diimplementasikan. |
| rvo | Command Yann AI V15 "rvo" — belum diimplementasikan. |
| rvo2 | Command Yann AI V15 "rvo2" — belum diimplementasikan. |
| sadaudio | Keluarga command V15 sad1..N (cuplikan audio bernomor) — digabung jadi satu fitur dengan parameter nomor. |
| sakura | Command Yann AI V15 "sakura" — belum diimplementasikan. |
| salmon | Command Yann AI V15 "salmon" — belum diimplementasikan. |
| sambutowner | Command Yann AI V15 "sambutowner" — belum diimplementasikan. |
| sandsummer | Command Yann AI V15 "sandsummer" — belum diimplementasikan. |
| sasuke | Command Yann AI V15 "sasuke" — belum diimplementasikan. |
| save | Command Yann AI V15 "save" — belum diimplementasikan. |
| saveplugin | Command Yann AI V15 "saveplugin" — belum diimplementasikan. |
| saveplugins | Command Yann AI V15 "saveplugins" — belum diimplementasikan. |
| saveweb | Command Yann AI V15 "saveweb" — belum diimplementasikan. |
| scankontol | Command Yann AI V15 "scankontol" — belum diimplementasikan. |
| scanmemek | Command Yann AI V15 "scanmemek" — belum diimplementasikan. |
| schedmsg | Command Yann AI V15 "schedmsg" — belum diimplementasikan. |
| schedule | Command Yann AI V15 "schedule" — belum diimplementasikan. |
| schedulesend | Command Yann AI V15 "schedulesend" — belum diimplementasikan. |
| script | Command Yann AI V15 "script" — belum diimplementasikan. |
| sdm | Command Yann AI V15 "sdm" — belum diimplementasikan. |
| searchanime | Command Yann AI V15 "searchanime" — belum diimplementasikan. |
| searchchar | Command Yann AI V15 "searchchar" — belum diimplementasikan. |
| searching | Command Yann AI V15 "searching" — belum diimplementasikan. |
| searchtelegram | Command Yann AI V15 "searchtelegram" — belum diimplementasikan. |
| selengkapnya | Command Yann AI V15 "selengkapnya" — belum diimplementasikan. |
| sendtesti | Command Yann AI V15 "sendtesti" — belum diimplementasikan. |
| separating | Command Yann AI V15 "separating" — belum diimplementasikan. |
| sertifikat | Command Yann AI V15 "sertifikat" — belum diimplementasikan. |
| sertifikat-tolol | Command Yann AI V15 "sertifikat-tolol" — belum diimplementasikan. |
| sertifikattolol | Command Yann AI V15 "sertifikattolol" — belum diimplementasikan. |
| setabsen | Command Yann AI V15 "setabsen" — belum diimplementasikan. |
| setaudiomenu | Command Yann AI V15 "setaudiomenu" — belum diimplementasikan. |
| setbotpp | Command Yann AI V15 "setbotpp" — belum diimplementasikan. |
| setclose | Command Yann AI V15 "setclose" — belum diimplementasikan. |
| setclosetime | Command Yann AI V15 "setclosetime" — belum diimplementasikan. |
| setdaftar | Command Yann AI V15 "setdaftar" — belum diimplementasikan. |
| setdone | Command Yann AI V15 "setdone" — belum diimplementasikan. |
| setimage | Command Yann AI V15 "setimage" — belum diimplementasikan. |
| setimg | Command Yann AI V15 "setimg" — belum diimplementasikan. |
| setintro | Command Yann AI V15 "setintro" — belum diimplementasikan. |
| setlabel | Command Yann AI V15 "setlabel" — belum diimplementasikan. |
| setlimit | Command Yann AI V15 "setlimit" — belum diimplementasikan. |
| setlist | Command Yann AI V15 "setlist" — belum diimplementasikan. |
| setmenu | Command Yann AI V15 "setmenu" — belum diimplementasikan. |
| setmoney | Command Yann AI V15 "setmoney" — belum diimplementasikan. |
| setopen | Command Yann AI V15 "setopen" — belum diimplementasikan. |
| setopentime | Command Yann AI V15 "setopentime" — belum diimplementasikan. |
| setpanel | Command Yann AI V15 "setpanel" — belum diimplementasikan. |
| setpay | Command Yann AI V15 "setpay" — belum diimplementasikan. |
| setppgc | Command Yann AI V15 "setppgc" — belum diimplementasikan. |
| setpppanjang | Command Yann AI V15 "setpppanjang" — belum diimplementasikan. |
| setpppanjangbot | Command Yann AI V15 "setpppanjangbot" — belum diimplementasikan. |
| setproses | Command Yann AI V15 "setproses" — belum diimplementasikan. |
| setregister | Command Yann AI V15 "setregister" — belum diimplementasikan. |
| setrestart | Command Yann AI V15 "setrestart" — belum diimplementasikan. |
| setultah | Command Yann AI V15 "setultah" — belum diimplementasikan. |
| sewa | Command Yann AI V15 "sewa" — belum diimplementasikan. |
| sharkstudio | Command Yann AI V15 "sharkstudio" — belum diimplementasikan. |
| shina | Command Yann AI V15 "shina" — belum diimplementasikan. |
| shinka | Command Yann AI V15 "shinka" — belum diimplementasikan. |
| shizuka | Command Yann AI V15 "shizuka" — belum diimplementasikan. |
| shortlink-dl | Command Yann AI V15 "shortlink-dl" — belum diimplementasikan. |
| shortlink2 | Command Yann AI V15 "shortlink2" — belum diimplementasikan. |
| sider | Command Yann AI V15 "sider" — belum diimplementasikan. |
| sidercek | Command Yann AI V15 "sidercek" — belum diimplementasikan. |
| sidergc | Command Yann AI V15 "sidergc" — belum diimplementasikan. |
| sidergroup | Command Yann AI V15 "sidergroup" — belum diimplementasikan. |
| siderkick | Command Yann AI V15 "siderkick" — belum diimplementasikan. |
| sidompul | Command Yann AI V15 "sidompul" — belum diimplementasikan. |
| silverbutton | Command Yann AI V15 "silverbutton" — belum diimplementasikan. |
| sistemsewa | Command Yann AI V15 "sistemsewa" — belum diimplementasikan. |
| siu-encrypt | Command Yann AI V15 "siu-encrypt" — belum diimplementasikan. |
| siuenc | Command Yann AI V15 "siuenc" — belum diimplementasikan. |
| siujsen | Command Yann AI V15 "siujsen" — belum diimplementasikan. |
| sjp | Command Yann AI V15 "sjp" — belum diimplementasikan. |
| sjps | Command Yann AI V15 "sjps" — belum diimplementasikan. |
| sketsa | Command Yann AI V15 "sketsa" — belum diimplementasikan. |
| sketsa2 | Command Yann AI V15 "sketsa2" — belum diimplementasikan. |
| snake | Command Yann AI V15 "snake" — belum diimplementasikan. |
| snakename | Command Yann AI V15 "snakename" — belum diimplementasikan. |
| sora | Command Yann AI V15 "sora" — belum diimplementasikan. |
| soraai | Command Yann AI V15 "soraai" — belum diimplementasikan. |
| soundaudio | Keluarga command V15 sound1..N (cuplikan audio bernomor) — digabung jadi satu fitur dengan parameter nomor. |
| sp | Command Yann AI V15 "sp" — belum diimplementasikan. |
| space | Command Yann AI V15 "space" — belum diimplementasikan. |
| spaceinvaders | Command Yann AI V15 "spaceinvaders" — belum diimplementasikan. |
| spaceshooter | Command Yann AI V15 "spaceshooter" — belum diimplementasikan. |
| spdown | Command Yann AI V15 "spdown" — belum diimplementasikan. |
| spoiler | Command Yann AI V15 "spoiler" — belum diimplementasikan. |
| ssp | Command Yann AI V15 "ssp" — belum diimplementasikan. |
| stack | Command Yann AI V15 "stack" — belum diimplementasikan. |
| stackgame | Command Yann AI V15 "stackgame" — belum diimplementasikan. |
| stacktower | Command Yann AI V15 "stacktower" — belum diimplementasikan. |
| stalktiktok | Command Yann AI V15 "stalktiktok" — belum diimplementasikan. |
| starting | Command Yann AI V15 "starting" — belum diimplementasikan. |
| startwings | Command Yann AI V15 "startwings" — belum diimplementasikan. |
| stele | Command Yann AI V15 "stele" — belum diimplementasikan. |
| stickertele | Command Yann AI V15 "stickertele" — belum diimplementasikan. |
| stickerwa | Command Yann AI V15 "stickerwa" — belum diimplementasikan. |
| stikeranime | Command Yann AI V15 "stikeranime" — belum diimplementasikan. |
| stikercmd | Command Yann AI V15 "stikercmd" — belum diimplementasikan. |
| stikerdinokuning | Command Yann AI V15 "stikerdinokuning" — belum diimplementasikan. |
| stikergojo | Command Yann AI V15 "stikergojo" — belum diimplementasikan. |
| stikermeme | Command Yann AI V15 "stikermeme" — belum diimplementasikan. |
| stikermukalu | Command Yann AI V15 "stikermukalu" — belum diimplementasikan. |
| stikerpentol | Command Yann AI V15 "stikerpentol" — belum diimplementasikan. |
| stikerrandom | Command Yann AI V15 "stikerrandom" — belum diimplementasikan. |
| stikerspongebob | Command Yann AI V15 "stikerspongebob" — belum diimplementasikan. |
| stkbaik | Command Yann AI V15 "stkbaik" — belum diimplementasikan. |
| stkcantik | Command Yann AI V15 "stkcantik" — belum diimplementasikan. |
| stkganteng | Command Yann AI V15 "stkganteng" — belum diimplementasikan. |
| stkgila | Command Yann AI V15 "stkgila" — belum diimplementasikan. |
| stkhitam | Command Yann AI V15 "stkhitam" — belum diimplementasikan. |
| stkkaya | Command Yann AI V15 "stkkaya" — belum diimplementasikan. |
| stkkeren | Command Yann AI V15 "stkkeren" — belum diimplementasikan. |
| stklucu | Command Yann AI V15 "stklucu" — belum diimplementasikan. |
| stkmarah | Command Yann AI V15 "stkmarah" — belum diimplementasikan. |
| stkmiskin | Command Yann AI V15 "stkmiskin" — belum diimplementasikan. |
| stkmisterius | Command Yann AI V15 "stkmisterius" — belum diimplementasikan. |
| stksabar | Command Yann AI V15 "stksabar" — belum diimplementasikan. |
| stksakiti | Command Yann AI V15 "stksakiti" — belum diimplementasikan. |
| stksantai | Command Yann AI V15 "stksantai" — belum diimplementasikan. |
| stksombong | Command Yann AI V15 "stksombong" — belum diimplementasikan. |
| stopallschedmsg | Command Yann AI V15 "stopallschedmsg" — belum diimplementasikan. |
| stopjadpes | Command Yann AI V15 "stopjadpes" — belum diimplementasikan. |
| stopjadwalpesan | Command Yann AI V15 "stopjadwalpesan" — belum diimplementasikan. |
| stopjadwalpesanall | Command Yann AI V15 "stopjadwalpesanall" — belum diimplementasikan. |
| stopjadwalpesansemua | Command Yann AI V15 "stopjadwalpesansemua" — belum diimplementasikan. |
| stopschedmsg | Command Yann AI V15 "stopschedmsg" — belum diimplementasikan. |
| storyhd | Command Yann AI V15 "storyhd" — belum diimplementasikan. |
| streak | Command Yann AI V15 "streak" — belum diimplementasikan. |
| strong-encrypt | Command Yann AI V15 "strong-encrypt" — belum diimplementasikan. |
| strongenc | Command Yann AI V15 "strongenc" — belum diimplementasikan. |
| strongjsen | Command Yann AI V15 "strongjsen" — belum diimplementasikan. |
| suamiistri | Command Yann AI V15 "suamiistri" — belum diimplementasikan. |
| subdo | Command Yann AI V15 "subdo" — belum diimplementasikan. |
| success | Command Yann AI V15 "success" — belum diimplementasikan. |
| summerbeach | Command Yann AI V15 "summerbeach" — belum diimplementasikan. |
| sunlight | Command Yann AI V15 "sunlight" — belum diimplementasikan. |
| svp | Command Yann AI V15 "svp" — belum diimplementasikan. |
| swgc | Command Yann AI V15 "swgc" — belum diimplementasikan. |
| swgc_process | Command Yann AI V15 "swgc_process" — belum diimplementasikan. |
| swhd | Command Yann AI V15 "swhd" — belum diimplementasikan. |
| sync | Command Yann AI V15 "sync" — belum diimplementasikan. |
| syncsubdo | Command Yann AI V15 "syncsubdo" — belum diimplementasikan. |
| tambahbadword | Command Yann AI V15 "tambahbadword" — belum diimplementasikan. |
| tan | Command Yann AI V15 "tan" — belum diimplementasikan. |
| teal | Command Yann AI V15 "teal" — belum diimplementasikan. |
| tebakff | Command Yann AI V15 "tebakff" — belum diimplementasikan. |
| tebakkah | Command Yann AI V15 "tebakkah" — belum diimplementasikan. |
| telesticker | Command Yann AI V15 "telesticker" — belum diimplementasikan. |
| tembak | Command Yann AI V15 "tembak" — belum diimplementasikan. |
| tempo | Command Yann AI V15 "tempo" — belum diimplementasikan. |
| terimajadian | Command Yann AI V15 "terimajadian" — belum diimplementasikan. |
| testi | Command Yann AI V15 "testi" — belum diimplementasikan. |
| testimoni | Command Yann AI V15 "testimoni" — belum diimplementasikan. |
| testleft | Command Yann AI V15 "testleft" — belum diimplementasikan. |
| testultah | Command Yann AI V15 "testultah" — belum diimplementasikan. |
| testwelcome | Command Yann AI V15 "testwelcome" — belum diimplementasikan. |
| text2speech | Command Yann AI V15 "text2speech" — belum diimplementasikan. |
| th | Command Yann AI V15 "th" — belum diimplementasikan. |
| threadsdown | Command Yann AI V15 "threadsdown" — belum diimplementasikan. |
| tictactoe2 | Command Yann AI V15 "tictactoe2" — belum diimplementasikan. |
| tictactoerich | Command Yann AI V15 "tictactoerich" — belum diimplementasikan. |
| tiktokmp3 | Command Yann AI V15 "tiktokmp3" — belum diimplementasikan. |
| tiktokplay | Command Yann AI V15 "tiktokplay" — belum diimplementasikan. |
| tiktokplay2 | Command Yann AI V15 "tiktokplay2" — belum diimplementasikan. |
| to2d | Command Yann AI V15 "to2d" — belum diimplementasikan. |
| toaktivis | Command Yann AI V15 "toaktivis" — belum diimplementasikan. |
| toanime | Command Yann AI V15 "toanime" — belum diimplementasikan. |
| tobotak | Command Yann AI V15 "tobotak" — belum diimplementasikan. |
| tochibi | Command Yann AI V15 "tochibi" — belum diimplementasikan. |
| todemo | Command Yann AI V15 "todemo" — belum diimplementasikan. |
| todemojalanan | Command Yann AI V15 "todemojalanan" — belum diimplementasikan. |
| todemonstrasi | Command Yann AI V15 "todemonstrasi" — belum diimplementasikan. |
| todino | Command Yann AI V15 "todino" — belum diimplementasikan. |
| todonghua | Command Yann AI V15 "todonghua" — belum diimplementasikan. |
| todpr | Command Yann AI V15 "todpr" — belum diimplementasikan. |
| tofigure | Command Yann AI V15 "tofigure" — belum diimplementasikan. |
| tofootball | Command Yann AI V15 "tofootball" — belum diimplementasikan. |
| tojawa | Command Yann AI V15 "tojawa" — belum diimplementasikan. |
| tokartun | Command Yann AI V15 "tokartun" — belum diimplementasikan. |
| tolakacc | Command Yann AI V15 "tolakacc" — belum diimplementasikan. |
| tomanga | Command Yann AI V15 "tomanga" — belum diimplementasikan. |
| tomangu | Command Yann AI V15 "tomangu" — belum diimplementasikan. |
| tomanhwa | Command Yann AI V15 "tomanhwa" — belum diimplementasikan. |
| tomirror | Command Yann AI V15 "tomirror" — belum diimplementasikan. |
| tomoai | Command Yann AI V15 "tomoai" — belum diimplementasikan. |
| tomountain | Command Yann AI V15 "tomountain" — belum diimplementasikan. |
| top4top | Command Yann AI V15 "top4top" — belum diimplementasikan. |
| topacar | Command Yann AI V15 "topacar" — belum diimplementasikan. |
| topbalance | Command Yann AI V15 "topbalance" — belum diimplementasikan. |
| topenjara | Command Yann AI V15 "topenjara" — belum diimplementasikan. |
| topmoney | Command Yann AI V15 "topmoney" — belum diimplementasikan. |
| toproblox | Command Yann AI V15 "toproblox" — belum diimplementasikan. |
| topstreak | Command Yann AI V15 "topstreak" — belum diimplementasikan. |
| toptv | Command Yann AI V15 "toptv" — belum diimplementasikan. |
| topunk | Command Yann AI V15 "topunk" — belum diimplementasikan. |
| toroblox | Command Yann AI V15 "toroblox" — belum diimplementasikan. |
| tosad | Command Yann AI V15 "tosad" — belum diimplementasikan. |
| tosatan | Command Yann AI V15 "tosatan" — belum diimplementasikan. |
| tosunda | Command Yann AI V15 "tosunda" — belum diimplementasikan. |
| totalchat | Command Yann AI V15 "totalchat" — belum diimplementasikan. |
| totalpesan | Command Yann AI V15 "totalpesan" — belum diimplementasikan. |
| totaluser | Command Yann AI V15 "totaluser" — belum diimplementasikan. |
| toukachan | Command Yann AI V15 "toukachan" — belum diimplementasikan. |
| touploader | Command Yann AI V15 "touploader" — belum diimplementasikan. |
| tourl | Command Yann AI V15 "tourl" — belum diimplementasikan. |
| tourl2 | Command Yann AI V15 "tourl2" — belum diimplementasikan. |
| tourl3 | Command Yann AI V15 "tourl3" — belum diimplementasikan. |
| tourlgh | Command Yann AI V15 "tourlgh" — belum diimplementasikan. |
| tqto | Command Yann AI V15 "tqto" — belum diimplementasikan. |
| trialprem | Command Yann AI V15 "trialprem" — belum diimplementasikan. |
| trialpremium | Command Yann AI V15 "trialpremium" — belum diimplementasikan. |
| tsunade | Command Yann AI V15 "tsunade" — belum diimplementasikan. |
| ttmp3 | Command Yann AI V15 "ttmp3" — belum diimplementasikan. |
| ttsbrando | Command Yann AI V15 "ttsbrando" — belum diimplementasikan. |
| tukarkoin | Command Yann AI V15 "tukarkoin" — belum diimplementasikan. |
| tukaruang | Command Yann AI V15 "tukaruang" — belum diimplementasikan. |
| tvstiker | Command Yann AI V15 "tvstiker" — belum diimplementasikan. |
| typographytext | Command Yann AI V15 "typographytext" — belum diimplementasikan. |
| uguu | Command Yann AI V15 "uguu" — belum diimplementasikan. |
| ultah | Command Yann AI V15 "ultah" — belum diimplementasikan. |
| ultra-encrypt | Command Yann AI V15 "ultra-encrypt" — belum diimplementasikan. |
| ultraenc | Command Yann AI V15 "ultraenc" — belum diimplementasikan. |
| ultrajsen | Command Yann AI V15 "ultrajsen" — belum diimplementasikan. |
| unblok | Command Yann AI V15 "unblok" — belum diimplementasikan. |
| unblur | Command Yann AI V15 "unblur" — belum diimplementasikan. |
| underwatertext | Command Yann AI V15 "underwatertext" — belum diimplementasikan. |
| ungu | Command Yann AI V15 "ungu" — belum diimplementasikan. |
| ungukehitaman | Command Yann AI V15 "ungukehitaman" — belum diimplementasikan. |
| ungutua | Command Yann AI V15 "ungutua" — belum diimplementasikan. |
| unli | Command Yann AI V15 "unli" — belum diimplementasikan. |
| unmutegc | Command Yann AI V15 "unmutegc" — belum diimplementasikan. |
| unmutegc_proses | Command Yann AI V15 "unmutegc_proses" — belum diimplementasikan. |
| unresimg | Command Yann AI V15 "unresimg" — belum diimplementasikan. |
| upchannel | Command Yann AI V15 "upchannel" — belum diimplementasikan. |
| upchannel2 | Command Yann AI V15 "upchannel2" — belum diimplementasikan. |
| updatelist | Command Yann AI V15 "updatelist" — belum diimplementasikan. |
| userinfo | Command Yann AI V15 "userinfo" — belum diimplementasikan. |
| v | Command Yann AI V15 "v" — belum diimplementasikan. |
| veo3 | Command Yann AI V15 "veo3" — belum diimplementasikan. |
| videy | Command Yann AI V15 "videy" — belum diimplementasikan. |
| videydl | Command Yann AI V15 "videydl" — belum diimplementasikan. |
| vignet | Command Yann AI V15 "vignet" — belum diimplementasikan. |
| vignette | Command Yann AI V15 "vignette" — belum diimplementasikan. |
| vocalremover | Command Yann AI V15 "vocalremover" — belum diimplementasikan. |
| voicecover | Command Yann AI V15 "voicecover" — belum diimplementasikan. |
| vol | Command Yann AI V15 "vol" — belum diimplementasikan. |
| volumevideo | Command Yann AI V15 "volumevideo" — belum diimplementasikan. |
| volvid | Command Yann AI V15 "volvid" — belum diimplementasikan. |
| volvideo | Command Yann AI V15 "volvideo" — belum diimplementasikan. |
| waifu2 | Command Yann AI V15 "waifu2" — belum diimplementasikan. |
| wanted | Command Yann AI V15 "wanted" — belum diimplementasikan. |
| warning | Command Yann AI V15 "warning" — belum diimplementasikan. |
| warninglist | Command Yann AI V15 "warninglist" — belum diimplementasikan. |
| warnlist | Command Yann AI V15 "warnlist" — belum diimplementasikan. |
| watercolortext | Command Yann AI V15 "watercolortext" — belum diimplementasikan. |
| web2apk | Command Yann AI V15 "web2apk" — belum diimplementasikan. |
| webtoapk | Command Yann AI V15 "webtoapk" — belum diimplementasikan. |
| wheat | Command Yann AI V15 "wheat" — belum diimplementasikan. |
| wood | Command Yann AI V15 "wood" — belum diimplementasikan. |
| worm | Command Yann AI V15 "worm" — belum diimplementasikan. |
| writetext | Command Yann AI V15 "writetext" — belum diimplementasikan. |
| yandl | Command Yann AI V15 "yandl" — belum diimplementasikan. |
| yanedit | Command Yann AI V15 "yanedit" — belum diimplementasikan. |
| yannai | Command Yann AI V15 "yannai" — belum diimplementasikan. |
| yannaimd | Command Yann AI V15 "yannaimd" — belum diimplementasikan. |
| yannedit | Command Yann AI V15 "yannedit" — belum diimplementasikan. |
| yannqc | Command Yann AI V15 "yannqc" — belum diimplementasikan. |
| yanqc | Command Yann AI V15 "yanqc" — belum diimplementasikan. |
| youtubemp4 | Command Yann AI V15 "youtubemp4" — belum diimplementasikan. |
| ytcomment | Command Yann AI V15 "ytcomment" — belum diimplementasikan. |
| ytgoldbutton | Command Yann AI V15 "ytgoldbutton" — belum diimplementasikan. |
| ytsilverbutton | Command Yann AI V15 "ytsilverbutton" — belum diimplementasikan. |
| yuki | Command Yann AI V15 "yuki" — belum diimplementasikan. |
| yuri | Command Yann AI V15 "yuri" — belum diimplementasikan. |
| zrooart | Command Yann AI V15 "zrooart" — belum diimplementasikan. |
