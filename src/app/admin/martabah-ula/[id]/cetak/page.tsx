import { notFound } from "next/navigation";
import { getCertificateData } from "@/lib/app-data";
import { requirePermission } from "@/lib/permission";
import {
  NON_KELAS_KEY_MARTABAH_ARABIYAH,
  NON_KELAS_KEY_MARTABAH_TURATS,
} from "@/lib/syahadah-non-kelas";
import { getNonKelasSinglePrintData } from "@/lib/syahadah-non-kelas-data";
import SyahadahNonKelasWorkspace from "@/components/cetak/SyahadahNonKelasWorkspace";

export const dynamic = "force-dynamic";

export default async function CetakMartabahPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("martabah_ula");
  const { id } = await params;

  const cert: any = await getCertificateData(id);
  if (!cert || !cert.program) notFound();

  const isTurats = cert.program?.kategori === "TURATS";
  const programKey = isTurats
    ? NON_KELAS_KEY_MARTABAH_TURATS
    : NON_KELAS_KEY_MARTABAH_ARABIYAH;

  const data = await getNonKelasSinglePrintData(programKey, id);
  if (!data) notFound();

  return (
    <SyahadahNonKelasWorkspace
      programKey={data.programKey}
      titleLabel={`Cetak ${data.jenisLabel} — ${data.nama}`}
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
      fileBaseName={`martabah-${data.nama}`}
    />
  );
}
