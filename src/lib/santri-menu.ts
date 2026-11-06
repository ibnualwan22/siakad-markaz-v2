import prisma from "@/lib/prisma";

export async function getSantriMenu(santriId: string) {
  const isKetuaKelasCount = await prisma.ketuaKelas.count({
    where: {
      santriId: santriId,
      isActive: true,
    }
  });

  const isLajnahCount = await prisma.anggotaLajnah.count({
    where: { santriId: santriId }
  });

  const isJasusCount = await prisma.anggotaJasus.count({
    where: { santriId: santriId }
  });

  const santriAktif = await prisma.santriInternal.findUnique({
    where: { id: santriId },
    select: {
      dufahNama: true,
      riwayatRecords: {
        select: { dufahNama: true, program: { select: { nama_indo: true, kategori: true } } },
      },
    },
  });
  const riwayatAktif = santriAktif?.riwayatRecords.find(
    (r) => r.dufahNama === santriAktif.dufahNama
  );
  const isHufadz = (riwayatAktif?.program?.nama_indo || "")
    .toLowerCase()
    .includes("hufadz");
  // Santri Markaz Turats: riwayat berjalan ber-program kategori TURATS.
  const isTurats = riwayatAktif?.program?.kategori === "TURATS";

  return { isKetuaKelas: isKetuaKelasCount > 0, isLajnah: isLajnahCount > 0, isJasus: isJasusCount > 0, isHufadz, isTurats };
}

export async function bolehLapor(santriId: string) {
  const [jasus,lajnah] = await Promise.all([prisma.anggotaJasus.count({where:{santriId}}),prisma.anggotaLajnah.count({where:{santriId}})]);
  return jasus + lajnah > 0;
}
