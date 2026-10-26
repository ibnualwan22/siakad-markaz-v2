import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import CetakTemplateClient from "@/components/cetak/CetakTemplateClient";
import { formatJuzTeks, formatPeriodeArab, defaultFieldPositions } from "@/lib/nadi-hufadz";

export const dynamic = "force-dynamic";

/**
 * Halaman syahadah santri (milik sendiri saja).
 * Dibuka dari kartu Nadi Hufadz di portal; tombol Unduh PNG ada di sini.
 * Berbeda dari /cetak-template (admin): sesi santri + cek kepemilikan peserta.
 */
export default async function SantriCetakNadiHufadzPage({
  params,
}: {
  params: Promise<{ pesertaId: string }>;
}) {
  const session = await getSantriSession();
  if (!session) notFound();

  const { pesertaId } = await params;

  const peserta = await prisma.nadiHufadzPeserta.findUnique({
    where: { id: pesertaId },
    include: {
      santri: { select: { nama: true } },
      setoran: { orderBy: { pertemuanKe: "asc" }, select: { tanggal: true } },
      tasmi: true,
    },
  });
  // Kepemilikan: hanya peserta milik santri yang login, dan wajib sudah tasmi'.
  if (!peserta || peserta.santriId !== session.santriId || !peserta.tasmi) notFound();

  const template = await prisma.templateCetak.findUnique({ where: { programKey: "nadi-hufadz" } });

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

  return <CetakTemplateClient programKey="nadi-hufadz" data={data} showPngButton />;
}
