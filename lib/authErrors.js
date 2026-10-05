'use strict';
// Classifies Google Sign-In / database failures into stable, log-safe codes.
// google-auth-library embeds the raw ID token or its decoded payload (email, name)
// in several error messages, so err.message must never be logged or returned as-is.

const NETWORK_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNABORTED', 'EHOSTUNREACH', 'ENETUNREACH', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED']);

const VERIFY_REASONS = [
  [/^Wrong recipient/, 'AUDIENCE_MISMATCH'],
  [/^Token used too late/, 'TOKEN_EXPIRED'],
  [/^Token used too early/, 'TOKEN_NOT_YET_VALID'],
  [/^(Invalid token signature|No pem found)/, 'INVALID_SIGNATURE'],
  [/^Invalid issuer/, 'ISSUER_MISMATCH'],
  [/^(Wrong number of segments|Can't parse token|No issue time|No expiration time|Expiration time too far)/, 'MALFORMED_TOKEN'],
  [/^The verifyIdToken method requires an ID Token/, 'MISSING_TOKEN']
];

function classifyGoogleVerifyError(err) {
  const message = String(err?.message || '');
  const code = String(err?.code || '');
  if (NETWORK_CODES.has(code) || /^Failed to retrieve verification certificates/.test(message) || /^request to https:\/\/www\.googleapis\.com/.test(message)) {
    return { status: 503, error: 'GOOGLE_UNAVAILABLE', reason: 'GOOGLE_CERTS_UNAVAILABLE', code: code || null };
  }
  for (const [pattern, reason] of VERIFY_REASONS) {
    if (pattern.test(message)) return { status: 401, error: 'INVALID_CREDENTIAL', reason, code: null };
  }
  return { status: 401, error: 'INVALID_CREDENTIAL', reason: 'UNKNOWN_VERIFY_ERROR', code: code || null };
}

function classifyDatabaseError(err) {
  const code = String(err?.code || 'DATABASE_QUERY_FAILED');
  if (code === 'DATABASE_NOT_CONFIGURED') return { status: 503, error: 'DATABASE_NOT_CONFIGURED', code };
  // SQLSTATE class 42: undefined table/column/function -> migrations not applied to this database.
  if (/^42/.test(code)) return { status: 503, error: 'DATABASE_SCHEMA_OUTDATED', code };
  return { status: 503, error: 'DATABASE_UNAVAILABLE', code };
}

function missingAuthConfig(env = process.env) {
  return ['GOOGLE_CLIENT_ID', 'AUTH_SECRET'].filter(name => !String(env[name] || '').trim());
}

module.exports = { classifyGoogleVerifyError, classifyDatabaseError, missingAuthConfig };
