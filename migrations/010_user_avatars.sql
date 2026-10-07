-- Profile pictures uploaded from the Profile page. The browser crops and scales them to a small
-- square before upload; the server accepts only real JPEG/PNG/WebP bytes up to 512 KB.
-- Safe to re-run; additive only. Without it, profiles and the live chat keep working and the
-- upload answers MIGRATION_REQUIRED.
CREATE TABLE IF NOT EXISTS user_avatars (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 mime text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
 size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 524288),
 data bytea NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
