'use strict';
// Shim kompatibilitas: plugin lama base/V15 membaca global.owner, global.mess, global.botname, dst.
// Konfigurasi asli ada di settingsbot.js; file ini hanya memetakan nilai NON-RAHASIA ke global.
// API key tidak pernah diekspos ke global.

const { loadConfig } = require('./library/config-loader');

function applyLegacyGlobals(cfg = loadConfig()) {
  Object.assign(global, {
    owner: cfg.owner.number,
    owners: cfg.owner.extra,
    namaOwner: cfg.owner.name,
    versi: cfg.bot.version,
    botname: cfg.bot.name,
    botname2: cfg.bot.name2,
    packname: cfg.bot.packname,
    author: cfg.bot.author,
    linkOwner: cfg.links.owner,
    linkGrup: cfg.links.group,
    linkSaluran: cfg.links.channel,
    idSaluran: cfg.links.channelId,
    namaSaluran: cfg.links.channelName,
    image: { ...cfg.image },
    mess: { ...cfg.mess },
    limitHarian: cfg.limit.daily,
    warnGrup: cfg.limit.warnBeforeKick,
    harga: { ...cfg.harga },
    sewa: { ...cfg.sewa },
    delayJpm: cfg.delay.jpm,
    tempatDB: cfg.database.file
  });
  return cfg;
}

module.exports = { applyLegacyGlobals };
