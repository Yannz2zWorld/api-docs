-- Developer panel → Endpoints → "Tampilkan": a backup-only endpoint (/api/alt…/…) listed as a
-- version of the endpoint it backs up (e.g. /api/anime/anichin/detail-v2). The version keeps its
-- path when it is hidden again, so showing it later gives the same version. Aman di-run ulang.
CREATE TABLE IF NOT EXISTS endpoint_aliases (
  public_path text PRIMARY KEY,
  backup_path text NOT NULL UNIQUE,
  name text NOT NULL,
  shown boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
