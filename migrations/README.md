# Database migrations
Apply `002_platform.sql` to the configured Neon database using its SQL editor or your deployment migration process. It is additive/idempotent, uses `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and intentionally does not drop data. Existing `users` must already have `id`, `google_id`, `email`, `name`, `picture`, `tier`, and `status`; inspect actual column types/constraints before production migration. The application does not run DDL automatically at request time.

For deploy: take a Neon backup/branch, inspect schema, run migration, then deploy app. Rollback should be a forward corrective migration; do not drop production tables.
