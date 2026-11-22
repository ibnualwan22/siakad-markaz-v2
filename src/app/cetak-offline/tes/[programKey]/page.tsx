import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import CetakSyahadahOfflineClient from "@/components/cetak/CetakSyahadahOfflineClient";
import { getDummyPrintData } from "@/lib/syahadah-offline-data";

export const dynamic = "force-dynamic";

/**
 * Halaman cetak TES syahadah offline (admin) — data DUMMY, nama selalu
 * "Ahmad Ibnu Alwan" di semua program (keputusan user 22 Nov 2026).
 * Untuk mengetes posisi field + desain template program yang dipilih di
 * editor. BUKAN data santri asli (muaddal + nilai ٩٥ semua, tanpa QR).
 * Contoh: /cetak-offline/tes/syahadah-offline-idad-awal
 */
export default async function CetakOfflineTesPage({
  params,
}: {
  params: Promise<{ programKey: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const hasPerm = await checkPermission("data_syahadah");
  if (!hasPerm) redirect("/login");

  const { programKey } = await params;
  const data = await getDummyPrintData(programKey);
  if (!data) notFound();

  return (
    <CetakSyahadahOfflineClient
      programKey={data.programKey}
      data={data}
      mode="admin"
    />
  );
}
