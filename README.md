DEPLOY CLUTCH API - VERCEL ATAU VPS

================================================================================
DEPLOY KE VERCEL (GRATIS)
================================================================================

CARA 1 - VIA GITHUB:

1. Push project ke GitHub

2. Login ke vercel.com pakai akun GitHub

3. Klik Add New > Project

4. Pilih repository, klik Import

5. Biarkan semua pengaturan default:
   - Framework Preset: Other
   - Root Directory: ./
   - Build settings: kosong

6. Klik Deploy

Selesai. Dapat domain gratis seperti: clutch-api.vercel.app
Setiap git push otomatis deploy ulang.

CARA 2 - VIA TERMINAL:

npm install -g vercel
vercel login
vercel
vercel --prod

================================================================================
DEPLOY KE VPS (UBUNTU/DEBIAN)
================================================================================

STEP 1 - PERSIAPAN SERVER:

sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git software-properties-common
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

STEP 2 - CLONE PROJECT:

cd /var/www
git clone <URL_REPO_ANDA> clutch-api
cd clutch-api
npm install

STEP 3 - PM2 (AGAR APLIKASI TETAP JALAN):

sudo npm install pm2 -g
pm2 start index.js --name "clutch-api"
pm2 startup
pm2 save

STEP 4 - NGINX REVERSE PROXY:

sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/clutch-api

Copy-paste ini (ganti domain_anda.com):

server {
    listen 80;
    server_name domain_anda.com www.domain_anda.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

sudo ln -s /etc/nginx/sites-available/clutch-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

STEP 5 - SSL GRATIS:

sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d domain_anda.com -d www.domain_anda.com

Ikuti instruksi, pilih redirect HTTP ke HTTPS.

================================================================================
CATATAN PENTING
================================================================================

- Jangan hardcode API key di file HTML atau client-side
- Selalu gunakan route /ai/gemini sebagai proxy server-side
- Untuk local testing: node index.js lalu buka http://localhost:3000

================================================================================
YANNZ API PLATFORM - DATABASE, AUTH, ENVIRONMENT
================================================================================

Database driver: @neondatabase/serverless (Neon PostgreSQL HTTP driver).

Required server environment variables (names only; see .env.example):
- DATABASE_URL (Neon pooled connection string; private)
- GOOGLE_CLIENT_ID (Web OAuth client ID; must be the same client the login page uses)
- GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL (only for the /auth/google redirect fallback)
- AUTH_SECRET (long random value, >= 32 characters; encrypts the session cookie)
- OWNER_EMAIL

Set these in Vercel Project Settings > Environment Variables for the Production
environment (and Preview if you test previews), then REDEPLOY: Vercel only applies
environment changes to new deployments. For local development copy .env.example to
.env. Never commit .env or send credentials in chat.

Missing variable NAMES are logged once at cold start:
`Server configuration incomplete; missing environment variables: ...`

## Authentication flow

Google Identity Services (views/login.html) -> `POST /auth/google/credential`
-> server verifies the ID token (signature, audience = GOOGLE_CLIENT_ID, issuer,
expiry) -> upsert `users` row -> AES-256-GCM encrypted `yannz_session` cookie
(HttpOnly, Secure, SameSite=Lax, 7 days) -> `/home`.

The server-side cookie is the only source of truth for login state; the login page
no longer has a client-side email/password form or sessionStorage flag. Protected
pages (`/home`, `/keys`, `/billing`, `/owner`) and `/auth/me` re-read the user
from PostgreSQL on each request, so banned/deleted users lose access immediately.
`POST /auth/logout` clears the cookie AND increments `users.session_version`, so
every cookie issued to that account (including a copied one) stops working; a ban
does the same. `GET /auth/google` is a redirect-based fallback when the Google
button script cannot load.

## Google Login troubleshooting

Every failure of `POST /auth/google/credential` returns a stable `error` code in
the JSON body (visible in the browser DevTools Network tab) and logs one line
`Google credential/login failed: {stage, ...}` in Vercel runtime logs. Tokens,
emails, and secrets are never logged.

| HTTP | error                     | stage    | Meaning / fix |
|------|---------------------------|----------|---------------|
| 503  | DATABASE_SCHEMA_OUTDATED  | database | Migrations not applied (log `code` 42703 = missing column, 42P01 = missing table). Run migrations 001-004 in order. |
| 503  | DATABASE_NOT_CONFIGURED   | database | DATABASE_URL missing in this Vercel environment. Add it and redeploy. |
| 503  | DATABASE_UNAVAILABLE      | database | Neon unreachable / bad credentials / suspended project. Check Neon dashboard and the connection string. |
| 503  | AUTH_NOT_CONFIGURED       | config   | GOOGLE_CLIENT_ID or AUTH_SECRET missing (log lists which). |
| 503  | GOOGLE_UNAVAILABLE        | verify   | Server could not download Google signing certificates. Retry; check outbound network. |
| 401  | INVALID_CREDENTIAL        | verify   | Log `reason`: AUDIENCE_MISMATCH (GOOGLE_CLIENT_ID differs from the client the page used), TOKEN_EXPIRED / TOKEN_NOT_YET_VALID (clock), INVALID_SIGNATURE, ISSUER_MISMATCH, MALFORMED_TOKEN. |
| 403  | EMAIL_NOT_VERIFIED        | profile  | Google account email is not verified. |
| 403  | ACCOUNT_RESTRICTED        | -        | User is banned/pending in `users.status`. |
| 403  | CSRF_BLOCKED              | origin   | Request came from another origin. |

`GET /health/database` checks connectivity AND schema:
- 200 `{"database":"connected","schema":"ok"}`
- 503 `{"database":"connected","schema":"migration_required","missing":[...]}`
- 503 `{"database":"disconnected","error":"DATABASE_NOT_CONFIGURED|DATABASE_UNAVAILABLE"}`

Google Cloud Console checklist (OAuth 2.0 Client ID, type "Web application"):
- Authorized JavaScript origins: https://apiz2z.vercel.app (and http://localhost:3000 for local dev)
- Authorized redirect URIs: https://apiz2z.vercel.app/auth/google/callback
- The Client ID shown there must equal GOOGLE_CLIENT_ID in Vercel Production.

## Install, migration and deploy order

1. `npm install`
2. Take a Neon backup/branch and inspect the existing `users` table (`users.id` must be uuid).
3. Apply, in order, in the Neon SQL Editor: `migrations/001_users.sql`, `002_platform.sql`,
   `003_backfill_columns.sql`, `004_payments_amount.sql`, `005_integrity.sql`, `006_password_auth.sql`.
   All are idempotent and additive (no DROP, no data rewrite). 005 prints a WARNING
   (not an error) for any constraint it skips because existing rows do not comply.
4. **Run 005 BEFORE deploying this version.** The code reads `users.session_version`
   and the new `payments` gateway columns; without them login answers
   `503 DATABASE_SCHEMA_OUTDATED`. 005 is safe for the previous code version too.
5. `GET /health/database` must return `{"database":"connected","schema":"ok"}`; it also
   checks the unique indexes `ON CONFLICT` relies on (reported as `unique:table(cols)`).
6. Configure secrets only in Vercel environment settings, deploy a preview, verify, promote.

Local commands:
  npm install
  npm run lint
  npm test                     # unit tests; integration tests skip without a database
  TEST_DATABASE_URL=postgresql://user@host/db npm run test:integration

Integration tests (tests/integration) run the real app against a disposable
PostgreSQL: each file creates and drops its own schema. Never point
TEST_DATABASE_URL at production. Google tokens are real RS256 JWTs verified by
google-auth-library (only the certificate download is stubbed); Pakasir HTTP calls
are stubbed.

## Email + password login (IMPLEMENTED; email delivery CONFIGURED only when env is set)

Login page tabs: **Masuk** (email + password, or Google) and **Daftar** (name, email, password).
- Passwords: scrypt (N=2^17, r=8, p=1, random salt), min 8 chars with letters and digits; never
  stored or logged in plaintext. 10 wrong passwords lock the account for 15 minutes.
- Registration requires email verification: a 6-digit code is emailed; password login answers
  `403 EMAIL_NOT_VERIFIED` until verified. This also prevents pre-registering someone else's email
  (including OWNER_EMAIL). If a Google login claims an address whose password was never verified,
  that password and its sessions are removed.
- Lupa sandi: `POST /auth/password/forgot` always answers the same message (no account
  enumeration) and emails a reset code; `POST /auth/password/reset` sets the new password,
  verifies the email and signs out every other session. Google-only accounts can add a password
  this way.
- Codes: 6 digits, stored as an HMAC, valid 15 minutes, single use, 5 wrong guesses burn the code,
  resend cooldown 60 s, max 5 codes per hour.
- Endpoints: `/auth/register`, `/auth/email/verify`, `/auth/email/resend`, `/auth/login`,
  `/auth/password/forgot`, `/auth/password/reset` (same-origin only, per-IP rate limited).

Email is sent with the sender name **YannApi** from `EMAIL_FROM`, through one provider:
- SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_SECURE`). Gmail:
  `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`/`EMAIL_FROM` = the Gmail address,
  `SMTP_PASS` = a Google **App Password** (requires 2-Step Verification), not the account password.
- Resend (`RESEND_API_KEY`); `EMAIL_FROM` must be on a domain verified in Resend.
Without a provider, register/forgot answer `503 EMAIL_NOT_CONFIGURED` (no account is created and
nothing is claimed as sent). The owner panel Status tab shows which provider is active.

## Tiers (IMPLEMENTED, server-side: services/tierService.js, public: GET /api/tiers)

| Tier   | Price    | Requests/day | Custom API keys | Access |
|--------|----------|--------------|-----------------|--------|
| FREE   | Rp0      | 100          | 0 (use Sandbox with login) | endpoints with minimum tier FREE |
| SULTAN | Rp5.000  | 1.000        | 2               | all active endpoints up to SULTAN |
| SEPUH  | Rp10.000 | 10.000       | 3               | up to SEPUH |
| DEWA   | Rp25.000 | 100.000      | unlimited       | up to DEWA |
| OWNER  | not sold | unlimited    | unlimited       | everything, incl. locked endpoints |

OWNER is decided only by `OWNER_EMAIL` (case-insensitive). A `users.tier='OWNER'`
value never grants owner rights (it is treated as FREE), and the owner panel
cannot assign OWNER. Paid tiers are permanent until the owner changes them (no
expiry/renewal is implemented). Downgrading a user does not revoke keys above
the new cap; those keys keep working with the lower tier's quota.

## Daily quota (IMPLEMENTED)

- Enforced in PostgreSQL per user per UTC day (`daily_quota_counters`), shared by
  session and API-key calls. Reset is automatic at 00:00 UTC (new row per date).
- Atomic reservation (`INSERT ... ON CONFLICT DO UPDATE ... WHERE count < limit`):
  concurrent requests cannot overrun the limit (tested: 30 parallel at 990/1000 -> 10 pass).
- Only successful calls count. Auth/authorization failures (INVALID_API_KEY,
  API_KEY_REVOKED, AUTH_REQUIRED, CSRF_BLOCKED, TIER_RESTRICTED, ENDPOINT_LOCKED,
  MAINTENANCE) are rejected before reserving; a reserved call whose handler answers
  >= 400 (bad parameter, UPSTREAM_FAILED) is refunded before the response is sent.
- Responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`;
  `429 QUOTA_EXCEEDED` adds `Retry-After`, `used`, `limit`, `resetAt`.
- The per-IP limiter (`RATE_LIMIT_PER_MINUTE`, default 150; auth routes
  `AUTH_RATE_LIMIT_PER_15MIN`, default 20) is in-memory per serverless instance:
  best-effort abuse damping only, not a quota.

## API keys (IMPLEMENTED)

- `yannz_live_` + 32 random bytes; only a SHA-256 hash and a short display prefix are
  stored; plaintext is returned once at creation.
- Send `Authorization: Bearer <key>` or `x-api-key: <key>`. Query-string keys are not accepted.
- Caps per tier are enforced in a transaction with a per-user lock (no race).
- Revoked keys fail immediately with `401 API_KEY_REVOKED`; unknown keys `401 INVALID_API_KEY`.
  A presented-but-bad key never falls back to the cookie session.
- Keys are scoped to their owner: other users get 404 on revoke and never see them.
- `GET /api/tools/ping` checks a key/session and shows the remaining quota (no upstream call).

## Endpoint access control (IMPLEMENTED)

Order of checks for every plugin route: authentication -> endpoint `status`
(`disabled` -> `404 ENDPOINT_UNAVAILABLE`, for everyone) -> `locked`
(`403 ENDPOINT_LOCKED`, OWNER bypasses) -> `minimum_tier` (`403 TIER_RESTRICTED`;
`OWNER` minimum = owner-only) -> maintenance (`503 MAINTENANCE`, OWNER bypasses) -> quota.
The handler runs only after all checks pass.

Session (cookie) access works for any tier from the site's own pages: the browser
must send `X-Yannz-Client` and must not be `Sec-Fetch-Site: cross-site`. This blocks
cross-site links/forms from spending a logged-in user's quota (SameSite=Lax still
sends the cookie on top-level GET navigations). Integrations use API keys.

The endpoint registry (owner panel) is metadata only. A path executes only if a
plugin in `plugin/` handles it (`handler_loaded`); metadata for a live handler
cannot be deleted (disable or lock it instead). No dynamic code execution exists.

## Owner panel (IMPLEMENTED, /owner)

Status (DB/schema, env presence without values, payment and notification
configuration, plugin vs registry), dashboard stats, users (search/filter, detail
with 14-day usage, keys, orders; ban/unban/approve/tier change/key revoke/delete),
endpoints (tier, lock, enable/disable, metadata create/delete), payments
(filter, approve/reject manual payments), maintenance, audit log, JSON backup.
Every owner route is authorized server-side (`OWNER_REQUIRED`), state-changing
routes are same-origin only, destructive UI actions require confirmation (user
delete requires typing the email). The owner account cannot be banned, demoted
or deleted from the panel.

## Billing and payments

Orders: `POST /api/orders` with `{tier}`; the amount always comes from the tier
table (client amounts ignored), only upgrades are allowed, at most 5 pending orders
per user, optional `Idempotency-Key`. Orders expire after 2 hours unless a manual
proof is waiting for review. States: order `pending|paid|rejected|expired`, payment
`pending|paid|rejected|expired`.

Manual payment (IMPLEMENTED): the user submits method + HTTPS proof URL
(`PAYMENT_PENDING`, one pending proof per order); the owner approves (tier upgrade,
once, audited) or rejects. Approval is idempotent (`409 PAYMENT_NOT_PENDING` on a
second decision). LIMITATION: no file upload/object storage; the proof is a
user-supplied HTTPS link the owner must check.

Pakasir (IMPLEMENTED, NOT VERIFIED against the live provider): transaction creation
uses `PAKASIR_PROJECT` + `PAKASIR_API_KEY`; the payment link/VA/QR is stored and
shown on /billing. Creating a payment never marks it paid. The webhook
(`POST /webhooks/pakasir`) checks project, `completed` status, order code and amount
against the database, then requires a server-side provider lookup via
`PAKASIR_V2_VERIFY_URL` (template with `{project}`, `{order_id}`, `{amount}`).
Without that variable automatic settlement is DISABLED (fail-closed, `202
PAYMENT_NOT_VERIFIED`). Settlement is idempotent: replays and concurrent duplicates
upgrade once (`duplicate: true`). The official Pakasir verification endpoint could
not be confirmed from the development environment, so no URL is shipped; configure
it only from Pakasir's official documentation and test it with a sandbox payment.

WhatsApp notification: NOT CONFIGURED. `services/ownerNotificationService.js` is an
adapter with no provider; it reports `not_configured` and never claims delivery.

## Error contract

Responses use `{success:false, error:<CODE>, message}`. Codes: AUTH_REQUIRED,
INVALID_CREDENTIAL, INVALID_API_KEY, API_KEY_REVOKED, ACCOUNT_RESTRICTED,
CSRF_BLOCKED, QUOTA_EXCEEDED, TIER_RESTRICTED, ENDPOINT_LOCKED,
ENDPOINT_UNAVAILABLE, MAINTENANCE, UPSTREAM_FAILED, OWNER_REQUIRED, KEY_LIMIT,
KEYS_NOT_INCLUDED, INVALID_TIER, TIER_NOT_UPGRADE, TOO_MANY_PENDING_ORDERS,
PAYMENT_PENDING (status), PAYMENT_NOT_VERIFIED, PAYMENT_NOT_PENDING,
PAYMENT_NOT_CONFIGURED, INVALID_PAYMENT, INVALID_PROOF_URL, NOT_FOUND,
INVALID_JSON, DATABASE_UNAVAILABLE, DATABASE_SCHEMA_OUTDATED. SQL errors and stack
traces are never returned; logs contain codes/stages only (no tokens, keys,
cookies or secrets).

## Routes

- `GET /health`, `GET /health/database`, `GET /auth/config`, `GET /auth/me`, `POST /auth/logout`
- `POST /auth/google/credential`, `GET /auth/google`, `GET /auth/google/callback`
- `GET /api/tiers`, `GET /api/endpoints`, `GET /api/stats`, `GET /api/tools/ping`
- Pages: `/`, `/home`, `/api` (Sandbox), `/api/playground`, `/pricing`, `/keys`, `/billing`, `/owner`
- `GET /usage`, `GET /api/dashboard`
- `GET|POST /api/keys`, `DELETE /api/keys/:id`, `POST /api/keys/:id/revoke`
- `GET|POST /api/orders`, `POST /api/orders/:id/pakasir`, `POST /api/orders/:id/manual`
- Owner: `/owner/status`, `/owner/dashboard`, `/owner/users[/:id]` (+ ban, unban,
  approve, tier, delete, keys/:keyId/revoke), `/owner/api/endpoints[/:id]` (+ lock,
  unlock), `/owner/payments` (+ approve, reject), `/owner/server`, `/owner/audit`, `/owner/backup`
- `POST /webhooks/pakasir`

## Verification status

- IMPLEMENTED and VERIFIED locally (PostgreSQL 16, Chromium): everything above
  except where marked otherwise. `npm test` with TEST_DATABASE_URL: all pass.
- NOT VERIFIED in production: Google login end-to-end on apiz2z.vercel.app, Vercel
  build/runtime logs, Neon production data shape beyond the health check, Pakasir
  live/sandbox payments and webhook, any WhatsApp delivery.
- NOT CONFIGURED: WhatsApp provider, object storage for proofs, Pakasir verification URL,
  email provider (until EMAIL_FROM + SMTP_* or RESEND_API_KEY are set).
- Email delivery was verified locally against a test SMTP server and a stubbed Resend API;
  real delivery to inboxes (spam placement, Gmail limits) is NOT VERIFIED.

## Smoke checks after deploy

- `GET /health` -> `{"status":"ok"}`; `GET /health/database` -> `schema: ok`.
- `GET /auth/me` signed out -> 401; after Google login -> user plus usage/key limits.
- `/api` signed in as FREE: run "Ping" without a key -> 200, quota decreases by 1.
- `/keys` as a paid user: create a key, `curl -H "Authorization: Bearer <key>" /api/tools/ping`, revoke it, repeat -> 401 API_KEY_REVOKED.
- `/owner` -> Status tab shows schema ok and the expected configuration; non-owners get 403.
- Logout, then reuse the old cookie (e.g. another browser) -> /auth/me 401.
