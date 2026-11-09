import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { formatPeriodeArab } from "@/lib/nadi-hufadz";
import { resolveTadribFununMinHadir, templateProgramKey } from "@/lib/tadrib-funun";

export const dynamic = "force-dynamic";

// GET — data siap cetak untuk satu peserta (dipakai halaman cetak admin).
// Syarat: kehadiran >= minHadir jenisnya DAN syahadah sudah diterbitkan admin.
// Isi syahadah: nama santri + tanggal periode saja (nama ekstrakurikuler
// sudah ada di background template).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ pesertaId: string }> }
) {
  const session = await getSession();
  const hasPerm = await checkPermission("tadrib_funun");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pesertaId } = await params;

  const peserta = await prisma.tadribFununPeserta.findUnique({
    where: { id: pesertaId },
    include: {
      santri: { select: { nama: true } },
      jenis: { select: { id: true, nama: true, minHadir: true } },
      hadir: { orderBy: { pertemuanKe: "asc" }, select: { tanggal: true } },
    },
  });
  if (!peserta) return NextResponse.json({ error: "Peserta tidak ditemukan" }, { status: 404 });

  const minHadir = resolveTadribFununMinHadir(peserta.jenis.minHadir);
  if (peserta.hadir.length < minHadir) {
    return NextResponse.json({ error: "Kehadiran belum memenuhi batas minimal" }, { status: 400 });
  }
  if (!peserta.syahadahDiterbitkanAt) {
    return NextResponse.json({ error: "Syahadah belum diterbitkan admin" }, { status: 400 });
  }

  const template = await prisma.templateCetak.findUnique({
    where: { programKey: templateProgramKey(peserta.jenis.id) },
  });

  const tglDari = peserta.hadir.length
    ? peserta.hadir[0].tanggal.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const tglSampai = peserta.hadir.length
    ? peserta.hadir[peserta.hadir.length - 1].tanggal.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return NextResponse.json({
    nama: peserta.santri.nama || "-",
    periode: formatPeriodeArab(tglDari, tglSampai),
    kehadiran: peserta.hadir.length,
    dufahNama: peserta.dufahNama,
    jenisNama: peserta.jenis.nama,
    template: template
      ? {
          backgroundUrl: template.backgroundUrl,
          fieldPositions: template.fieldPositions,
        }
      : null,
  });
}
