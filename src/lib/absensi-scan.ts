import type { PrismaClient } from "@prisma/client";

/** Same eligibility as the attendance list, using two indexed single-row reads. */
export async function getSantriScanTarget(
  db: Pick<PrismaClient, "santriInternal" | "riwayatSantri">,
  santriId: string,
) {
  const santri = await db.santriInternal.findUnique({
    where: { id: santriId },
    select: { id: true, nama: true, sakan: true, dufahNama: true, isAktif: true },
  });
  // Prisma's previous `sakan: { not: "-" }` filter also excluded SQL NULL.
  if (!santri?.isAktif || !santri.dufahNama || santri.dufahNama === "-"
    || santri.sakan === null || santri.sakan === "-") return null;

  const riwayat = await db.riwayatSantri.findUnique({
    where: { santriId_dufahNama: { santriId, dufahNama: santri.dufahNama } },
    select: { id: true, kelas: { select: { nama: true } } },
  });
  if (!riwayat) return null;
  return {
    riwayatId: riwayat.id,
    nama: santri.nama ?? "Tanpa Nama",
    sakan: santri.sakan,
    kelasNama: riwayat.kelas?.nama ?? null,
  };
}
