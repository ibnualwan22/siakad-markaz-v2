-- OSIM (Markaz Turats): cermin persis tabel Lajnah, TANPA kaitan ke mukholif/jasus.
-- Dibuat manual via psql karena image Siakad tidak berisi prisma CLI; file ini
-- dokumentasi (pola yang sama dengan tabel NadiHufadzPeriode). _prisma_migrations
-- tidak ada di DB ini, jadi file ini tidak di-insert ke riwayat migrasi.
-- Jangkar data tetap dufahNama (FK ke Dufah); label "Marhalah" hanya di UI.

CREATE TABLE "AnggotaOsim" (
  "id" TEXT NOT NULL,
  "santriId" TEXT NOT NULL,
  "dufahNama" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnggotaOsim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnggotaOsim_santriId_dufahNama_key" ON "AnggotaOsim"("santriId", "dufahNama");
ALTER TABLE "AnggotaOsim" ADD CONSTRAINT "AnggotaOsim_santriId_fkey" FOREIGN KEY ("santriId") REFERENCES "SantriInternal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnggotaOsim" ADD CONSTRAINT "AnggotaOsim_dufahNama_fkey" FOREIGN KEY ("dufahNama") REFERENCES "Dufah"("nama") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SesiPemilihanOsim" (
  "id" TEXT NOT NULL,
  "judul" TEXT NOT NULL,
  "dufahNama" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "rencanaTutupAt" TIMESTAMP(3),
  "dibukaAt" TIMESTAMP(3),
  "ditutupAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SesiPemilihanOsim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SesiPemilihanOsim_dufahNama_idx" ON "SesiPemilihanOsim"("dufahNama");
CREATE INDEX "SesiPemilihanOsim_status_idx" ON "SesiPemilihanOsim"("status");
ALTER TABLE "SesiPemilihanOsim" ADD CONSTRAINT "SesiPemilihanOsim_dufahNama_fkey" FOREIGN KEY ("dufahNama") REFERENCES "Dufah"("nama") ON DELETE CASCADE;

CREATE TABLE "PaslonOsim" (
  "id" TEXT NOT NULL,
  "sesiId" TEXT NOT NULL,
  "nomorUrut" INTEGER NOT NULL,
  "santri1Id" TEXT NOT NULL,
  "santri2Id" TEXT NOT NULL,
  "fotoUrl" TEXT,
  "visiMisi" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaslonOsim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaslonOsim_sesiId_nomorUrut_key" ON "PaslonOsim"("sesiId", "nomorUrut");
CREATE INDEX "PaslonOsim_sesiId_idx" ON "PaslonOsim"("sesiId");
ALTER TABLE "PaslonOsim" ADD CONSTRAINT "PaslonOsim_sesiId_fkey" FOREIGN KEY ("sesiId") REFERENCES "SesiPemilihanOsim"("id") ON DELETE CASCADE;
ALTER TABLE "PaslonOsim" ADD CONSTRAINT "PaslonOsim_santri1Id_fkey" FOREIGN KEY ("santri1Id") REFERENCES "SantriInternal"("id") ON DELETE CASCADE;
ALTER TABLE "PaslonOsim" ADD CONSTRAINT "PaslonOsim_santri2Id_fkey" FOREIGN KEY ("santri2Id") REFERENCES "SantriInternal"("id") ON DELETE CASCADE;

CREATE TABLE "SuaraOsim" (
  "id" TEXT NOT NULL,
  "sesiId" TEXT NOT NULL,
  "paslonId" TEXT NOT NULL,
  "santriId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SuaraOsim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SuaraOsim_sesiId_santriId_key" ON "SuaraOsim"("sesiId", "santriId");
CREATE INDEX "SuaraOsim_paslonId_idx" ON "SuaraOsim"("paslonId");
ALTER TABLE "SuaraOsim" ADD CONSTRAINT "SuaraOsim_sesiId_fkey" FOREIGN KEY ("sesiId") REFERENCES "SesiPemilihanOsim"("id") ON DELETE CASCADE;
ALTER TABLE "SuaraOsim" ADD CONSTRAINT "SuaraOsim_paslonId_fkey" FOREIGN KEY ("paslonId") REFERENCES "PaslonOsim"("id") ON DELETE CASCADE;
ALTER TABLE "SuaraOsim" ADD CONSTRAINT "SuaraOsim_santriId_fkey" FOREIGN KEY ("santriId") REFERENCES "SantriInternal"("id") ON DELETE CASCADE;
