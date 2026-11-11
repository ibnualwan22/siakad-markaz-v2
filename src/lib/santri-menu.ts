import prisma from "@/lib/prisma";

export async function getSantriMenu(santriId: string): Promise<{
  isKetuaKelas: boolean;
  isLajnah: boolean;
  isJasus: boolean;
  isHufadz: boolean;
  isTurats: boolean;
  isQismUbudiyah: boolean;
  qismUbudiyahSakan: string | null;
}> {
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
      sakan: true,
      riwayatRecords: {
        select: { dufahNama: true, program: { select: { kategori: true } } },
      },
    },
  });
  const riwayatAktif = santriAktif?.riwayatRecords.find(
    (r) => r.dufahNama === santriAktif.dufahNama
  );
  // Santri Markaz Hufadz: riwayat berjalan ber-program kategori HUFADZ
  // (bukan dari nama program — nama bisa berubah, kategori stabil).
  const isHufadz = riwayatAktif?.program?.kategori === "HUFADZ";
  // Santri Markaz Turats: riwayat berjalan ber-program kategori TURATS.
  const isTurats = riwayatAktif?.program?.kategori === "TURATS";

  // Qism Ubudiyah: baris UbudiyahQism aktif untuk dufah berjalan DAN
  // sakan saat ini — bila santri pindah sakan, penunjukan di sakan lama
  // tidak lagi berlaku.
  const qismRow =
    santriAktif?.dufahNama && santriAktif?.sakan
      ? await prisma.ubudiyahQism.findFirst({
          where: {
            santriId: santriId,
            dufahNama: santriAktif.dufahNama,
            sakan: santriAktif.sakan,
            isActive: true,
          },
          select: { sakan: true },
        })
      : null;
  const isQismUbudiyah = qismRow !== null;
  const qismUbudiyahSakan = qismRow?.sakan ?? null;

  return { isKetuaKelas: isKetuaKelasCount > 0, isLajnah: isLajnahCount > 0, isJasus: isJasusCount > 0, isHufadz, isTurats, isQismUbudiyah, qismUbudiyahSakan };
}

export async function bolehLapor(santriId: string) {
  const [jasus,lajnah] = await Promise.all([prisma.anggotaJasus.count({where:{santriId}}),prisma.anggotaLajnah.count({where:{santriId}})]);
  return jasus + lajnah > 0;
}
