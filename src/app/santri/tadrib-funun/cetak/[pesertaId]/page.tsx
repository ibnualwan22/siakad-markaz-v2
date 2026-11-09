import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import CetakTemplateClient from "@/components/cetak/CetakTemplateClient";
import { formatPeriodeArab } from "@/lib/nadi-hufadz";
import {
  defaultFieldPositions,
  resolveTadribFununMinHadir,
  templateProgramKey,
} from "@/lib/tadrib-funun";

export const dynamic = "force-dynamic";

/**
 * Halaman syahadah santri (milik sendiri saja).
 * Dibuka dari kartu Tadrib Funun di portal; tombol Unduh PNG ada di sini.
 * Syarat: peserta milik santri yang login, kehadiran >= minHadir jenisnya,
 * dan syahadah sudah diterbitkan admin.
 */
export default async function SantriCetakTadribFununPage({
  params,
}: {
  params: Promise<{ pesertaId: string }>;
}) {
  const session = await getSantriSession();
  if (!session) notFound();

  const { pesertaId } = await params;

  const peserta = await prisma.tadribFununPeserta.findUnique({
    where: { id: pesertaId },
    include: {
      santri: { select: { nama: true } },
      jenis: { select: { id: true, nama: true, minHadir: true } },
      hadir: { orderBy: { pertemuanKe: "asc" }, select: { tanggal: true } },
    },
  });
  if (!peserta || peserta.santriId !== session.santriId) notFound();
  if (!peserta.syahadahDiterbitkanAt) notFound();
  if (peserta.hadir.length < resolveTadribFununMinHadir(peserta.jenis.minHadir)) notFound();

  const programKey = templateProgramKey(peserta.jenis.id);
  const template = await prisma.templateCetak.findUnique({ where: { programKey } });

  const tglDari = peserta.hadir.length
    ? peserta.hadir[0].tanggal.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const tglSampai = peserta.hadir.length
    ? peserta.hadir[peserta.hadir.length - 1].tanggal.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const data = {
    nama: peserta.santri.nama || "-",
    periode: formatPeriodeArab(tglDari, tglSampai),
    template: {
      backgroundUrl: template?.backgroundUrl || null,
      fieldPositions: (template?.fieldPositions as any) || defaultFieldPositions(),
    },
  };

  return <CetakTemplateClient programKey={programKey} data={data} showPngButton />;
}
