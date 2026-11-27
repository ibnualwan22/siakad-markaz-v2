import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getBulkOfflinePrintData } from "@/lib/syahadah-offline-data";
import CetakBulkOfflineClient from "@/components/cetak/CetakBulkOfflineClient";
import type { LembagaId } from "@/lib/lembaga";

export const dynamic = "force-dynamic";

export default async function CetakBulkOfflinePage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    kelasId?: string;
    lembaga?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const hasPerm = await checkPermission("data_syahadah");
  if (!hasPerm) redirect("/login");

  const sp = await searchParams;
  const mode: "lulus" | "musyarokah" =
    sp.mode === "musyarokah" ? "musyarokah" : "lulus";
  const kelasId = sp.kelasId?.trim() || null;
  const rawLembaga = (sp.lembaga || "").toUpperCase();
  const lembaga: LembagaId | null =
    rawLembaga === "ARABIYAH" ||
    rawLembaga === "TURATS" ||
    rawLembaga === "HUFADZ"
      ? (rawLembaga as LembagaId)
      : null;

  const data = await getBulkOfflinePrintData({
    mode,
    kelasId,
    lembaga,
  });

  return (
    <CetakBulkOfflineClient
      data={data}
      kelasId={kelasId}
      lembaga={lembaga}
    />
  );
}
