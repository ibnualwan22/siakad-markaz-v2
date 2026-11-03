-- CreateTable
CREATE TABLE "MunaqosahHufadz" (
    "id" TEXT NOT NULL,
    "santriId" TEXT NOT NULL,
    "dufahNama" TEXT NOT NULL,
    "nilaiHafalan" INTEGER NOT NULL,
    "nilaiKelancaran" INTEGER NOT NULL,
    "nilaiTajwid" INTEGER NOT NULL,
    "nilaiMakhorijulHuruf" INTEGER NOT NULL,
    "nilaiAdab" INTEGER NOT NULL,
    "juzTeks" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "pengujiId" TEXT,
    "catatan" TEXT,
    "verifyToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MunaqosahHufadz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MunaqosahHufadz_santriId_dufahNama_key" ON "MunaqosahHufadz"("santriId", "dufahNama");
CREATE UNIQUE INDEX "MunaqosahHufadz_verifyToken_key" ON "MunaqosahHufadz"("verifyToken");
CREATE INDEX "MunaqosahHufadz_dufahNama_idx" ON "MunaqosahHufadz"("dufahNama");

-- Catatan penerapan (3 Nov 2026): DB Siakad tidak dikelola migrate deploy,
-- tabel ini dibuat via psql di container db SEBELUM deploy kode baru.
-- Nilai akhir + predikat tidak disimpan — dihitung dari 5 nilai di
-- src/lib/munaqosah-hufadz.ts.
