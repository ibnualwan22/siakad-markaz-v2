import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";

export const dynamic = "force-dynamic";

// POST /api/santri/pemilihan-lajnah/vote — catat suara santri (1 santri = 1 suara)
export async function POST(req: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sesiId, paslonId } = await req.json();
    if (!sesiId || !paslonId) {
      return NextResponse.json({ error: "Sesi dan paslon wajib diisi" }, { status: 400 });
    }
    const santri = await prisma.santriInternal.findUnique({
      where: { id: session.santriId },
      select: { id: true, isAktif: true, dufahNama: true },
    });
    if (!santri || !santri.isAktif) {
      return NextResponse.json({ error: "Hanya santri aktif yang boleh memilih" }, { status: 403 });
    }
    const sesi = await prisma.sesiPemilihanLajnah.findUnique({ where: { id: sesiId } });
    if (!sesi || sesi.status !== "BUKA") {
      return NextResponse.json({ error: "Pemilihan tidak sedang dibuka" }, { status: 400 });
    }
    if (santri.dufahNama !== sesi.dufahNama) {
      return NextResponse.json({ error: "Kamu tidak terdaftar sebagai pemilih pada sesi ini" }, { status: 403 });
    }
    const paslon = await prisma.paslonLajnah.findFirst({ where: { id: paslonId, sesiId } });
    if (!paslon) {
      return NextResponse.json({ error: "Paslon tidak ditemukan" }, { status: 404 });
    }
    try {
      await prisma.suaraLajnah.create({
        data: { sesiId, paslonId, santriId: santri.id },
      });
    } catch {
      // Pelanggaran unique(sesiId, santriId) = sudah memilih
      return NextResponse.json({ error: "Kamu sudah memilih pada sesi ini" }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
