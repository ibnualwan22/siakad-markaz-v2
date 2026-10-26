-- CreateTable
CREATE TABLE "NadiHufadzPeriode" (
    "id" TEXT NOT NULL,
    "dufahNama" TEXT NOT NULL,
    "dibuka" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NadiHufadzPeriode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NadiHufadzPeriode_dufahNama_key" ON "NadiHufadzPeriode"("dufahNama");

-- Catatan penerapan (26 Okt 2026): DB Siakad tidak dikelola migrate deploy,
-- tabel ini dibuat via psql di container db. Tanpa baris untuk suatu dufah =
-- pendaftaran tertutup (admin membuka lewat halaman admin Nadi Hufadz).
