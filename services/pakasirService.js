'use strict';
// Pakasir payment gateway, API v2 (https://pakasir.com/p/create-transaction; v1 stops 20 Oct 2026).
//   create  POST /api/v2/create-transaction/{slug}/{order_id}   body {method, amount}   → txn_id, qr_string
//   status  GET  /api/v2/transaction-status/{slug}/{txn_id}                             → status pending|completed|canceled
//   cancel  POST /api/v2/cancel-transaction/{slug}/{txn_id}
//   fee     GET  /api/v2/payment-fee/{amount}                    (public)
// Every call authenticates with the X-Api-Key header. A payment is only treated as paid after the
// status API says "completed" for the same order and amount; the webhook body is never trusted alone.
//
// Config (Vercel env): PAKASIR_PROJECT (slug), PAKASIR_API_KEY, PAYMENT_GATEWAY=on to switch it on,
// PAKASIR_WEBHOOK_SECRET (the project's X-Secret), PAKASIR_SANDBOX=on to accept sandbox payments
// while testing.
const crypto = require('crypto');
const axios = require('axios');

// QRIS only: bank Virtual Accounts are not offered, and payment_link (Pakasir's own page) is left
// out so payments stay on this site.
const METHODS = ['qris'];
const MINIMUM = { qris: 500 };
const MAXIMUM = { qris: 10000000 };
const LABEL = { qris: 'QRIS' };
const TIMEOUT_MS = 15000;

const base = () => (process.env.PAKASIR_BASE_URL || 'https://app.pakasir.com').replace(/\/+$/, '');
const slug = () => encodeURIComponent(process.env.PAKASIR_PROJECT || '');
const headers = () => ({ 'X-Api-Key': process.env.PAKASIR_API_KEY || '', Accept: 'application/json' });
const fail = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });

function isConfigured() { return Boolean(process.env.PAKASIR_PROJECT && process.env.PAKASIR_API_KEY); }
// The gateway is off ("maintenance") until PAYMENT_GATEWAY=on is set, even with the keys present;
// manual payments (QRIS image, DANA, GoPay + proof) keep working.
function isEnabled() { return isConfigured() && /^(on|true|1)$/i.test(String(process.env.PAYMENT_GATEWAY || '').trim()); }
// v2 has a status API, so every gateway payment is confirmed server-side before it counts.
function isVerificationConfigured() { return isConfigured(); }
const sandboxAllowed = () => /^(on|true|1)$/i.test(String(process.env.PAKASIR_SANDBOX || '').trim());

function checkAmount(method, amount) {
  if (!METHODS.includes(method)) throw fail('INVALID_PAYMENT_METHOD', 'Metode pembayaran ini nggak didukung.');
  const n = Number(amount);
  if (!Number.isInteger(n) || n < MINIMUM[method]) throw fail('INVALID_PAYMENT_AMOUNT', `Minimal pembayaran ${LABEL[method]} Rp${MINIMUM[method].toLocaleString('id-ID')}.`);
  if (MAXIMUM[method] && n > MAXIMUM[method]) throw fail('INVALID_PAYMENT_AMOUNT', `Maksimal pembayaran ${LABEL[method]} Rp${MAXIMUM[method].toLocaleString('id-ID')}.`);
  return n;
}

// "Find or create": the same order id, method and amount always return the same transaction.
async function createTransaction(orderId, method, amount) {
  const n = checkAmount(method, amount);
  if (!isConfigured()) throw fail('PAYMENT_NOT_CONFIGURED', 'Payment gateway belum diatur.');
  const url = `${base()}/api/v2/create-transaction/${slug()}/${encodeURIComponent(orderId)}`;
  const { data } = await axios.post(url, { method, amount: n }, { headers: headers(), timeout: TIMEOUT_MS });
  const t = data?.transaction || data?.payment || data?.data || data || {};
  return {
    txn_id: t.txn_id ? String(t.txn_id) : null,
    order_id: String(t.order_id || orderId),
    amount: Number(t.amount || n),
    fee: Number(t.fee || 0),
    total_payment: Number(t.total_payment || n),
    payment_method: t.payment_method || method,
    qr_string: t.qr_string || t.payment_number || null,
    expired_at: t.expired_at || null,
    is_sandbox: t.is_sandbox === true
  };
}

async function getStatus(txnId) {
  if (!isConfigured()) throw fail('PAYMENT_NOT_CONFIGURED', 'Payment gateway belum diatur.');
  const { data } = await axios.get(`${base()}/api/v2/transaction-status/${slug()}/${encodeURIComponent(txnId)}`, { headers: headers(), timeout: TIMEOUT_MS });
  const t = data?.transaction || data?.data || data || {};
  return { txn_id: String(t.txn_id || txnId), order_id: String(t.order_id || ''), amount: Number(t.amount), status: String(t.status || '').toLowerCase(), is_sandbox: t.is_sandbox === true, completed_at: t.completed_at || null };
}

async function cancelTransaction(txnId) {
  if (!isConfigured() || !txnId) return false;
  try {
    await axios.post(`${base()}/api/v2/cancel-transaction/${slug()}/${encodeURIComponent(txnId)}`, {}, { headers: headers(), timeout: TIMEOUT_MS });
    return true;
  } catch { return false; }   // best effort: Pakasir cancels unpaid transactions after 24 hours anyway
}

// Paid only when Pakasir itself says so, for this exact order and amount (and not a sandbox payment
// unless sandbox testing is switched on).
async function verifyTransaction({ txnId, orderId, amount }) {
  if (!txnId) return { paid: false, status: 'unknown' };
  const s = await getStatus(txnId);
  const paid = s.status === 'completed' && s.order_id === String(orderId) && Number(s.amount) === Number(amount) && (!s.is_sandbox || sandboxAllowed());
  return { paid, status: s.status, sandbox: s.is_sandbox, completedAt: s.completed_at };
}

// The webhook's X-Secret header (set in the Pakasir project page). Without a configured secret
// every webhook still has to pass the status API check.
function webhookSecretOk(given) {
  const want = process.env.PAKASIR_WEBHOOK_SECRET || '';
  if (!want) return true;
  const a = Buffer.from(String(given || '')), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Developer panel check: is Pakasir reachable, and do the slug and key work?
async function check() {
  const out = { configured: isConfigured(), enabled: isEnabled(), webhookSecret: Boolean(process.env.PAKASIR_WEBHOOK_SECRET), sandbox: sandboxAllowed() };
  if (!out.configured) return { ...out, ok: false, message: 'Isi PAKASIR_PROJECT dan PAKASIR_API_KEY di Vercel dulu.' };
  try {
    await axios.get(`${base()}/api/v2/transaction-status/${slug()}/yannz-check-${Date.now()}`, { headers: headers(), timeout: TIMEOUT_MS });
    return { ...out, ok: true, message: 'Pakasir nyambung, slug dan API key diterima.' };
  } catch (e) {
    const status = e?.response?.status || null;
    if (status === 401 || status === 403) return { ...out, ok: false, status, message: 'API key Pakasir ditolak. Cek PAKASIR_API_KEY dan slug proyek (PAKASIR_PROJECT).' };
    if (status && status < 500) return { ...out, ok: true, status, message: 'Pakasir nyambung, slug dan API key diterima.' };   // e.g. 404 for the made-up transaction
    return { ...out, ok: false, status, message: 'Nggak bisa nyambung ke Pakasir. Coba lagi nanti.' };
  }
}

module.exports = { METHODS, MINIMUM, LABEL, createTransaction, getStatus, cancelTransaction, verifyTransaction, webhookSecretOk, check, isConfigured, isEnabled, isVerificationConfigured, sandboxAllowed };
