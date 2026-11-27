import { requirePermission } from "@/lib/permission";
import { getNonKelasBulkPrintData } from "@/lib/syahadah-non-kelas-data";
import CetakBulkNonKelasClient from "@/components/cetak/CetakBulkNonKelasClient";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cetak Bulk CAC - Admin Panel",
};

export default async function CetakBulkCacPage() {
  await requirePermission("martabah_ula");
  const data = await getNonKelasBulkPrintData("cac");

  return (
    <CetakBulkNonKelasClient
      data={data}
      backHref="/admin/martabah-ula"
      backLabel="← Kembali ke Martabah Ula"
    />
  );
}
