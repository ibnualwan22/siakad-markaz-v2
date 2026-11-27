import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import CetakTemplateClient from "@/components/cetak/CetakTemplateClient";
import SyahadahNonKelasWorkspace from "@/components/cetak/SyahadahNonKelasWorkspace";
import { getAkbarnasMcPrintData } from "@/lib/akbarnas-mc-data";
import { getNonKelasSinglePrintData } from "@/lib/syahadah-non-kelas-data";

export const dynamic = "force-dynamic";

/**
 * Halaman cetak satuan Syahadah Non-Kelas terpadu (F4 Landscape 330 x 215 mm):
 * - /cetak-template/nadi-hufadz/<pesertaId>
 * - /cetak-template/lajnah/<anggotaId>
 * - /cetak-template/osim/<anggotaId>
 * - /cetak-template/tadrib-funun-<jenisId>/<pesertaId>
 * - /cetak-template/akbarnas-mc/<riwayatId> (tetap pakai engine MC)
 */
export default async function CetakTemplatePage({
  params,
}: {
  params: Promise<{ programKey: string; pesertaId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { programKey, pesertaId } = await params;

  // --- Syahadah MC Akbarnas bulan 1 (dipertahankan) ---
  if (programKey === "akbarnas-mc") {
    const hasPerm = await checkPermission("data_syahadah");
    if (!hasPerm) redirect("/login");

    const data = await getAkbarnasMcPrintData(pesertaId);
    if (!data) notFound();

    return <CetakTemplateClient programKey={programKey} data={data} showPngButton />;
  }

  // --- Cek izin per jenis Non-Kelas ---
  if (programKey === "lajnah") {
    if (!(await checkPermission("lajnah_syahadah"))) redirect("/login");
  } else if (programKey === "osim") {
    if (!(await checkPermission("osim_syahadah"))) redirect("/login");
  } else if (programKey.startsWith("tadrib-funun-")) {
    if (!(await checkPermission("tadrib_funun"))) redirect("/login");
  } else if (programKey === "nadi-hufadz") {
    if (!(await checkPermission("nadi_hufadz"))) redirect("/login");
  } else {
    notFound();
  }

  const data = await getNonKelasSinglePrintData(programKey, pesertaId);
  if (!data) notFound();

  const backHref =
    programKey === "lajnah"
      ? "/admin/lajnah"
      : programKey === "osim"
        ? "/admin/osim"
        : programKey.startsWith("tadrib-funun-")
          ? "/admin/tadrib-funun"
          : "/admin/nadi-hufadz";

  return (
    <SyahadahNonKelasWorkspace
      programKey={data.programKey}
      titleLabel={`Cetak ${data.jenisLabel} — ${data.nama}`}
      backHref={backHref}
      backLabel="← Kembali"
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
      fileBaseName={data.nama}
    />
  );
}
