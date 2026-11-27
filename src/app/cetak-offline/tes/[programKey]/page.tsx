import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permission";
import CetakSyahadahOfflineClient from "@/components/cetak/CetakSyahadahOfflineClient";
import { getDummyPrintData } from "@/lib/syahadah-offline-data";

export const dynamic = "force-dynamic";

/**
 * Halaman cetak TES syahadah offline (admin) — F4 portrait (215 x 330 mm),
 * data DUMMY ("Ahmad Ibnu Alwan", "Wonosobo, 05 - 11 - 2000", nama mapel
 * asli program + nilai ٩٥, dan QR preview).
 * Untuk mengetes posisi field + desain template program yang dipilih di editor.
 * Contoh: /cetak-offline/tes/syahadah-offline-idad-awal
 */
export default async function CetakOfflineTesPage({
  params,
}: {
  params: Promise<{ programKey: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const hasPerm = await hasAnyPermission("data_syahadah", "layout_syahadah");
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
