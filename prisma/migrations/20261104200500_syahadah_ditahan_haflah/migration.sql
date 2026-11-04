-- Dokumentasi saja (DB Siakad tidak dikelola migrate deploy).
-- Tabel dibuat manual via psql di container siakad-db sebelum deploy kode.
-- Penanda syahadah ditahan untuk prosesi Haflah Wada' (per santri per dufah).
-- HANYA berpengaruh di denah & pemanggilan haflah; cetak & status tidak berubah.

CREATE TABLE IF NOT EXISTS "SyahadahDitahan" (
  "id" TEXT NOT NULL,
  "santriId" TEXT NOT NULL,
  "dufahNama" TEXT NOT NULL,
  "catatan" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyahadahDitahan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SyahadahDitahan_santriId_dufahNama_key"
  ON "SyahadahDitahan"("santriId", "dufahNama");

CREATE INDEX IF NOT EXISTS "SyahadahDitahan_dufahNama_idx"
  ON "SyahadahDitahan"("dufahNama");
