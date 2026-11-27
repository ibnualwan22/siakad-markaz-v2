import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permission";
import { getNonKelasBulkPrintData } from "@/lib/syahadah-non-kelas-data";
import CetakBulkNonKelasClient from "@/components/cetak/CetakBulkNonKelasClient";

export const dynamic = "force-dynamic";

export default async function CetakBulkNonKelasPage({
  searchParams,
}: {
  searchParams: Promise<{ jenis?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const hasPerm = await hasAnyPermission(
    "data_syahadah",
    "layout_syahadah",
    "nadi_hufadz",
    "lajnah_syahadah",
    "osim_syahadah",
    "tadrib_funun",
    "martabah_ula",
  );
  if (!hasPerm) redirect("/login");

  const sp = await searchParams;
  const jenis = sp.jenis?.trim() || "ALL";
  const data = await getNonKelasBulkPrintData(jenis);

  return <CetakBulkNonKelasClient data={data} />;
}
