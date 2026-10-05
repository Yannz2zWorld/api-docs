# Database migrations
Apply in order to the configured Neon database (Neon SQL editor or `psql "$DATABASE_URL" -f ...`):

1. `001_users.sql` — creates the base `users` table when it does not exist (no-op otherwise).
2. `002_platform.sql` — adds the remaining `users` columns (`banned_at`, `ban_reason`, `daily_usage`, `last_usage_reset`, ...) and the platform tables.
3. `003_backfill_columns.sql` — adds newer columns to platform tables that already existed in an older shape (002 skips existing tables). Existing `orders` rows get `order_code = 'LEGACY-<id>'`.

Both files are additive/idempotent (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) and never drop data. The application does not run DDL at request time.

If an existing `users` table predates these files, inspect it first: `users.id` must be `uuid` because `002_platform.sql` references it from foreign keys. Every row's `google_id` and `lower(email)` must be unique, or the unique indexes in 002 will fail to build.

After migrating, `GET /health/database` must return `{"database":"connected","schema":"ok"}`. A `"schema":"migration_required"` response lists the missing `table.column` names. Google login answers `503 DATABASE_SCHEMA_OUTDATED` until the schema is complete.

For deploy: take a Neon backup/branch, inspect schema, run migrations, then deploy the app. Rollback should be a forward corrective migration; do not drop production tables.
