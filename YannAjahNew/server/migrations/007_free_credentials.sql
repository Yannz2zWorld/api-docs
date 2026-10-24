-- Username & password akun website BEBAS (permintaan pemilik): username boleh huruf besar/kecil,
-- spasi, dan simbol; password tidak lagi wajib 10 karakter huruf+angka (aturannya di aplikasi).
-- Yang tetap dijaga di database: username tidak kosong, maks 64 karakter, tanpa karakter kontrol,
-- dan unik tanpa membedakan huruf besar/kecil ("Budi" dan "budi" dianggap sama) supaya login tidak ambigu.

-- 1. Lepas CHECK format lama (^[a-z0-9][a-z0-9._-]{2,31}$), apa pun nama constraint-nya.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT con.conname FROM pg_constraint con
    WHERE con.conrelid = 'accounts'::regclass AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%username%'
  LOOP
    EXECUTE format('ALTER TABLE accounts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE accounts ADD CONSTRAINT accounts_username_free_check
  CHECK (char_length(btrim(username)) BETWEEN 1 AND 64 AND username = btrim(username) AND username !~ '[[:cntrl:]]');

-- 2. Unik tanpa beda huruf besar/kecil (data lama sudah huruf kecil semua, jadi tidak bentrok).
DROP INDEX IF EXISTS accounts_username_uq;
CREATE UNIQUE INDEX accounts_username_uq ON accounts (lower(username)) WHERE deleted_at IS NULL;
