-- Yannz API base users table. Safe to re-run; a no-op when `users` already exists.
-- Apply before 002_platform.sql (which adds the remaining columns, indexes, and tables).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 google_id text NOT NULL,
 email text NOT NULL,
 name text NOT NULL DEFAULT '',
 picture text NOT NULL DEFAULT '',
 tier text NOT NULL DEFAULT 'FREE',
 status text NOT NULL DEFAULT 'active',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
