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
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
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
- Node.js 20 atau lebih baru (Vercel project memakai 24.x)
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
   `003_backfill_columns.sql`, `004_payments_amount.sql`, `005_integrity.sql`, `006_password_auth.sql`,
   `007_billing_custom_keys.sql`, `008_legacy_constraints.sql`.
   All are idempotent and additive (no DROP, no data rewrite). 005 prints a WARNING
   (not an error) for any constraint it skips because existing rows do not comply.
4. **Run 005 BEFORE deploying this version.** The code reads `users.session_version`
   and the new `payments` gateway columns; without them login answers
   `503 DATABASE_SCHEMA_OUTDATED`. 005 is safe for the previous code version too.
   **Run 007 before (or right after) deploying the billing/custom-key version.** Login,
   sessions, existing keys and the gateway keep working without 007 (tested), but tier
   durations, proof uploads, custom keys and payment settings need it.
   **008** matters when `orders`/`payments` existed before 002 (production): it drops only
   legacy CHECK constraints that reject values the app writes (symptom: billing shows
   `DATABASE_UNAVAILABLE · 23514`, e.g. when an expired order is marked `expired`).
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

Prices are per 30 days. OWNER is decided only by `OWNER_EMAIL` (case-insensitive).
A `users.tier='OWNER'` value never grants owner rights (it is treated as FREE), and
the owner panel cannot assign OWNER.

Durations (IMPLEMENTED, migration 007): a purchase lasts 7–365 days (default 30) and
costs `ceil(price × days / 30)` rounded up to Rp100 (e.g. SULTAN 7 days Rp1.200, 1 year
Rp60.900). When the payment is approved the tier gets `users.tier_expires_at`:
- buying a higher tier than the current (unexpired) one: switch now, expiry = now + days
  (remaining time on the old tier is not carried over);
- buying the same tier: the expiry is extended from max(expiry, now);
- an older cheaper order approved later never downgrades.
After `tier_expires_at` the account is treated as FREE everywhere (sessions, API keys,
quota, key cap) without any job. Tiers granted before migration 007 or set by the owner
without a duration have no expiry. Downgrading/expiry does not revoke keys above the new
cap; they keep working with the lower tier's quota.

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

- Generated keys: `yannz_live_` + 32 random bytes.
- Custom keys (IMPLEMENTED, migration 007): paid users may choose the key value itself,
  e.g. `Yannz2z` (`custom_key` in `POST /api/keys`; 6–64 characters `A-Z a-z 0-9 _ -`,
  case-sensitive, the `yannz_live_` prefix is reserved). Values are unique across all
  users and never reusable, even after revocation (`409 CUSTOM_KEY_TAKEN`). Only the
  first 3 characters are shown afterwards. A short value is easier to guess than a
  generated key; the page says so. Max 20 custom-value attempts per account per hour.
- Only a SHA-256 hash and a short display prefix are stored; plaintext is returned once.
- Guessing protection: 30 invalid keys from one IP within 15 minutes block key
  authentication from that IP for the rest of the window (`429 TOO_MANY_INVALID_KEYS`,
  stored in `api_key_failures`; tune with `INVALID_KEY_LIMIT_PER_15MIN`). Logged-in
  sandbox use is unaffected.
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
(filter, proof image preview, approve/reject manual and QRIS-gateway payments),
server settings (maintenance, DANA/GoPay destination accounts, Telegram status), audit
log, JSON backup. Tier changes can carry a duration in days (empty = permanent).
Every owner route is authorized server-side (`OWNER_REQUIRED`), state-changing
routes are same-origin only, destructive UI actions require confirmation (user
delete requires typing the email). The owner account cannot be banned, demoted
or deleted from the panel.

## Billing and payments

Flow on /billing: pick tier -> duration (7, 14, 30, 90, 180, 365 days or custom 7–365;
default 30) -> payment method -> pay. `POST /api/orders` takes `{tier, duration_days}`;
the amount always comes from the server (client amounts ignored); only upgrades or
same-tier extensions are allowed, at most 5 pending orders per user, optional
`Idempotency-Key`. Orders expire after 2 hours unless a manual proof is waiting for
review. States: order `pending|paid|rejected|expired`, payment `pending|paid|rejected|expired`.

Payment methods:
| Method | How | Settles |
|---|---|---|
| QRIS otomatis | Pakasir transaction; the QR payload is rendered as an image by `/api/orders/:id/qr.svg` | webhook + provider lookup (if `PAKASIR_V2_VERIFY_URL` is set), or owner approval |
| QRIS manual | the owner's static QRIS (`views/assets/qris-manual.jpg`); buyer enters the exact amount | owner approval |
| DANA | transfer to the number set in Owner > Server & Pembayaran | owner approval |
| GoPay | same, GoPay number | owner approval |
DANA/GoPay are hidden until the owner sets a number. QRIS gateway is hidden without
`PAKASIR_PROJECT` + `PAKASIR_API_KEY`.

Manual proof (IMPLEMENTED): the buyer uploads a screenshot (re-encoded in the browser to
JPEG ≤ 1600 px; the server accepts only real JPEG/PNG/WebP bytes, ≤ 2 MB, stored in
`payment_proofs`, one pending proof per order). API clients may send `proof_url` (HTTPS)
instead. The owner sees the image in the Payments tab (`/owner/payments/:id/proof`,
owner-only, served with `Content-Security-Policy: sandbox`) and approves (tier change
with expiry, once, audited) or rejects. Approval is idempotent (`409 PAYMENT_NOT_PENDING`).

Owner notification:
- Telegram (IMPLEMENTED, NOT VERIFIED against the live Telegram API): with
  `TELEGRAM_BOT_TOKEN` and `TELEGRAM_OWNER_CHAT_ID` set, every manual payment sends the
  proof photo with order, tier, duration, amount, method and buyer email to the owner's
  chat. Failures never block the payment; the response says `sent`, `failed` or
  `not_configured`. Setup: create a bot with @BotFather (token), send any message to the
  bot, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy
  `message.chat.id`. Set both in Vercel (token as Sensitive), redeploy.
- WhatsApp: no automated WhatsApp API is integrated (it needs a paid/approved provider).
  After uploading, the buyer gets a "Kirim via WhatsApp" button: a `wa.me` link to
  `OWNER_WA` (or the number in `settings.js`) with the order details prefilled; the buyer
  attaches the screenshot themselves.

Pakasir (IMPLEMENTED, NOT VERIFIED against the live provider): transaction creation
uses `PAKASIR_PROJECT` + `PAKASIR_API_KEY`. Creating a payment never marks it paid. The
webhook (`POST /webhooks/pakasir`) checks project, `completed` status, order code and
amount against the database, then requires a server-side provider lookup via
`PAKASIR_V2_VERIFY_URL` (template with `{project}`, `{order_id}`, `{amount}`, `{api_key}`).
Pakasir's API documentation has described a transaction-detail lookup of the form
`https://app.pakasir.com/api/transactiondetail?project={project}&amount={amount}&order_id={order_id}&api_key={api_key}`
(NOT VERIFIED from the development environment: pakasir.com was unreachable). Confirm
it in your Pakasir docs and test with a sandbox payment before relying on it. Without the variable automatic settlement is DISABLED (fail-closed,
`202 PAYMENT_NOT_VERIFIED`) and the owner approves QRIS-gateway payments by hand after
checking the Pakasir dashboard. Settlement is idempotent (`duplicate: true` on replays).

## Error contract

Responses use `{success:false, error:<CODE>, message}`. Codes: AUTH_REQUIRED,
INVALID_CREDENTIAL, INVALID_API_KEY, API_KEY_REVOKED, ACCOUNT_RESTRICTED,
CSRF_BLOCKED, QUOTA_EXCEEDED, TIER_RESTRICTED, ENDPOINT_LOCKED,
ENDPOINT_UNAVAILABLE, MAINTENANCE, UPSTREAM_FAILED, OWNER_REQUIRED, KEY_LIMIT,
KEYS_NOT_INCLUDED, INVALID_CUSTOM_KEY, CUSTOM_KEY_TAKEN, TOO_MANY_INVALID_KEYS,
INVALID_TIER, INVALID_DURATION, TIER_NOT_UPGRADE, TOO_MANY_PENDING_ORDERS,
PAYMENT_PENDING (status), PAYMENT_NOT_VERIFIED, PAYMENT_NOT_PENDING,
PAYMENT_NOT_CONFIGURED, PAYMENT_METHOD_UNAVAILABLE, INVALID_PAYMENT, INVALID_PROOF_URL,
INVALID_PROOF_IMAGE, PROOF_TOO_LARGE, QR_NOT_FOUND, NOT_FOUND,
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
- `GET|POST /api/orders`, `POST /api/orders/:id/pakasir`, `GET /api/orders/:id/qr.svg`, `POST /api/orders/:id/manual`
- Owner: `/owner/status`, `/owner/dashboard`, `/owner/users[/:id]` (+ ban, unban,
  approve, tier, delete, keys/:keyId/revoke), `/owner/api/endpoints[/:id]` (+ lock,
  unlock), `/owner/payments` (+ approve, reject, `:id/proof`), `/owner/server`,
  `/owner/server/payments`, `/owner/audit`, `/owner/backup`
- `POST /webhooks/pakasir`

## Verification status

- VERIFIED locally (PostgreSQL 16, Chromium 343/360/390/768/1280 px): everything above
  except where marked otherwise. `npm test` with TEST_DATABASE_URL: 112/112 pass.
- VERIFIED in production by the owner: migrations 001–006 applied, `schema: ok`, Google
  login works, password-reset email from YannApi arrives. Latest production deployment
  (main @ 97db1fa) is READY on Vercel (Node 24.x).
- NOT VERIFIED in production: this branch's changes until merged/deployed (run 007),
  Pakasir live payments/webhook/lookup URL, Telegram delivery, WebGL performance on real
  phones/GPUs, Vercel runtime logs (not accessible from the development environment).
- NOT CONFIGURED: automated WhatsApp sending (by design: wa.me link instead), Telegram
  (until TELEGRAM_* is set), Pakasir verification URL.

## Known limitations

- The per-IP rate limiter is in-memory per serverless instance (best effort). Quota,
  key caps and invalid-key throttling are enforced in PostgreSQL.
- Proof images live in PostgreSQL (≤ 2 MB each, typically 100–400 KB after browser
  compression). Prune old rows from `payment_proofs` if storage gets tight.
- Upgrading to a higher tier does not carry over remaining days of the old tier.
- Custom key values are only as strong as their length; 6-character values are guessable
  in principle (throttled to 30 wrong guesses per IP per 15 minutes).
- `/api` and `/api/playground` load fonts from Google Fonts; the login/home 3D scenes
  load Three.js from jsDelivr (CSS fallback without WebGL).

## Security housekeeping (owner)

- Delete the unused Vercel variables `OWNER_API_KEY` and `OWNER_PANEL_PASSWORD` (no code
  reads them). Mark `AUTH_SECRET`, `SMTP_PASS`, `PAKASIR_API_KEY`, `TELEGRAM_BOT_TOKEN` and
  `DATABASE_URL` as Sensitive in Vercel.
- An old commit of `settings.js` contained a hard-coded API key. It no longer grants
  access (keys are per-user and hashed now), but treat that value as public: never reuse
  it, including as a custom key.

## Smoke checks after deploy

- `GET /health` -> `{"status":"ok"}`; `GET /health/database` -> `schema: ok`.
- `GET /auth/me` signed out -> 401; after Google login -> user plus usage/key limits.
- `/api` signed in as FREE: run "Ping" without a key -> 200, quota decreases by 1.
- `/keys` as a paid user: create a key (generated or custom), `curl -H "Authorization: Bearer <key>" /api/tools/ping`, revoke it, repeat -> 401 API_KEY_REVOKED.
- `/billing`: pick tier + duration + QRIS manual, upload a screenshot -> owner sees it in Payments
  (and on Telegram if configured); approve -> tier shows "aktif sampai <date>".
- `/owner` -> Status tab shows schema ok and the expected configuration; non-owners get 403.
- Logout, then reuse the old cookie (e.g. another browser) -> /auth/me 401.
