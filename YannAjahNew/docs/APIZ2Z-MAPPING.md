# Pemetaan endpoint APIZ2Z → command WhatsApp

> Dibuat otomatis oleh `npm run features:report` dari `library/catalog/apiz2z-endpoints.json`. Semua endpoint di bawah diverifikasi dari source platform (bukan karangan). Kolom Uji = hasil uji mock terakhir (bukan uji live).

Total: 484 command.

| Endpoint | Command | Alias | Kategori | Parameter (* wajib) | Uji |
|---|---|---|---|---|---|
| `/api/ai/asynt` | .asynt |  | ai | text*, sessionId | 1/1 mock |
| `/api/ai/bard` | .bard |  | ai | query* | 1/1 mock |
| `/api/ai/bible` | .bible |  | ai | text* | 1/1 mock |
| `/api/ai/blackbox` | .blackbox |  | ai | text* | 1/1 mock |
| `/api/ai/bypassai` | .bypassai |  | ai | text* | 1/1 mock |
| `/api/ai/chatgpt` | .ai | chatgpt, gpt, openai | ai | prompt*, chatId | 1/1 mock |
| `/api/ai/claude` | .claude |  | ai | text* | 1/1 mock |
| `/api/ai/claude-v2` | .claude2 |  | ai | text* | 1/1 mock |
| `/api/ai/copilot` | .copilot |  | ai | prompt*, mode, conversationId, imageUrl | 1/1 mock |
| `/api/ai/copilot-v2` | .copilot2 |  | ai | prompt* | 1/1 mock |
| `/api/ai/deepai` | .deepai |  | ai | text*, model | 1/1 mock |
| `/api/ai/deepsearch` | .deepsearch |  | ai | text* | 1/1 mock |
| `/api/ai/dracin-tts` | .dracintts |  | ai | text*, speed, volume, music | 1/1 mock |
| `/api/ai/epsilon` | .epsilon |  | ai | text* | 1/1 mock |
| `/api/ai/flux` | .flux | txt2img | ai | prompt* | 1/1 mock |
| `/api/ai/gandalf` | .gandalf |  | ai | q* | 1/1 mock |
| `/api/ai/gemini` | .gemini | bard2 | ai | prompt*, chatId | 1/1 mock |
| `/api/ai/gemini-tts` | .geminitts |  | ai | text* | 1/1 mock |
| `/api/ai/gemini-vision` | .geminivision | analisisgambar | ai | text*, url | 1/1 mock |
| `/api/ai/gitagpt` | .gitagpt |  | ai | text* | 1/1 mock |
| `/api/ai/google` | .aigoogle |  | ai | query* | 1/1 mock |
| `/api/ai/gpt` | .aigpt |  | ai | text*, imageUrl, chatId | 1/1 mock |
| `/api/ai/gpt-3.5-turbo` | .gpt35turbo |  | ai | text* | 1/1 mock |
| `/api/ai/hyperai` | .hyperai |  | ai | prompt* | 1/1 mock |
| `/api/ai/ideogram` | .ideogram |  | ai | prompt* | 1/1 mock |
| `/api/ai/image-gen` | .imagegen | genimage | ai | text* | 1/1 mock |
| `/api/ai/islamic` | .islamic |  | ai | text* | 1/1 mock |
| `/api/ai/kimi` | .kimi | kimiai | ai | text* | 1/1 mock |
| `/api/ai/lumin` | .lumin |  | ai | text* | 1/1 mock |
| `/api/ai/magicstudio` | .magicstudio |  | ai | prompt* | 1/1 mock |
| `/api/ai/mathgpt` | .mathgpt |  | ai | text* | 1/1 mock |
| `/api/ai/monica` | .monica |  | ai | text* | 1/1 mock |
| `/api/ai/morphic` | .morphic |  | ai | text* | 1/1 mock |
| `/api/ai/muslimai` | .muslimai |  | ai | query*, chatId | 1/1 mock |
| `/api/ai/muslimai-v2` | .muslimai2 |  | ai | query* | 1/1 mock |
| `/api/ai/nano-banana` | .nanobanana | banana | ai | image_url*, prompt*, mode | 1/1 mock |
| `/api/ai/natalie` | .natalie |  | ai | text* | 1/1 mock |
| `/api/ai/nsfw-check` | .nsfwcheck |  | ai | url* | 1/1 mock |
| `/api/ai/nsfw-check-v2` | .nsfwcheck2 |  | ai | url* | 1/1 mock |
| `/api/ai/overchat` | .overchat |  | ai | text* | 1/1 mock |
| `/api/ai/pollinations` | .pollinations |  | ai | prompt*, width, height | 1/1 mock |
| `/api/ai/powerbrain` | .powerbrain |  | ai | prompt* | 1/1 mock |
| `/api/ai/powerbrain-v2` | .powerbrain2 |  | ai | prompt* | 1/1 mock |
| `/api/ai/publicai` | .publicai |  | ai | text*, chatId | 1/1 mock |
| `/api/ai/publicai-v2` | .publicai2 |  | ai | text* | 1/1 mock |
| `/api/ai/qwen` | .qwen |  | ai | text*, fileUrl, chatId, search, think | 1/1 mock |
| `/api/ai/screnapp` | .screnapp |  | ai | url_image*, text* | 1/1 mock |
| `/api/ai/simisimi` | .simi | simisimi | ai | text* | 1/1 mock |
| `/api/ai/sologo` | .sologo |  | ai | prompt* | 1/1 mock |
| `/api/ai/story` | .story |  | ai | prompt*, mode, length, creative | 1/1 mock |
| `/api/ai/talefy` | .talefy |  | ai | text*, genre* | 1/1 mock |
| `/api/ai/text-to-image` | .texttoimage | buatgambar | ai | name* | 1/1 mock |
| `/api/ai/turboseek` | .turboseek |  | ai | text* | 1/1 mock |
| `/api/ai/unlimited` | .unlimited |  | ai | text*, chatId | 1/1 mock |
| `/api/ai/venice` | .venice |  | ai | prompt* | 1/1 mock |
| `/api/ai/vider` | .vider |  | ai | prompt* | 1/1 mock |
| `/api/ai/voice` | .voice |  | ai | prompt*, voice* | 1/1 mock |
| `/api/ai/webpilot` | .webpilot |  | ai | text*, threadId | 1/1 mock |
| `/api/ai/webpilot-v2` | .webpilot2 |  | ai | text* | 1/1 mock |
| `/api/ai/writecream` | .writecream |  | ai | text*, logic* | 1/1 mock |
| `/api/ai/writecreamimg` | .writecreamimg |  | ai | prompt*, ratio | 1/1 mock |
| `/api/analyze/tiktok-hashtag` | .tiktokhashtag |  | tools | tag* | 1/1 mock |
| `/api/analyze/tiktok-hashtag-v2` | .tiktokhashtag2 |  | tools | tag* | 1/1 mock |
| `/api/anime/anichin/detail` | .animeanichindetail |  | anime | url* | 1/1 mock |
| `/api/anime/anichin/latest` | .animeanichinlatest |  | anime | page | 1/1 mock |
| `/api/anime/anichin/search` | .animeanichinsearch |  | anime | q* | 1/1 mock |
| `/api/anime/kiryuu/search` | .animekiryuusearch |  | anime | q* | 1/1 mock |
| `/api/anime/komiku/chapter` | .animekomikuchapter |  | anime | url* | 1/1 mock |
| `/api/anime/komiku/detail` | .animekomikudetail |  | anime | url* | 1/1 mock |
| `/api/anime/komiku/popular` | .animekomikupopular |  | anime | page | 1/1 mock |
| `/api/anime/komiku/search` | .animekomikusearch |  | anime | q* | 1/1 mock |
| `/api/anime/oploverz/ongoing` | .animeoploverzongoing |  | anime | page | 1/1 mock |
| `/api/anime/oploverz/search` | .animeoploverzsearch |  | anime | q* | 1/1 mock |
| `/api/anime/samehadaku/schedule` | .animesamehadakuschedule |  | anime |  | 1/1 mock |
| `/api/apk/an1` | .an1 |  | search | q* | 1/1 mock |
| `/api/apk/apkmody` | .apkmody |  | search | q*, limit | 1/1 mock |
| `/api/apk/playstore` | .apkplaystore |  | search | q*, limit | 1/1 mock |
| `/api/audio/murotal` | .murotalapi |  | music | qari, surah, rehost | 1/1 mock |
| `/api/canvas/goodbye` | .goodbyecard |  | canvas | username*, avatar*, guildName*, memberCount, background | 1/1 mock |
| `/api/canvas/goodbyev1` | .goodbyev1 |  | canvas | username*, avatar*, guildName*, memberCount, background | 1/1 mock |
| `/api/canvas/goodbyev2` | .goodbyev2 |  | canvas | username*, avatar*, guildName* | 1/1 mock |
| `/api/canvas/goodbyev3` | .goodbyev3 |  | canvas | username*, avatar*, guildName* | 1/1 mock |
| `/api/canvas/goodbyev4` | .goodbyev4 |  | canvas | username*, avatar*, guildName* | 1/1 mock |
| `/api/canvas/goodbyev5` | .goodbyev5 |  | canvas | username*, avatar*, guildName* | 1/1 mock |
| `/api/canvas/gura` | .gura |  | canvas | url* | 1/1 mock |
| `/api/canvas/igqc` | .igqc |  | canvas | text, image | 1/1 mock |
| `/api/canvas/iqc` | .iqc |  | canvas | text*, time | 1/1 mock |
| `/api/canvas/iqc-v2` | .iqc2 |  | canvas | text* | 1/1 mock |
| `/api/canvas/jmk` | .jmk |  | canvas | url* | 1/1 mock |
| `/api/canvas/kalender` | .kalendercanvas |  | canvas | year, month | 1/1 mock |
| `/api/canvas/meme-beautiful` | .memebeautiful |  | canvas | image1*, image2 | 1/1 mock |
| `/api/canvas/meme-drake` | .memedrake |  | canvas | text1*, text2* | 1/1 mock |
| `/api/canvas/meme-jarvis` | .memejarvis |  | canvas | text* | 1/1 mock |
| `/api/canvas/meme-twobuttons` | .memetwobuttons |  | canvas | text1*, text2* | 1/1 mock |
| `/api/canvas/musiccard` | .musiccard |  | canvas | judul*, nama*, image_url* | 1/1 mock |
| `/api/canvas/pixel-art` | .pixelart |  | canvas | url*, grid | 1/1 mock |
| `/api/canvas/pixel-art-v2` | .pixelart2 |  | canvas | url* | 1/1 mock |
| `/api/canvas/profile` | .profilecard |  | canvas | username*, avatar*, level, exp, requiredExp, rank, background | 1/1 mock |
| `/api/canvas/qcwa` | .qcwa |  | canvas | username, phone, tag, pp*, text, image, mode | 1/1 mock |
| `/api/canvas/quotly` | .canvasquotly |  | canvas | text*, name*, avatar*, color* | 1/1 mock |
| `/api/canvas/rankcard` | .rankcard |  | canvas | username*, avatar*, currentxp*, requiredxp*, status*, level*, rank*, progressbarcolor* | 1/1 mock |
| `/api/canvas/rankup` | .rankup |  | canvas | username*, avatar*, oldRank*, newRank*, background | 1/1 mock |
| `/api/canvas/ship` | .shipcard |  | canvas | avatar1*, avatar2*, percentage, background | 1/1 mock |
| `/api/canvas/timpa-teks` | .timpateks |  | canvas | username, text* | 1/1 mock |
| `/api/canvas/ttqc` | .ttqc |  | canvas | username, text*, avatar | 1/1 mock |
| `/api/canvas/welcome` | .welcomecard |  | canvas | username*, guildName*, memberCount*, avatar*, background, guildIcon | 1/1 mock |
| `/api/canvas/welcomeleave` | .welcomeleave |  | canvas | title*, description*, avatar*, background*, color*, cardstroke* | 1/1 mock |
| `/api/canvas/welcomev2` | .welcomev2 |  | canvas | username*, guildName*, memberCount*, avatar*, background | 1/1 mock |
| `/api/canvas/welcomev3` | .welcomev3 |  | canvas | username*, guildName*, memberCount*, avatar* | 1/1 mock |
| `/api/canvas/welcomev4` | .welcomev4 |  | canvas | username*, guildName*, memberCount*, avatar*, background | 1/1 mock |
| `/api/canvas/welcomev5` | .welcomev5 |  | canvas | username*, guildName*, memberCount*, avatar* | 1/1 mock |
| `/api/canvas/youtube` | .canvasyoutube |  | canvas | title*, artist*, coverurl* | 1/1 mock |
| `/api/check/mlbb` | .mlstalk | stalkml, cekml | check | uid*, zone* | 1/1 mock |
| `/api/comments/tiktok` | .commentstiktok |  | tools | url*, replies, limit | 1/1 mock |
| `/api/detail/iqiyi` | .iqiyi |  | downloader | slug* | 1/1 mock |
| `/api/detail/mcpedl` | .mcpedl |  | search | slug* | 1/1 mock |
| `/api/douyin/hot` | .douyinhot |  | search |  | 1/1 mock |
| `/api/download/aio` | .aio | allinone, downloadall | downloader | url* | 1/1 mock |
| `/api/download/aio-v2` | .aio2 |  | downloader | url* | 1/1 mock |
| `/api/download/applemusic` | .applemusicdl |  | downloader | url* | 1/1 mock |
| `/api/download/bilibili` | .bilibili |  | downloader | url*, quality | 1/1 mock |
| `/api/download/capcut` | .capcut | capcutdl | downloader | url* | 1/1 mock |
| `/api/download/capcut-v2` | .capcut2 |  | downloader | url* | 1/1 mock |
| `/api/download/dailymotion` | .dailymotion |  | downloader | url* | 1/1 mock |
| `/api/download/douyin` | .douyin |  | downloader | url* | 1/1 mock |
| `/api/download/facebook` | .facebook | fb, fbdl | downloader | url* | 1/1 mock |
| `/api/download/facebook-v2` | .facebook2 |  | downloader | url* | 1/1 mock |
| `/api/download/gdrive` | .gdrive | gdrivedl | downloader | url* | 1/1 mock |
| `/api/download/gdrive-v2` | .gdrive2 |  | downloader | url* | 1/1 mock |
| `/api/download/getsticker` | .getsticker |  | downloader | url* | 1/1 mock |
| `/api/download/github` | .github |  | downloader | url* | 1/1 mock |
| `/api/download/github-v2` | .github2 |  | downloader | url* | 1/1 mock |
| `/api/download/instagram` | .instagram | ig, igdl | downloader | url* | 1/1 mock |
| `/api/download/kolid` | .kolid |  | downloader | url* | 1/1 mock |
| `/api/download/lahelu` | .lahelu |  | downloader | url* | 1/1 mock |
| `/api/download/likee` | .likee |  | downloader | url* | 1/1 mock |
| `/api/download/mediafire` | .mediafire | mf | downloader | url* | 1/1 mock |
| `/api/download/mediafire-v2` | .mediafire2 |  | downloader | url* | 1/1 mock |
| `/api/download/mixcloud` | .mixcloud |  | downloader | url* | 1/1 mock |
| `/api/download/npm` | .downloadnpm |  | downloader | package*, version | 1/1 mock |
| `/api/download/pinterest` | .pindl | pinterestdl | downloader | url* | 1/1 mock |
| `/api/download/pinterest-v2` | .pinterest2 |  | downloader | url* | 1/1 mock |
| `/api/download/play` | .play | song, lagu | downloader | query* | 1/1 mock |
| `/api/download/play-v2` | .play2 |  | downloader | query* | 1/1 mock |
| `/api/download/play-v3` | .play3 |  | downloader | query* | 1/1 mock |
| `/api/download/reddit` | .reddit |  | downloader | url* | 1/1 mock |
| `/api/download/scribd` | .scribd |  | downloader | url* | 1/1 mock |
| `/api/download/sfile` | .sfile |  | downloader | url* | 1/1 mock |
| `/api/download/shopee` | .shopee |  | downloader | url* | 1/1 mock |
| `/api/download/snackvideo` | .snackvideo |  | downloader | url* | 1/1 mock |
| `/api/download/soundcloud` | .soundclouddl | scdl | downloader | url* | 1/1 mock |
| `/api/download/spotify` | .spotifydl |  | downloader | url* | 1/1 mock |
| `/api/download/spotify-v2` | .spotify2 |  | downloader | url* | 1/1 mock |
| `/api/download/stickerly` | .stickerly |  | downloader | url* | 1/1 mock |
| `/api/download/telestick` | .telestick |  | downloader | url* | 1/1 mock |
| `/api/download/telestick-v2` | .telestick2 |  | downloader | url* | 1/1 mock |
| `/api/download/terabox` | .terabox |  | downloader | url* | 1/1 mock |
| `/api/download/threads` | .threads | threadsdl | downloader | url* | 1/1 mock |
| `/api/download/tiktok` | .tiktok | tt, ttdl, tiktokdl | downloader | url* | 1/1 mock |
| `/api/download/tiktok-v2` | .tiktok2 |  | downloader | url* | 1/1 mock |
| `/api/download/tiktok-v3` | .tiktok3 |  | downloader | url* | 1/1 mock |
| `/api/download/twitter` | .twitter | twdl, xdl | downloader | url* | 1/1 mock |
| `/api/download/twitter-v2` | .twitter2 |  | downloader | url* | 1/1 mock |
| `/api/download/vdko` | .vdko |  | downloader | url* | 1/1 mock |
| `/api/download/weibo` | .weibo |  | downloader | url* | 1/1 mock |
| `/api/download/xhs` | .xhs |  | downloader | url* | 1/1 mock |
| `/api/download/youtube` | .youtube | ytdl, yt | downloader | url*, type, quality | 1/1 mock |
| `/api/download/youtube-v2` | .youtube2 |  | downloader | url*, quality | 1/1 mock |
| `/api/download/ytdl` | .downloadytdl |  | downloader | url* | 1/1 mock |
| `/api/download/ytmp3` | .ytmp3 | yta | downloader | url*, format, bitrate | 1/1 mock |
| `/api/download/ytmp4` | .ytmp4 | ytv, ytvideo | downloader | url*, resolution | 1/1 mock |
| `/api/ephoto/bravegreen` | .bravegreen |  | ephoto | url* | 1/1 mock |
| `/api/fun/alay` | .alayapi |  | fun | text* | 1/1 mock |
| `/api/fun/alay-v2` | .alay2 |  | fun | text* | 1/1 mock |
| `/api/fun/fancytext` | .fancytext |  | fun | text* | 1/1 mock |
| `/api/fun/livefunfact` | .livefunfact |  | fun | birthdate* | 1/1 mock |
| `/api/fun/nomin` | .nomin |  | fun |  | 1/1 mock |
| `/api/fun/umur` | .funumur |  | fun | birthdate* | 1/1 mock |
| `/api/game/bluearchive` | .bluearchive |  | games | action, q | 1/1 mock |
| `/api/games/asahotak` | .gamesasahotak |  | games |  | 1/1 mock |
| `/api/games/asahotak-v2` | .asahotak2 |  | games |  | 1/1 mock |
| `/api/games/caklontong` | .gamescaklontong |  | games |  | 1/1 mock |
| `/api/games/cc-sd` | .ccsd |  | games |  | 1/1 mock |
| `/api/games/family100` | .gamesfamily100 |  | games |  | 1/1 mock |
| `/api/games/islamic` | .gamesislamic |  | games |  | 1/1 mock |
| `/api/games/lengkapikalimat` | .gameslengkapikalimat |  | games |  | 1/1 mock |
| `/api/games/math-quiz` | .gamesmathquiz |  | games |  | 1/1 mock |
| `/api/games/siapa-dia` | .siapadia |  | games |  | 1/1 mock |
| `/api/games/siapa-dia-v2` | .siapadia2 |  | games |  | 1/1 mock |
| `/api/games/susunkata` | .gamessusunkata |  | games |  | 1/1 mock |
| `/api/games/susunkata-v2` | .susunkata2 |  | games |  | 1/1 mock |
| `/api/games/tebak-hewan` | .gamestebakhewan |  | games |  | 1/1 mock |
| `/api/games/tebak-kabupaten` | .tebakkabupaten |  | games |  | 1/1 mock |
| `/api/games/tebak-kalimat` | .tebakkalimat |  | games |  | 1/1 mock |
| `/api/games/tebak-karakter-ff` | .tebakkarakterff |  | games |  | 1/1 mock |
| `/api/games/tebak-kartun` | .tebakkartun |  | games |  | 1/1 mock |
| `/api/games/tebak-kimia` | .tebakkimia |  | games |  | 1/1 mock |
| `/api/games/tebak-kimia-v2` | .tebakkimia2 |  | games |  | 1/1 mock |
| `/api/games/tebak-lagu` | .gamestebaklagu |  | games |  | 1/1 mock |
| `/api/games/tebak-lirik` | .gamestebaklirik |  | games |  | 1/1 mock |
| `/api/games/tebak-lirik-v2` | .tebaklirik2 |  | games |  | 1/1 mock |
| `/api/games/tebak-logo` | .gamestebaklogo |  | games |  | 1/1 mock |
| `/api/games/tebak-siapa` | .tebaksiapa |  | games |  | 1/1 mock |
| `/api/games/tebak-tebakan` | .tebaktebakan |  | games |  | 1/1 mock |
| `/api/games/tebak-tebakan-v2` | .tebaktebakan2 |  | games |  | 1/1 mock |
| `/api/games/tebak-warna` | .tebakwarna |  | games |  | 1/1 mock |
| `/api/games/tebakbendera` | .gamestebakbendera |  | games |  | 1/1 mock |
| `/api/games/tebakgambar` | .gamestebakgambar |  | games |  | 1/1 mock |
| `/api/games/tebakgame` | .gamestebakgame |  | games |  | 1/1 mock |
| `/api/games/tebakheroml` | .tebakheroml |  | games |  | 1/1 mock |
| `/api/games/tebakkata` | .gamestebakkata |  | games |  | 1/1 mock |
| `/api/games/tekateki` | .tekateki |  | games |  | 1/1 mock |
| `/api/games/tekateki-v2` | .tekateki2 |  | games |  | 1/1 mock |
| `/api/image/lumiart` | .lumiart |  | image | imageUrl* | 1/1 mock |
| `/api/image/sketch` | .sketch |  | image | imageUrl* | 1/1 mock |
| `/api/imgedit/pixelate` | .imgeditpixelate |  | image | url*, level | 1/1 mock |
| `/api/info/bilibili` | .infobilibili |  | info | url* | 1/1 mock |
| `/api/info/cuaca/v1` | .cuaca | cekcuaca | info | area | 1/1 mock |
| `/api/info/cuaca/v2` | .cuacav2 |  | info | kota*, days | 1/1 mock |
| `/api/info/gempa` | .gempa | infogempa, cekgempa | info | type | 1/1 mock |
| `/api/info/gempa-v2` | .gempa2 |  | info |  | 1/1 mock |
| `/api/info/grow-a-garden` | .growagarden |  | info |  | 1/1 mock |
| `/api/info/grow-a-garden-v2` | .growagarden2 |  | info |  | 1/1 mock |
| `/api/info/hari-libur` | .harilibur | libur | info |  | 1/1 mock |
| `/api/info/hari-libur-v2` | .harilibur2 |  | info |  | 1/1 mock |
| `/api/info/jadwal-sholat` | .jadwalsholat | sholat | info | kota, bulan, tahun | 1/1 mock |
| `/api/info/jadwal-sholat-v2` | .jadwalsholat2 |  | info | kota* | 1/1 mock |
| `/api/info/jadwalbola` | .jadwalbola |  | info |  | 1/1 mock |
| `/api/info/jadwaltv` | .jadwaltv |  | info |  | 1/1 mock |
| `/api/info/jadwaltv-v2` | .jadwaltv2 |  | info | channel* | 1/1 mock |
| `/api/islamic/ayatkursi` | .ayatkursi |  | islamic |  | 1/1 mock |
| `/api/islamic/bacaanshalat` | .bacaansholat |  | islamic |  | 1/1 mock |
| `/api/islamic/doaharian` | .doaharian | doa | islamic |  | 1/1 mock |
| `/api/islamic/kisahnabi` | .kisahnabiapi |  | islamic | nabi* | 1/1 mock |
| `/api/islamic/surah` | .surah | quran | islamic | no* | 1/1 mock |
| `/api/islamic/tahlil` | .tahlil |  | islamic |  | 1/1 mock |
| `/api/islamic/wirid` | .islamicwirid |  | islamic |  | 1/1 mock |
| `/api/lk21/browse` | .browse |  | movie | mode, page | 1/1 mock |
| `/api/maker/animediff` | .animediff |  | maker | prompt* | 1/1 mock |
| `/api/maker/attp` | .attp |  | maker | text* | 1/1 mock |
| `/api/maker/attp-v2` | .attp2 |  | maker | text* | 1/1 mock |
| `/api/maker/balogo` | .balogo |  | maker | text* | 1/1 mock |
| `/api/maker/bananaai` | .bananaai |  | maker | url*, prompt* | 1/1 mock |
| `/api/maker/bananagen` | .bananagen |  | maker | prompt*, model | 1/1 mock |
| `/api/maker/brat` | .brat |  | maker | text* | 1/1 mock |
| `/api/maker/brat-v2` | .brat2 |  | maker | text* | 1/1 mock |
| `/api/maker/bratanime` | .bratanime |  | maker | text* | 1/1 mock |
| `/api/maker/brathd` | .brathd |  | maker | text* | 1/1 mock |
| `/api/maker/bratvid` | .bratvid | bratvideo | maker | text*, format | 1/1 mock |
| `/api/maker/bratvid-v2` | .bratvid2 |  | maker | text* | 1/1 mock |
| `/api/maker/bratvidhd` | .bratvidhd |  | maker | text* | 1/1 mock |
| `/api/maker/carbon` | .carbon | carbonify | maker | code*, lang | 1/1 mock |
| `/api/maker/carbon-v2` | .carbon2 |  | maker | code* | 1/1 mock |
| `/api/maker/emojimix` | .emojimix |  | maker | emoji1*, emoji2* | 1/1 mock |
| `/api/maker/emojitogif` | .emojitogif |  | maker | emoji* | 1/1 mock |
| `/api/maker/emojitogif-v2` | .emojitogif2 |  | maker | emoji* | 1/1 mock |
| `/api/maker/fakecall` | .fakecall |  | maker | name*, time*, photo* | 1/1 mock |
| `/api/maker/iqc-pink` | .iqcpink |  | maker | q* | 1/1 mock |
| `/api/maker/landsat-name` | .landsatname |  | maker | name*, variant | 1/1 mock |
| `/api/maker/msg` | .msg |  | maker | message*, title, icon | 1/1 mock |
| `/api/maker/nulis` | .nulis | tulis | maker | text* | 1/1 mock |
| `/api/maker/qc` | .makerqc | quotly | maker | text*, name*, avatar*, color* | 1/1 mock |
| `/api/maker/quoted` | .quoted |  | maker | username*, text*, profile, bg | 1/1 mock |
| `/api/maker/remini` | .remini |  | maker | url* | 1/1 mock |
| `/api/maker/remini-v2` | .remini2 |  | maker | url* | 1/1 mock |
| `/api/maker/smeme` | .smeme | stickermeme | maker | text_atas*, text_bawah*, background* | 1/1 mock |
| `/api/maker/ttp` | .ttp |  | maker | text* | 1/1 mock |
| `/api/maker/ttp-v2` | .ttp2 |  | maker | text* | 1/1 mock |
| `/api/maker/wasted` | .wasted |  | maker | url* | 1/1 mock |
| `/api/manga/komikindo` | .komikindo |  | anime | action, q, genre, type, url, page | 1/1 mock |
| `/api/news/antara` | .antara |  | news |  | 1/1 mock |
| `/api/news/antara-v2` | .antara2 |  | news |  | 1/1 mock |
| `/api/news/cnbc` | .cnbc |  | news |  | 1/1 mock |
| `/api/news/cnbc-v2` | .cnbc2 |  | news |  | 1/1 mock |
| `/api/news/cnn` | .cnn | berita | news |  | 1/1 mock |
| `/api/news/cnn-v2` | .cnn2 |  | news |  | 1/1 mock |
| `/api/news/detik` | .detik |  | news |  | 1/1 mock |
| `/api/news/ffnews` | .ffnews |  | news |  | 1/1 mock |
| `/api/news/jkt48` | .jkt48 |  | news |  | 1/1 mock |
| `/api/news/kompas` | .kompas |  | news |  | 1/1 mock |
| `/api/news/kompas-v2` | .kompas2 |  | news |  | 1/1 mock |
| `/api/news/liputan6` | .liputan6 |  | news |  | 1/1 mock |
| `/api/news/merdeka` | .merdeka |  | news |  | 1/1 mock |
| `/api/news/mlbb` | .mlbb |  | news |  | 1/1 mock |
| `/api/news/okezone` | .okezone |  | news |  | 1/1 mock |
| `/api/news/sindonews` | .sindonews |  | news |  | 1/1 mock |
| `/api/news/sindonews-v2` | .sindonews2 |  | news |  | 1/1 mock |
| `/api/news/suara` | .suara |  | news |  | 1/1 mock |
| `/api/news/tribun` | .tribun |  | news |  | 1/1 mock |
| `/api/pixiv/detail` | .pixivdetail |  | search | id* | 1/1 mock |
| `/api/primbon/artinama` | .artinama |  | primbon | nama* | 1/1 mock |
| `/api/primbon/artinama-v2` | .artinama2 |  | primbon | nama* | 1/1 mock |
| `/api/primbon/cocokpasangan` | .cocokpasangan |  | primbon | nama1*, nama2* | 1/1 mock |
| `/api/primbon/cocokpasangan-v2` | .cocokpasangan2 |  | primbon | nama1*, nama2* | 1/1 mock |
| `/api/primbon/nomorhoki` | .nomorhoki |  | primbon | nomor* | 1/1 mock |
| `/api/primbon/nomorhoki-v2` | .nomorhoki2 |  | primbon | nomor* | 1/1 mock |
| `/api/primbon/penyakit` | .penyakit |  | primbon | tanggal* | 1/1 mock |
| `/api/primbon/penyakit-v2` | .penyakit2 |  | primbon | tanggal*, bulan*, tahun* | 1/1 mock |
| `/api/primbon/ramalan-jodoh-bali` | .ramalanjodohbali |  | primbon | nama1*, tgl1*, bln1*, thn1*, nama2*, tgl2*, bln2*, thn2* | 1/1 mock |
| `/api/primbon/ramalan-jodoh-bali-v2` | .ramalanjodohbali2 |  | primbon | nama1*, tanggal1*, bulan1*, tahun1*, nama2*, tanggal2*, bulan2*, tahun2* | 1/1 mock |
| `/api/primbon/ramaljodoh` | .ramaljodoh |  | primbon | nama1*, nama2* | 1/1 mock |
| `/api/primbon/ramaljodoh-v2` | .ramaljodoh2 |  | primbon | nama1*, tanggal1*, bulan1*, tahun1*, nama2*, tanggal2*, bulan2*, tahun2* | 1/1 mock |
| `/api/primbon/rezeki-hoki` | .rezekihoki |  | primbon | tanggal* | 1/1 mock |
| `/api/primbon/rezeki-hoki-v2` | .rezekihoki2 |  | primbon | tanggal*, bulan*, tahun* | 1/1 mock |
| `/api/primbon/sifat-usaha` | .sifatusaha |  | primbon | tanggal* | 1/1 mock |
| `/api/primbon/sifat-usaha-v2` | .sifatusaha2 |  | primbon | tanggal*, bulan*, tahun* | 1/1 mock |
| `/api/primbon/tafsir-mimpi` | .tafsirmimpi | mimpi | primbon | mimpi* | 1/1 mock |
| `/api/primbon/zodiac` | .zodiak | zodiac | primbon | tanggal* | 1/1 mock |
| `/api/primbon/zodiac-v2` | .zodiac2 |  | primbon | zodiak* | 1/1 mock |
| `/api/random/anime` | .anime |  | random | type* | 1/1 mock |
| `/api/random/anime-quote` | .animequote | quotesanime | random |  | 1/1 mock |
| `/api/random/anjing` | .anjing |  | random |  | 1/1 mock |
| `/api/random/ba` | .ba |  | random |  | 1/1 mock |
| `/api/random/cerpen` | .cerpen |  | random |  | 1/1 mock |
| `/api/random/dare` | .dare |  | random |  | 1/1 mock |
| `/api/random/fakta` | .fakta | faktaunik | random |  | 1/1 mock |
| `/api/random/kata-motivasi` | .katamotivasi |  | random |  | 1/1 mock |
| `/api/random/kucing` | .kucing |  | random |  | 1/1 mock |
| `/api/random/meme` | .meme |  | random |  | 1/1 mock |
| `/api/random/nasehat` | .nasehat |  | random |  | 1/1 mock |
| `/api/random/neko` | .neko |  | random |  | 1/1 mock |
| `/api/random/philosopher-quotes` | .philosopherquotes |  | random |  | 1/1 mock |
| `/api/random/puisi` | .puisi |  | random |  | 1/1 mock |
| `/api/random/quotes` | .quotes |  | random |  | 1/1 mock |
| `/api/random/tokoh-quotes` | .tokohquotes |  | random | type, count | 1/1 mock |
| `/api/random/truth` | .truth |  | random |  | 1/1 mock |
| `/api/random/waifu` | .waifu |  | random | count | 1/1 mock |
| `/api/search/8font` | .x8font |  | search | q*, page | 1/1 mock |
| `/api/search/apkpure` | .apkpure |  | search | q*, limit | 1/1 mock |
| `/api/search/applemusic` | .applemusic |  | search | q* | 1/1 mock |
| `/api/search/bilibili` | .searchbilibili |  | search | q* | 1/1 mock |
| `/api/search/brave` | .brave |  | search | q*, count | 1/1 mock |
| `/api/search/capcut` | .searchcapcut |  | search | q* | 1/1 mock |
| `/api/search/cookpad` | .cookpad |  | search | q* | 1/1 mock |
| `/api/search/deviantart` | .deviantart |  | search | q*, limit | 1/1 mock |
| `/api/search/douyin` | .searchdouyin |  | search | q* | 1/1 mock |
| `/api/search/duckduckgo` | .duckduckgo |  | search | q* | 1/1 mock |
| `/api/search/github` | .githubsearch |  | search | q*, limit | 1/1 mock |
| `/api/search/github-v2` | .searchgithub2 |  | search | q* | 1/1 mock |
| `/api/search/google` | .google |  | search | q* | 1/1 mock |
| `/api/search/groupsor` | .groupsor |  | search | q* | 1/1 mock |
| `/api/search/gsmarena` | .gsmarena |  | search | q* | 1/1 mock |
| `/api/search/happymood` | .happymood |  | search | q* | 1/1 mock |
| `/api/search/image` | .gimage | image | search | q*, limit, size | 1/1 mock |
| `/api/search/iqiyi` | .searchiqiyi |  | search | q* | 1/1 mock |
| `/api/search/istock` | .istock |  | search | q* | 1/1 mock |
| `/api/search/kbbi` | .kbbi |  | search | q* | 1/1 mock |
| `/api/search/mcpedl` | .searchmcpedl |  | search | q*, page, detail | 1/1 mock |
| `/api/search/movie` | .movie |  | search | q* | 1/1 mock |
| `/api/search/myanimelist` | .mal | myanimelist | search | q* | 1/1 mock |
| `/api/search/myinstant` | .myinstant |  | search | q*, limit | 1/1 mock |
| `/api/search/npm` | .npmsearch | npm | search | q* | 1/1 mock |
| `/api/search/npm-v2` | .npm2 |  | search | q* | 1/1 mock |
| `/api/search/npm-v3` | .npm3 |  | search | q* | 1/1 mock |
| `/api/search/npm-v4` | .npm4 |  | search | q* | 1/1 mock |
| `/api/search/pexels` | .pexels |  | search | q*, type | 1/1 mock |
| `/api/search/pinedrama` | .pinedrama |  | search | q* | 1/1 mock |
| `/api/search/pinterest` | .pinterest | pin | search | q* | 1/1 mock |
| `/api/search/pinterest-v2` | .searchpinterest2 |  | search | q* | 1/1 mock |
| `/api/search/pinterestvideo` | .pinterestvideo |  | search | q* | 1/1 mock |
| `/api/search/pixiv` | .pixiv |  | search | q*, page, order | 1/1 mock |
| `/api/search/resep` | .resep |  | search | q* | 1/1 mock |
| `/api/search/resep-v2` | .resep2 |  | search | q* | 1/1 mock |
| `/api/search/sfile` | .searchsfile |  | search | q* | 1/1 mock |
| `/api/search/soundcloud` | .soundcloud | scsearch | search | q*, limit | 1/1 mock |
| `/api/search/soundcloud-v2` | .soundcloud2 |  | search | q* | 1/1 mock |
| `/api/search/spotify` | .spotify | spsearch | search | q* | 1/1 mock |
| `/api/search/spotify-lirik` | .lirik | lyrics, lyric | search | title* | 1/1 mock |
| `/api/search/spotify-lirik-v2` | .spotifylirik2 |  | search | title* | 1/1 mock |
| `/api/search/spotify-v2` | .searchspotify2 |  | search | q* | 1/1 mock |
| `/api/search/stickerly` | .stickersearch | caristicker | search | q* | 1/1 mock |
| `/api/search/stickerly-v2` | .stickerly2 |  | search | q* | 1/1 mock |
| `/api/search/telestick` | .searchtelestick |  | search | q* | 1/1 mock |
| `/api/search/tiktok` | .ttsearch | tiktoksearch | search | q* | 1/1 mock |
| `/api/search/tiktok-v2` | .searchtiktok2 |  | search | q* | 1/1 mock |
| `/api/search/tiktokphoto` | .tiktokphoto |  | search | q* | 1/1 mock |
| `/api/search/tiktoktrend` | .tiktoktrend |  | search | id* | 1/1 mock |
| `/api/search/unsplash` | .unsplash |  | search | q*, count, orientation | 1/1 mock |
| `/api/search/wallcraft` | .wallcraft |  | search | q* | 1/1 mock |
| `/api/search/wikipedia` | .wiki | wikipedia | search | q* | 1/1 mock |
| `/api/search/wikipedia-v2` | .wikipedia2 |  | search | q* | 1/1 mock |
| `/api/search/youtube` | .yts | ytsearch | search | q* | 1/1 mock |
| `/api/search/youtube-v2` | .searchyoutube2 |  | search | q* | 1/1 mock |
| `/api/stalk/facebook` | .stalkfacebook |  | stalk | username* | 1/1 mock |
| `/api/stalk/freefire` | .ffstalk | stalkff | stalk | id* | 1/1 mock |
| `/api/stalk/genshin` | .genshin |  | stalk | uid* | 1/1 mock |
| `/api/stalk/genshin-v2` | .genshin2 |  | stalk | uid* | 1/1 mock |
| `/api/stalk/github` | .githubstalk | stalkgithub | stalk | username* | 1/1 mock |
| `/api/stalk/github-v2` | .stalkgithub2 |  | stalk | username* | 1/1 mock |
| `/api/stalk/instagram` | .igstalk | instagramstalk | stalk | username* | 1/1 mock |
| `/api/stalk/pinterest` | .stalkpinterest |  | stalk | username* | 1/1 mock |
| `/api/stalk/roblox` | .robloxstalk | stalkroblox | stalk | user* | 1/1 mock |
| `/api/stalk/roblox-v2` | .roblox2 |  | stalk | user* | 1/1 mock |
| `/api/stalk/threads` | .stalkthreads |  | stalk | username* | 1/1 mock |
| `/api/stalk/tiktok` | .tiktokstalk | ttstalk | stalk | username* | 1/1 mock |
| `/api/stalk/tiktok-posts` | .tiktokposts |  | stalk | user* | 1/1 mock |
| `/api/stalk/tiktok-v2` | .stalktiktok2 |  | stalk | username* | 1/1 mock |
| `/api/stalk/twitter` | .twitterstalk |  | stalk | username* | 1/1 mock |
| `/api/stalk/youtube` | .ytstalk |  | stalk | username* | 1/1 mock |
| `/api/stalk/youtube-v2` | .stalkyoutube2 |  | stalk | username* | 1/1 mock |
| `/api/textpro/avengers` | .avengers |  | textpro | text1*, text2* | 1/1 mock |
| `/api/textpro/bear` | .bear |  | textpro | text* | 1/1 mock |
| `/api/textpro/blackpink` | .blackpink |  | textpro | text* | 1/1 mock |
| `/api/textpro/cartoon-graffiti` | .cartoongraffiti |  | textpro | text* | 1/1 mock |
| `/api/textpro/comic` | .comic |  | textpro | text* | 1/1 mock |
| `/api/textpro/devil-wings` | .devilwings |  | textpro | text* | 1/1 mock |
| `/api/textpro/dragonball` | .dragonball |  | textpro | text* | 1/1 mock |
| `/api/textpro/foggy-glass` | .foggyglass |  | textpro | text*, background | 1/1 mock |
| `/api/textpro/glitch` | .glitch |  | textpro | text* | 1/1 mock |
| `/api/textpro/graffiti` | .graffiti |  | textpro | text1*, text2* | 1/1 mock |
| `/api/textpro/graffiti-v2` | .graffiti2 |  | textpro | text* | 1/1 mock |
| `/api/textpro/marvel` | .marvel |  | textpro | text1*, text2*, background | 1/1 mock |
| `/api/textpro/mascot` | .mascot |  | textpro | text1*, text2*, style | 1/1 mock |
| `/api/textpro/naruto` | .naruto |  | textpro | text* | 1/1 mock |
| `/api/textpro/painting` | .painting |  | textpro | text1*, text2* | 1/1 mock |
| `/api/textpro/pavement` | .pavement |  | textpro | text* | 1/1 mock |
| `/api/textpro/pixel-glitch` | .pixelglitch |  | textpro | text* | 1/1 mock |
| `/api/textpro/typography` | .typography |  | textpro | text* | 1/1 mock |
| `/api/textpro/wetglass` | .wetglass |  | textpro | text* | 1/1 mock |
| `/api/textpro/wolf-galaxy` | .wolfgalaxy |  | textpro | text1*, text2* | 1/1 mock |
| `/api/textpro/write-graffiti` | .writegraffiti |  | textpro | text* | 1/1 mock |
| `/api/tools/alightmotion` | .alightmotion |  | tools | url* | 1/1 mock |
| `/api/tools/base642text` | .base642text |  | tools | base64* | 1/1 mock |
| `/api/tools/binary2text` | .binary2text |  | tools | binary* | 1/1 mock |
| `/api/tools/blurface` | .blurface |  | tools | url* | 1/1 mock |
| `/api/tools/compare-phone` | .comparephone |  | tools | phone1*, phone2* | 1/1 mock |
| `/api/tools/compress` | .compress | kompres | tools | url, quality | 1/1 mock |
| `/api/tools/convert` | .convert |  | tools | url, format | 1/1 mock |
| `/api/tools/convert-v2` | .convert2 |  | tools | url*, format | 1/1 mock |
| `/api/tools/countryinfo` | .countryinfo |  | tools | name* | 1/1 mock |
| `/api/tools/currency` | .kurs | currency | tools | amount, from, to | 1/1 mock |
| `/api/tools/dewatermark` | .dewatermark | hapuswm, removewm | tools | url* | 1/1 mock |
| `/api/tools/dns` | .dns |  | tools | domain*, type | 1/1 mock |
| `/api/tools/emojitogif` | .toolsemojitogif |  | tools | emoji* | 1/1 mock |
| `/api/tools/enhance` | .enhance |  | tools | url, brightness, saturation | 1/1 mock |
| `/api/tools/enhancer` | .enhancer |  | tools | url* | 1/1 mock |
| `/api/tools/font-interceptor` | .fontinterceptor |  | tools | url* | 1/1 mock |
| `/api/tools/github-roast` | .githubroast |  | tools | user* | 1/1 mock |
| `/api/tools/grammar-checker` | .grammarchecker |  | tools | text* | 1/1 mock |
| `/api/tools/grammar-checker-v2` | .grammarchecker2 |  | tools | text* | 1/1 mock |
| `/api/tools/iloveimg-crop` | .iloveimgcrop |  | tools | url, x, y, width, height | 1/1 mock |
| `/api/tools/iloveimg-rotate` | .iloveimgrotate |  | tools | url*, degrees | 1/1 mock |
| `/api/tools/image-ascii` | .imageascii |  | image | url*, width, color | 1/1 mock |
| `/api/tools/image-ascii-v2` | .imageascii2 |  | image | url* | 1/1 mock |
| `/api/tools/image-to-prompt` | .toprompt | imagetoprompt | tools | url*, model, language | 1/1 mock |
| `/api/tools/image-to-prompt-v2` | .imagetoprompt2 |  | tools | url* | 1/1 mock |
| `/api/tools/jawa` | .jawa |  | tools | text*, mode, from, to, direction | 1/1 mock |
| `/api/tools/kodepos` | .kodepos |  | tools | kota | 1/1 mock |
| `/api/tools/ocr` | .ocr |  | tools | url* | 1/1 mock |
| `/api/tools/ocr-v2` | .ocr2 |  | tools | url* | 1/1 mock |
| `/api/tools/ping` | .toolsping |  | tools |  | 1/1 mock |
| `/api/tools/removebg` | .removebg | rbg, nobg, hapusbg | tools | url* | 1/1 mock |
| `/api/tools/removebg-v2` | .removebg2 |  | tools | url* | 1/1 mock |
| `/api/tools/removevokal` | .removevokal |  | tools | url* | 1/1 mock |
| `/api/tools/resize` | .toolsresize |  | tools | url, width, height | 1/1 mock |
| `/api/tools/screenshot` | .ssweb | screenshot | tools | url*, width, height, device | 1/1 mock |
| `/api/tools/screenshot-v2` | .screenshot2 |  | tools | url*, width, height, device_scale | 1/1 mock |
| `/api/tools/shortlink` | .shortlink | shorturl | tools | url* | 1/1 mock |
| `/api/tools/skiplink` | .skiplink |  | tools | url* | 1/1 mock |
| `/api/tools/subdomainfinder` | .subdomainfinder |  | tools | domain* | 1/1 mock |
| `/api/tools/text-to-speech` | .tts | texttospeech | tools | text*, voice | 1/1 mock |
| `/api/tools/text2base64` | .text2base64 |  | tools | text* | 1/1 mock |
| `/api/tools/text2binary` | .text2binary |  | tools | text* | 1/1 mock |
| `/api/tools/text2qr` | .qr | qrcode, text2qr | tools | text* | 1/1 mock |
| `/api/tools/text2qr-v2` | .text2qr2 |  | tools | text* | 1/1 mock |
| `/api/tools/tiktokearnings` | .tiktokearnings |  | tools | username* | 1/1 mock |
| `/api/tools/tinyurl` | .tinyurl |  | tools | url* | 1/1 mock |
| `/api/tools/trackip` | .ipinfo | trackip | tools | target* | 1/1 mock |
| `/api/tools/translate` | .translate | tr, terjemah | tools | text*, source, target | 1/1 mock |
| `/api/tools/translate-v2` | .translate2 |  | tools | text*, target* | 1/1 mock |
| `/api/tools/upscale` | .upscale | hd, hdr | tools | url*, factor | 1/1 mock |
| `/api/tools/upscale-v2` | .upscale2 |  | tools | url* | 1/1 mock |
| `/api/tools/upscale-v3` | .upscale3 |  | tools | url*, resolusi* | 1/1 mock |
| `/api/tools/username-gen` | .usernamegen |  | tools | keyword*, mode, theme, word2 | 1/1 mock |
| `/api/tools/username-gen-v2` | .usernamegen2 |  | tools | keyword*, mode, theme | 1/1 mock |
| `/api/tools/vision` | .vision |  | tools | url*, mode, lang, question | 1/1 mock |
| `/api/tools/webphishing` | .webphishing |  | tools | url* | 1/1 mock |
| `/api/tools/webtozip` | .webtozip |  | tools | url* | 1/1 mock |
| `/api/tools/whatsmusic` | .whatmusic | whatmusik | tools | url* | 1/1 mock |
| `/api/tools/winrate-mlbb` | .winratemlbb |  | tools | total_match*, wr_now*, wr_target* | 1/1 mock |
| `/api/tools/youtube-summarize` | .ytsummarizer | ytsummary | tools | url* | 1/1 mock |
| `/api/tools/youtube-summarize-v2` | .youtubesummarize2 |  | tools | url* | 1/1 mock |
| `/api/tools/yt-transcribe` | .yttranscribe |  | tools | url* | 1/1 mock |
| `/api/top/myanimelist` | .topmyanimelist |  | search |  | 1/1 mock |
