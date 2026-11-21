import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import CetakSyahadahOfflineClient from "@/components/cetak/CetakSyahadahOfflineClient";
import { getOfflinePrintData } from "@/lib/syahadah-offline-data";

export const dynamic = "force-dynamic";

/**
 * Halaman cetak syahadah offline (admin) — A4 portrait, kertas pre-printed.
 * Background TIDAK ikut tercetak (hanya tampil di preview).
 * Contoh: /cetak-offline/<riwayatId atau santriId>
 * Program (dan template-nya) diturunkan dari program santri.
 */
export default async function CetakOfflinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const hasPerm = await checkPermission("data_syahadah");
  if (!hasPerm) redirect("/login");

  const { id } = await params;
  const data = await getOfflinePrintData(id);
  if (!data) notFound();

  return (
    <CetakSyahadahOfflineClient
      programKey={data.programKey}
      data={data}
      mode="admin"
    />
  );
}
