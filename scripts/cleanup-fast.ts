import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting FAST cleanup for Orphaned IZIN records (Raw SQL)...");

  // 1. CLEANUP ABSEN KELAS
  console.log("Cleaning up orphaned AbsenKelas...");
  const deletedKelas = await prisma.$executeRaw`
    DELETE FROM "AbsenKelas" 
    WHERE status IN ('IZIN', 'SAKIT') 
      AND keterangan LIKE '%[TRS-%'
      AND NOT EXISTS (
        SELECT 1 FROM "AbsenKelas" as ak2 
        WHERE ak2.tanggal = "AbsenKelas".tanggal 
          AND ak2.sesi = "AbsenKelas".sesi 
          AND ak2.status = 'HADIR'
      )
  `;
  console.log(`Deleted orphaned records in AbsenKelas: ${deletedKelas}`);

  // 2. CLEANUP ABSEN KEGIATAN
  console.log("Cleaning up orphaned AbsenKegiatan...");
  const deletedKegiatan = await prisma.$executeRaw`
    DELETE FROM "AbsenKegiatan" 
    WHERE status IN ('IZIN', 'SAKIT') 
      AND keterangan LIKE '%[TRS-%'
      AND NOT EXISTS (
        SELECT 1 FROM "AbsenKegiatan" as ak2 
        WHERE ak2.tanggal = "AbsenKegiatan".tanggal 
          AND ak2."kategoriId" = "AbsenKegiatan"."kategoriId" 
          AND ak2.status = 'HADIR'
      )
  `;
  console.log(`Deleted orphaned records in AbsenKegiatan: ${deletedKegiatan}`);

  // 3. CLEANUP ABSEN TABIROT
  console.log("Cleaning up orphaned AbsenTabirot...");
  const deletedTabirot = await prisma.$executeRaw`
    DELETE FROM "AbsenTabirot" 
    WHERE status IN ('IZIN', 'SAKIT') 
      AND keterangan LIKE '%[TRS-%'
      AND NOT EXISTS (
        SELECT 1 FROM "AbsenTabirot" as ak2 
        WHERE ak2.tanggal = "AbsenTabirot".tanggal 
          AND ak2."kelompokId" = "AbsenTabirot"."kelompokId" 
          AND ak2.status = 'HADIR'
      )
  `;
  console.log(`Deleted orphaned records in AbsenTabirot: ${deletedTabirot}`);

  console.log("Cleanup finished super fast!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
