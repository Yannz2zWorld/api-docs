'use strict';
// Error bertipe untuk seluruh YannAjahNew. `userMessage` aman ditampilkan ke pengguna WhatsApp,
// `message` untuk log (tetap tanpa secret).

class YannajahError extends Error {
  constructor(code, message, { userMessage, status, cause, details } = {}) {
    super(message);
    this.name = 'YannajahError';
    this.code = code;
    this.userMessage = userMessage || message;
    if (status) this.status = status;
    if (cause) this.cause = cause;
    if (details) this.details = details;
  }
}

const err = (code, message, opts) => new YannajahError(code, message, opts);

// Validasi input command: error yang pesannya langsung untuk pengguna.
class UsageError extends YannajahError {
  constructor(message) { super('USAGE', message, { userMessage: message }); this.name = 'UsageError'; }
}

module.exports = { YannajahError, UsageError, err };
