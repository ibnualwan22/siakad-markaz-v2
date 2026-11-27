import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/permission";
import { isValidNonKelasProgramKey } from "@/lib/syahadah-non-kelas";
import { getNonKelasDummyData } from "@/lib/syahadah-non-kelas-data";
import SyahadahNonKelasWorkspace from "@/components/cetak/SyahadahNonKelasWorkspace";

export const dynamic = "force-dynamic";

export default async function CetakTesNonKelasPage({
  params,
}: {
  params: Promise<{ programKey: string }>;
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

  const { programKey } = await params;
  if (!isValidNonKelasProgramKey(programKey)) notFound();

  const data = await getNonKelasDummyData(programKey);
  if (!data) notFound();

  return (
    <SyahadahNonKelasWorkspace
      programKey={data.programKey}
      titleLabel={`Cetak Tes — ${data.jenisLabel}`}
      backHref="/admin/syahadah-offline?tab=non-kelas"
      backLabel="← Kembali ke Layout Non-Kelas"
      texts={data.texts}
      qrUrl={data.qrUrl}
      signatureUrl={data.signatureUrl}
      stampUrl={data.stampUrl}
      backgroundUrl={data.template.backgroundUrl}
      positions={data.template.fieldPositions}
      offsetX={data.template.offsetX}
      offsetY={data.template.offsetY}
      locked={data.template.locked}
      canEdit
      initialEditorActive={false}
      showPngButton
      fileBaseName={`tes-${data.programKey}`}
    />
  );
}
