-- Denah sakan: tautkan titik LokasiDenah ke sakan terdaftar + tinggi balok 3D.
-- Dokumentasi saja (DB ini tidak dikelola migrate deploy); kolom dibuat via psql.
ALTER TABLE "LokasiDenah" ADD COLUMN IF NOT EXISTS "sakan" TEXT;
ALTER TABLE "LokasiDenah" ADD COLUMN IF NOT EXISTS "lantai" INTEGER NOT NULL DEFAULT 1;
-- Satu sakan maksimal satu titik AKTIF (titik nonaktif lama boleh tetap ada).
CREATE UNIQUE INDEX IF NOT EXISTS "LokasiDenah_sakan_aktif_key"
  ON "LokasiDenah" ("sakan") WHERE "isActive" = true AND "sakan" IS NOT NULL;
