-- Angket Nadi Hufadz: satu kolom bebas per santri per dufah + toggle buka/tutup.
-- Dokumentasi saja (DB ini tidak dikelola migrate deploy); dibuat via psql.
CREATE TABLE IF NOT EXISTS "NadiHufadzAngket" (
  "id" text NOT NULL,
  "santriId" text NOT NULL,
  "dufahNama" text NOT NULL,
  "isi" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "NadiHufadzAngket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NadiHufadzAngket_santriId_dufahNama_key"
  ON "NadiHufadzAngket" ("santriId", "dufahNama");
CREATE INDEX IF NOT EXISTS "NadiHufadzAngket_dufahNama_idx"
  ON "NadiHufadzAngket" ("dufahNama");
ALTER TABLE "NadiHufadzPeriode" ADD COLUMN IF NOT EXISTS "angketDibuka" BOOLEAN NOT NULL DEFAULT false;
