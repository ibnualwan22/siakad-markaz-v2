import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { resolveTadribFununMinHadir } from "@/lib/tadrib-funun";

export const dynamic = "force-dynamic";

// POST { pesertaId, aksi: "terbitkan" | "batalkan" } — menerbitkan / membatalkan
// syahadah oleh admin. Terbit hanya bila kehadiran >= minHadir jenis peserta.
// Syahadah tidak terbit otomatis — langkah ini yang mengizinkan santri mencetak.
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("tadrib_funun_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pesertaId, aksi } = body;
  if (!pesertaId) return NextResponse.json({ error: "pesertaId wajib diisi" }, { status: 400 });
  if (aksi !== "terbitkan" && aksi !== "batalkan") {
    return NextResponse.json({ error: 'aksi harus "terbitkan" atau "batalkan"' }, { status: 400 });
  }

  const peserta = await prisma.tadribFununPeserta.findUnique({
    where: { id: pesertaId },
    include: {
      jenis: { select: { nama: true, minHadir: true } },
      hadir: { select: { id: true } },
    },
  });
  if (!peserta) return NextResponse.json({ error: "Peserta tidak ditemukan" }, { status: 404 });

  if (aksi === "terbitkan") {
    const minHadir = resolveTadribFununMinHadir(peserta.jenis.minHadir);
    if (peserta.hadir.length < minHadir) {
      return NextResponse.json(
        { error: `Kehadiran ${peserta.hadir.length}/${minHadir} belum memenuhi batas minimal untuk ${peserta.jenis.nama}` },
        { status: 400 }
      );
    }
    const updated = await prisma.tadribFununPeserta.update({
      where: { id: pesertaId },
      data: { syahadahDiterbitkanAt: new Date(), syahadahDiterbitkanOleh: session.userId },
    });
    return NextResponse.json({ ok: true, diterbitkanAt: updated.syahadahDiterbitkanAt });
  }

  const updated = await prisma.tadribFununPeserta.update({
    where: { id: pesertaId },
    data: { syahadahDiterbitkanAt: null, syahadahDiterbitkanOleh: null },
  });
  return NextResponse.json({ ok: true, diterbitkanAt: updated.syahadahDiterbitkanAt });
}
