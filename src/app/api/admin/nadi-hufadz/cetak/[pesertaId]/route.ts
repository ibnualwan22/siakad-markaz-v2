import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { formatJuzTeks, formatPeriodeArab } from "@/lib/nadi-hufadz";

export const dynamic = "force-dynamic";

// GET — data siap cetak untuk satu peserta (dipakai halaman cetak)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ pesertaId: string }> }
) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pesertaId } = await params;

  const peserta = await prisma.nadiHufadzPeserta.findUnique({
    where: { id: pesertaId },
    include: {
      santri: { select: { nama: true } },
      setoran: { orderBy: { pertemuanKe: "asc" }, select: { tanggal: true } },
      tasmi: true,
    },
  });
  if (!peserta) return NextResponse.json({ error: "Peserta tidak ditemukan" }, { status: 404 });
  if (!peserta.tasmi) {
    return NextResponse.json({ error: "Belum ada data tasmi'" }, { status: 400 });
  }

  const template = await prisma.templateCetak.findUnique({
    where: { programKey: "nadi-hufadz" },
  });

  const tglDari = peserta.setoran.length
    ? peserta.setoran[0].tanggal.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const tglSampai = peserta.tasmi.tanggal.toISOString().slice(0, 10);

  return NextResponse.json({
    nama: peserta.santri.nama || "-",
    juz: formatJuzTeks(peserta.tasmi.juzTeks),
    predikat: peserta.tasmi.predikat,
    periode: formatPeriodeArab(tglDari, tglSampai),
    kehadiran: peserta.setoran.length,
    dufahNama: peserta.dufahNama,
    template: template
      ? {
          backgroundUrl: template.backgroundUrl,
          fieldPositions: template.fieldPositions,
        }
      : null,
  });
}
