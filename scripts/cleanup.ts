import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting cleanup for Orphaned IZIN records...");

  // 1. CLEANUP ABSEN KELAS
  console.log("Analyzing AbsenKelas...");
  const allIzinKelas = await prisma.absenKelas.findMany({
    where: {
      status: { in: ["IZIN", "SAKIT"] },
      keterangan: { contains: "[TRS-" }
    }
  });

  let deletedKelasCount = 0;
  for (const record of allIzinKelas) {
    const countHadir = await prisma.absenKelas.count({
      where: {
        tanggal: record.tanggal,
        sesi: record.sesi,
        status: "HADIR"
      }
    });

    if (countHadir === 0) {
      await prisma.absenKelas.delete({ where: { id: record.id } });
      deletedKelasCount++;
    }
  }
  console.log(`Deleted ${deletedKelasCount} orphaned records in AbsenKelas.`);

  // 2. CLEANUP ABSEN KEGIATAN
  console.log("Analyzing AbsenKegiatan...");
  const allIzinKegiatan = await prisma.absenKegiatan.findMany({
    where: {
      status: { in: ["IZIN", "SAKIT"] },
      keterangan: { contains: "[TRS-" }
    }
  });

  let deletedKegiatanCount = 0;
  for (const record of allIzinKegiatan) {
    const countHadir = await prisma.absenKegiatan.count({
      where: {
        tanggal: record.tanggal,
        kategoriId: record.kategoriId,
        status: "HADIR"
      }
    });

    if (countHadir === 0) {
      await prisma.absenKegiatan.delete({ where: { id: record.id } });
      deletedKegiatanCount++;
    }
  }
  console.log(`Deleted ${deletedKegiatanCount} orphaned records in AbsenKegiatan.`);

  // 3. CLEANUP ABSEN TABIROT
  console.log("Analyzing AbsenTabirot...");
  const allIzinTabirot = await prisma.absenTabirot.findMany({
    where: {
      status: { in: ["IZIN", "SAKIT"] },
      keterangan: { contains: "[TRS-" }
    }
  });

  let deletedTabirotCount = 0;
  for (const record of allIzinTabirot) {
    const countHadir = await prisma.absenTabirot.count({
      where: {
        tanggal: record.tanggal,
        kelompokId: record.kelompokId,
        status: "HADIR"
      }
    });

    if (countHadir === 0) {
      await prisma.absenTabirot.delete({ where: { id: record.id } });
      deletedTabirotCount++;
    }
  }
  console.log(`Deleted ${deletedTabirotCount} orphaned records in AbsenTabirot.`);

  console.log("Cleanup finished.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
