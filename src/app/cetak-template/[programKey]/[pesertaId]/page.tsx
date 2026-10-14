import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import CetakTemplateClient from "@/components/cetak/CetakTemplateClient";
import { formatJuzTeks, formatPeriodeArab, defaultFieldPositions } from "@/lib/nadi-hufadz";

export const dynamic = "force-dynamic";

/**
 * Halaman cetak generik berbasis template.
 * Dipakai Nadi Hufadz & program lain ke depan.
 * Contoh: /cetak-template/nadi-hufadz/<pesertaId>
 */
export default async function CetakTemplatePage({
  params,
}: {
  params: Promise<{ programKey: string; pesertaId: string }>;
}) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz");
  if (!session || !hasPerm) redirect("/login");

  const { programKey, pesertaId } = await params;

  const peserta = await prisma.nadiHufadzPeserta.findUnique({
    where: { id: pesertaId },
    include: {
      santri: { select: { nama: true } },
      setoran: { orderBy: { pertemuanKe: "asc" }, select: { tanggal: true } },
      tasmi: true,
    },
  });
  if (!peserta || !peserta.tasmi) notFound();

  const template = await prisma.templateCetak.findUnique({ where: { programKey } });

  const tglDari = peserta.setoran.length
    ? peserta.setoran[0].tanggal.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const tglSampai = peserta.tasmi.tanggal.toISOString().slice(0, 10);

  const data = {
    nama: peserta.santri.nama || "-",
    juz: formatJuzTeks(peserta.tasmi.juzTeks),
    predikat: peserta.tasmi.predikat,
    periode: formatPeriodeArab(tglDari, tglSampai),
    template: {
      backgroundUrl: template?.backgroundUrl || null,
      fieldPositions: (template?.fieldPositions as any) || defaultFieldPositions(),
    },
  };

  return <CetakTemplateClient programKey={programKey} data={data} />;
}
