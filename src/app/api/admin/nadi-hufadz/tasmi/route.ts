import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { NADI_HUFADZ_MIN_HADIR, PREDIKAT_TASMI } from "@/lib/nadi-hufadz";

export const dynamic = "force-dynamic";

// GET ?pesertaId=... atau ?dufahNama=...
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pesertaId = searchParams.get("pesertaId");

  if (pesertaId) {
    const tasmi = await prisma.nadiHufadzTasmi.findUnique({
      where: { pesertaId },
      include: { penguji: { select: { nama: true } } },
    });
    return NextResponse.json(tasmi);
  }

  const dufahNama = searchParams.get("dufahNama");
  if (!dufahNama) return NextResponse.json({ error: "pesertaId/dufahNama wajib diisi" }, { status: 400 });

  const list = await prisma.nadiHufadzTasmi.findMany({
    where: { peserta: { dufahNama } },
    include: {
      penguji: { select: { nama: true } },
      peserta: { include: { santri: { select: { nama: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(list);
}

// POST { pesertaId, juzTeks, predikat, tanggal } — hanya bila kehadiran >= 7
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pesertaId, juzTeks, predikat, tanggal } = body;

  if (!pesertaId || !juzTeks || !predikat || !tanggal) {
    return NextResponse.json(
      { error: "pesertaId, juzTeks, predikat, dan tanggal wajib diisi" },
      { status: 400 }
    );
  }
  if (!(PREDIKAT_TASMI as readonly string[]).includes(predikat)) {
    return NextResponse.json({ error: "predikat tidak valid" }, { status: 400 });
  }

  const jumlahHadir = await prisma.nadiHufadzSetoran.count({ where: { pesertaId } });
  if (jumlahHadir < NADI_HUFADZ_MIN_HADIR) {
    return NextResponse.json(
      { error: `Kehadiran baru ${jumlahHadir}x, minimal ${NADI_HUFADZ_MIN_HADIR}x untuk tasmi'` },
      { status: 400 }
    );
  }

  const saved = await prisma.nadiHufadzTasmi.upsert({
    where: { pesertaId },
    update: { juzTeks, predikat, tanggal: new Date(tanggal), pengujiId: session.userId },
    create: { pesertaId, juzTeks, predikat, tanggal: new Date(tanggal), pengujiId: session.userId },
  });

  return NextResponse.json(saved);
}

// DELETE ?id=...
export async function DELETE(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });

  await prisma.nadiHufadzTasmi.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
