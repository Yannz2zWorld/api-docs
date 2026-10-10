-- Custom UI disimpan di akun: tampilan & warna pilihan pengguna ikut ke HP / browser mana pun dia
-- login. Isinya { style, accent, rgb } (lihat views/ui-theme.js). Aman di-run ulang.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_prefs jsonb;
