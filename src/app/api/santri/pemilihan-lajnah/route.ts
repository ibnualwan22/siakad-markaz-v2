import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { tutupPemilihanKedaluwarsa } from "@/lib/pemilihan-lajnah";

export const dynamic = "force-dynamic";

// GET /api/santri/pemilihan-lajnah?sesiId= — info sesi untuk santri.
// Tanpa sesiId: ambil sesi BUKA terbaru di dufah santri, kalau tidak ada ambil TUTUP terbaru (hasil).
export async function GET(req: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const santri = await prisma.santriInternal.findUnique({
      where: { id: session.santriId },
      select: { id: true, nama: true, dufahNama: true, isAktif: true },
    });
    if (!santri) return NextResponse.json({ error: "Santri tidak ditemukan" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const sesiIdParam = searchParams.get("sesiId");

    const includePaslon = {
      paslonList: {
        orderBy: { nomorUrut: "asc" as const },
        include: {
          santri1: { select: { id: true, nama: true } },
          santri2: { select: { id: true, nama: true } },
        },
      },
    };

    let sesi = null;
    if (sesiIdParam) {
      sesi = await prisma.sesiPemilihanLajnah.findUnique({ where: { id: sesiIdParam }, include: includePaslon });
      if (!sesi || sesi.dufahNama !== santri.dufahNama) {
        return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
      }
    } else if (santri.dufahNama) {
      sesi =
        (await prisma.sesiPemilihanLajnah.findFirst({
          where: { dufahNama: santri.dufahNama, status: "BUKA" },
          orderBy: { dibukaAt: "desc" },
          include: includePaslon,
        })) ||
        (await prisma.sesiPemilihanLajnah.findFirst({
          where: { dufahNama: santri.dufahNama, status: "TUTUP" },
          orderBy: { ditutupAt: "desc" },
          include: includePaslon,
        }));
    }
    if (!sesi) return NextResponse.json({ sesi: null, serverNow: new Date().toISOString() });

    await tutupPemilihanKedaluwarsa(prisma, sesi.id);
    sesi = await prisma.sesiPemilihanLajnah.findUnique({ where: { id: sesi.id }, include: includePaslon });
    if (!sesi) return NextResponse.json({ sesi: null, serverNow: new Date().toISOString() });

    const counts = await prisma.suaraLajnah.groupBy({
      by: ["paslonId"],
      where: { sesiId: sesi.id },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.paslonId, c._count._all]));
    const totalSuara = counts.reduce((s, c) => s + c._count._all, 0);

    const myVote = await prisma.suaraLajnah.findUnique({
      where: { sesiId_santriId: { sesiId: sesi.id, santriId: santri.id } },
      select: { paslonId: true },
    });

    return NextResponse.json({
      serverNow: new Date().toISOString(),
      sesi: {
        id: sesi.id,
        judul: sesi.judul,
        dufahNama: sesi.dufahNama,
        status: sesi.status,
        rencanaTutupAt: sesi.rencanaTutupAt,
        dibukaAt: sesi.dibukaAt,
        ditutupAt: sesi.ditutupAt,
      },
      paslon: sesi.paslonList.map((p) => ({
        id: p.id,
        nomorUrut: p.nomorUrut,
        fotoUrl: p.fotoUrl,
        visiMisi: p.visiMisi,
        santri1: p.santri1,
        santri2: p.santri2,
        suara: countMap.get(p.id) || 0,
      })),
      totalSuara,
      sudahMemilih: !!myVote,
      pilihanSaya: myVote?.paslonId || null,
      bolehMemilih: sesi.status === "BUKA" && santri.isAktif,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat sesi" }, { status: 500 });
  }
}
