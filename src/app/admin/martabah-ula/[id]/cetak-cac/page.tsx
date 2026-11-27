import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permission";
import { NON_KELAS_KEY_CAC } from "@/lib/syahadah-non-kelas";
import { getNonKelasSinglePrintData } from "@/lib/syahadah-non-kelas-data";
import SyahadahNonKelasWorkspace from "@/components/cetak/SyahadahNonKelasWorkspace";

export const dynamic = "force-dynamic";

export default async function CetakCacPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("martabah_ula");
  const { id } = await params;

  const data = await getNonKelasSinglePrintData(NON_KELAS_KEY_CAC, id);
  if (!data) notFound();

  return (
    <SyahadahNonKelasWorkspace
      programKey={data.programKey}
      titleLabel={`Cetak Sertifikat CAC — ${data.nama}`}
      backHref="/admin/martabah-ula"
      backLabel="← Kembali ke Martabah Ula"
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
      fileBaseName={`cac-${data.nama}`}
    />
  );
}
