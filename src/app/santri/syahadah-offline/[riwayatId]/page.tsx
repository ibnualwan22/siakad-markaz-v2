import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import CetakSyahadahOfflineClient from "@/components/cetak/CetakSyahadahOfflineClient";
import { getOfflinePrintData } from "@/lib/syahadah-offline-data";

export const dynamic = "force-dynamic";

/**
 * Halaman unduh syahadah offline (santri, milik sendiri saja).
 * Desain PENUH + isi: background ikut tercetak & ikut di PNG.
 * Dibuka dari tombol "Unduh Syahadah Baru" di kartu riwayat portal.
 */
export default async function SantriSyahadahOfflinePage({
  params,
}: {
  params: Promise<{ riwayatId: string }>;
}) {
  const session = await getSantriSession();
  if (!session) notFound();

  const { riwayatId } = await params;

  const riwayat = await prisma.riwayatSantri.findUnique({
    where: { id: riwayatId },
    select: { santriId: true },
  });
  // Kepemilikan: hanya riwayat milik santri yang login.
  if (!riwayat || riwayat.santriId !== session.santriId) notFound();

  const data = await getOfflinePrintData(riwayatId);
  if (!data) notFound();

  return (
    <CetakSyahadahOfflineClient
      programKey={data.programKey}
      data={data}
      mode="santri"
    />
  );
}
