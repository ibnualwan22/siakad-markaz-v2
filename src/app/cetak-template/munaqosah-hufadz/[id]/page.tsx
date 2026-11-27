import { getSession } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permission";
import prisma from "@/lib/prisma";
import { getOfflinePrintData } from "@/lib/syahadah-offline-data";
import CetakSyahadahOfflineClient from "@/components/cetak/CetakSyahadahOfflineClient";

export const dynamic = "force-dynamic";

export default async function CetakMunaqosahPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const hasPerm = await hasAnyPermission("huffadz", "data_syahadah");
  if (!session || !hasPerm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <p className="text-slate-600">Tidak diizinkan melihat halaman ini.</p>
      </div>
    );
  }

  const { id } = await params;

  // `id` dari halaman Munaqosah Hufadz adalah MunaqosahHufadz.id;
  // selesaikan ke santriId/riwayatId lalu cetak lewat engine F4 Portrait terpadu.
  const munaqosah = await prisma.munaqosahHufadz.findUnique({
    where: { id },
    select: { santriId: true, dufahNama: true },
  });

  let lookupId = id;
  if (munaqosah) {
    const riwayat = await prisma.riwayatSantri.findUnique({
      where: {
        santriId_dufahNama: {
          santriId: munaqosah.santriId,
          dufahNama: munaqosah.dufahNama,
        },
      },
      select: { id: true },
    });
    lookupId = riwayat?.id ?? munaqosah.santriId;
  }

  const data = await getOfflinePrintData(lookupId);
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <p className="text-slate-600">
          Data syahadah santri tidak ditemukan (pastikan santri terdaftar pada program Markaz Hufadz).
        </p>
      </div>
    );
  }

  return (
    <CetakSyahadahOfflineClient
      programKey={data.programKey}
      data={data}
      mode="admin"
    />
  );
}
