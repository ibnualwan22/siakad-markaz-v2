-- AlterTable
ALTER TABLE "NadiHufadzPeriode" ADD COLUMN "minHadir" INTEGER;

-- Catatan penerapan (3 Nov 2026): DB Siakad tidak dikelola migrate deploy,
-- kolom ini ditambahkan via psql di container db SEBELUM deploy kode baru,
-- karena Prisma Client hasil build baru akan menyeleksi kolom ini di setiap
-- baca NadiHufadzPeriode. NULL = pakai default 7, jadi baris lama tak berubah.
