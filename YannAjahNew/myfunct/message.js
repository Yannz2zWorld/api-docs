'use strict';
// Serializer pesan (pengganti myfunct/message.js base): mengubah WAMessage Baileys menjadi objek `m`
// yang dipakai router & plugin. Baileys 7 memakai LID; pengirim di-resolve ke nomor telepon (PN) lewat
// key.participantAlt / key.remoteJidAlt atau data participant grup, supaya cek owner/premium konsisten.

const { jidUser } = require('../library/function');

const PREFIX_CHARS = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©/\\-]/;

function textOf(msg) {
  if (!msg) return '';
  return msg.conversation
    || msg.extendedTextMessage?.text
    || msg.imageMessage?.caption
    || msg.videoMessage?.caption
    || msg.documentMessage?.caption
    || msg.documentWithCaptionMessage?.message?.documentMessage?.caption
    || msg.buttonsResponseMessage?.selectedButtonId
    || msg.listResponseMessage?.singleSelectReply?.selectedRowId
    || msg.templateButtonReplyMessage?.selectedId
    || interactiveId(msg)
    || '';
}

function interactiveId(msg) {
  const p = msg?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (!p) return '';
  try { return String(JSON.parse(p).id || ''); } catch { return ''; }
}

const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'];

function mediaOf(msg, B) {
  const type = B.getContentType(msg);
  const content = type ? msg[type] : null;
  if (type && MEDIA_TYPES.includes(type)) return { type, content, mime: content?.mimetype || '' };
  if (type === 'documentWithCaptionMessage') return { type: 'documentMessage', content: msg.documentWithCaptionMessage.message.documentMessage, mime: msg.documentWithCaptionMessage.message.documentMessage?.mimetype || '' };
  return null;
}

// Prefix & command dari teks. prefixes = daftar prefix aktif; allowNoPrefix untuk mode tanpa prefix.
function parseCommand(body, { prefixes, allowNoPrefix = false }) {
  const text = String(body || '').trim();
  if (!text) return { isCmd: false };
  let prefix = prefixes.find(p => text.startsWith(p));
  if (!prefix && allowNoPrefix) prefix = '';
  if (prefix === undefined) return { isCmd: false };
  const rest = text.slice(prefix.length).trim();
  if (!rest || (prefix === '' && PREFIX_CHARS.test(rest))) return { isCmd: false };
  const [command, ...args] = rest.split(/\s+/);
  return { isCmd: true, prefix, command: command.toLowerCase(), args, text: rest.slice(command.length).trim() };
}

async function resolvePn(jid, alt, metadata) {
  if (alt && String(alt).endsWith('@s.whatsapp.net')) return alt;
  if (jid && String(jid).endsWith('@s.whatsapp.net')) return jid;
  const p = metadata?.participants?.find(x => x.id === jid || x.lid === jid);
  if (p?.phoneNumber) return p.phoneNumber;
  if (p?.id?.endsWith('@s.whatsapp.net')) return p.id;
  return jid;   // tidak bisa di-resolve: tetap LID (cek owner berbasis nomor akan gagal = aman)
}

async function serialize(conn, raw, { B, groupMetadata, prefixes, allowNoPrefix }) {
  const key = raw.key || {};
  const message = B.normalizeMessageContent(raw.message) || {};
  const chat = key.remoteJid;
  const isGroup = String(chat).endsWith('@g.us');
  const meta = isGroup ? await groupMetadata(chat).catch(() => null) : null;
  const botPn = conn.user?.id ? `${jidUser(conn.user.id)}@s.whatsapp.net` : null;
  const senderRaw = key.fromMe ? botPn : isGroup ? key.participant : chat;
  const sender = key.fromMe ? botPn : await resolvePn(senderRaw, isGroup ? key.participantAlt : key.remoteJidAlt, meta);

  const body = textOf(message);
  const media = mediaOf(message, B);
  const ctxInfo = message[B.getContentType(message)]?.contextInfo || null;
  const parsed = parseCommand(body, { prefixes, allowNoPrefix });

  const isAdminJid = jid => Boolean(meta?.participants?.some(p => (p.id === jid || p.phoneNumber === jid || p.lid === jid) && (p.admin === 'admin' || p.admin === 'superadmin')));
  const m = {
    key, id: key.id, chat, isGroup, fromMe: Boolean(key.fromMe), sender, senderRaw,
    senderNumber: jidUser(sender), pushName: raw.pushName || 'User',
    message, type: B.getContentType(message), body, text: body,
    ...parsed,
    mentionedJid: ctxInfo?.mentionedJid || [],
    isMedia: Boolean(media), mime: media?.mime || '', mediaType: media?.type || null,
    timestamp: Number(raw.messageTimestamp?.low ?? raw.messageTimestamp ?? 0),
    groupMetadata: meta,
    isAdmin: isGroup ? isAdminJid(senderRaw) || isAdminJid(sender) : false,
    isBotAdmin: isGroup ? isAdminJid(botPn) || isAdminJid(conn.user?.lid ? `${jidUser(conn.user.lid)}@lid` : '') : false,
    isBaileys: Boolean(key.id && /^(BAE5|3EB0|B1E|BAE)/.test(key.id) && key.fromMe),
    raw
  };

  if (ctxInfo?.quotedMessage) {
    const qmsg = B.normalizeMessageContent(ctxInfo.quotedMessage);
    const qmedia = mediaOf(qmsg, B);
    const qsenderRaw = ctxInfo.participant || chat;
    m.quoted = {
      key: { remoteJid: chat, id: ctxInfo.stanzaId, participant: ctxInfo.participant, fromMe: qsenderRaw === botPn },
      id: ctxInfo.stanzaId, message: qmsg, type: B.getContentType(qmsg), text: textOf(qmsg),
      sender: await resolvePn(qsenderRaw, null, meta), senderRaw: qsenderRaw,
      isMedia: Boolean(qmedia), mime: qmedia?.mime || '', mediaType: qmedia?.type || null,
      download: () => B.downloadMediaMessage({ key: { remoteJid: chat, id: ctxInfo.stanzaId, participant: ctxInfo.participant }, message: qmsg }, 'buffer', {}, { reuploadRequest: conn.updateMediaMessage })
    };
  } else m.quoted = null;

  m.download = () => B.downloadMediaMessage({ key, message }, 'buffer', {}, { reuploadRequest: conn.updateMediaMessage });
  // Media dari pesan ini atau yang di-reply (pola umum: reply gambar + .command)
  m.getMedia = () => (m.isMedia ? { mime: m.mime, type: m.mediaType, download: m.download } : m.quoted?.isMedia ? { mime: m.quoted.mime, type: m.quoted.mediaType, download: m.quoted.download } : null);
  return m;
}

module.exports = { serialize, parseCommand, textOf, resolvePn, PREFIX_CHARS };
