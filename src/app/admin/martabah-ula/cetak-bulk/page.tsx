import { requirePermission } from "@/lib/permission";
import { getNonKelasBulkPrintData } from "@/lib/syahadah-non-kelas-data";
import CetakBulkNonKelasClient from "@/components/cetak/CetakBulkNonKelasClient";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cetak Bulk Martabah Ula - Admin Panel",
};

export default async function CetakBulkMartabahPage() {
  await requirePermission("martabah_ula");
  const data = await getNonKelasBulkPrintData("martabah-ula");

  return (
    <CetakBulkNonKelasClient
      data={data}
      backHref="/admin/martabah-ula"
      backLabel="← Kembali ke Martabah Ula"
    />
  );
}
