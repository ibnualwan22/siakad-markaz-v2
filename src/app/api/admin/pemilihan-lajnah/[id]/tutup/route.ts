import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const PERMISSION = "lajnah_manage";

async function authorize() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") {
    const p = await prisma.rolePermission.findUnique({
      where: { role_permission: { role: session.role, permission: PERMISSION } },
    });
    if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// POST /api/admin/pemilihan-lajnah/[id]/tutup — tutup sesi & tetapkan pemenang.
// Paslon suara terbanyak (seri: nomor urut terkecil) otomatis jadi AnggotaLajnah.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id } = await params;
    const sesi = await prisma.sesiPemilihanLajnah.findUnique({
      where: { id },
      include: {
        paslonList: {
          orderBy: { nomorUrut: "asc" },
          include: {
            santri1: { select: { id: true, nama: true } },
            santri2: { select: { id: true, nama: true } },
          },
        },
      },
    });
    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    if (sesi.status !== "BUKA") {
      return NextResponse.json({ error: "Hanya sesi yang sedang BUKA yang bisa ditutup" }, { status: 400 });
    }
    const counts = await prisma.suaraLajnah.groupBy({
      by: ["paslonId"],
      where: { sesiId: id },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.paslonId, c._count._all]));
    const hasil = sesi.paslonList
      .map((p) => ({ ...p, suara: countMap.get(p.id) || 0 }))
      .sort((a, b) => b.suara - a.suara || a.nomorUrut - b.nomorUrut);
    const pemenang = hasil[0] || null;

    await prisma.$transaction(async (tx) => {
      if (pemenang) {
        // Pemenang (rois + wakil) otomatis menjadi anggota lajnah
        await tx.anggotaLajnah.createMany({
          data: [
            { santriId: pemenang.santri1Id, dufahNama: sesi.dufahNama },
            { santriId: pemenang.santri2Id, dufahNama: sesi.dufahNama },
          ],
          skipDuplicates: true,
        });
      }
      await tx.sesiPemilihanLajnah.update({
        where: { id },
        data: { status: "TUTUP", ditutupAt: new Date() },
      });
    });

    const totalSuara = hasil.reduce((s, h) => s + h.suara, 0);
    return NextResponse.json({
      pemenang: pemenang
        ? { id: pemenang.id, nomorUrut: pemenang.nomorUrut, suara: pemenang.suara, santri1: pemenang.santri1, santri2: pemenang.santri2 }
        : null,
      totalSuara,
      hasil: hasil.map((h) => ({
        id: h.id,
        nomorUrut: h.nomorUrut,
        suara: h.suara,
        santri1: h.santri1,
        santri2: h.santri2,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
