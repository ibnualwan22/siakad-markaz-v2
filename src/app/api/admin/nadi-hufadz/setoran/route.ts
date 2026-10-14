import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { NADI_HUFADZ_MAX_PERTEMUAN } from "@/lib/nadi-hufadz";

export const dynamic = "force-dynamic";

// GET ?pesertaId=... — daftar setoran satu peserta
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pesertaId = searchParams.get("pesertaId");
  if (!pesertaId) return NextResponse.json({ error: "pesertaId wajib diisi" }, { status: 400 });

  const setoran = await prisma.nadiHufadzSetoran.findMany({
    where: { pesertaId },
    include: { penyimak: { select: { nama: true } } },
    orderBy: { pertemuanKe: "asc" },
  });

  return NextResponse.json(setoran);
}

// POST — upsert setoran per pertemuan. penyimakId otomatis dari admin yang login.
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pesertaId, pertemuanKe, tanggal, juz, surat, ayat, lulus, catatan } = body;

  if (!pesertaId || !pertemuanKe || !tanggal) {
    return NextResponse.json(
      { error: "pesertaId, pertemuanKe, dan tanggal wajib diisi" },
      { status: 400 }
    );
  }
  if (pertemuanKe < 1 || pertemuanKe > NADI_HUFADZ_MAX_PERTEMUAN) {
    return NextResponse.json(
      { error: `pertemuanKe harus 1-${NADI_HUFADZ_MAX_PERTEMUAN}` },
      { status: 400 }
    );
  }

  const saved = await prisma.nadiHufadzSetoran.upsert({
    where: { pesertaId_pertemuanKe: { pesertaId, pertemuanKe: Number(pertemuanKe) } },
    update: {
      tanggal: new Date(tanggal),
      juz: juz || null,
      surat: surat || null,
      ayat: ayat || null,
      lulus: lulus !== false,
      penyimakId: session.userId,
      catatan: catatan || null,
    },
    create: {
      pesertaId,
      pertemuanKe: Number(pertemuanKe),
      tanggal: new Date(tanggal),
      juz: juz || null,
      surat: surat || null,
      ayat: ayat || null,
      lulus: lulus !== false,
      penyimakId: session.userId,
      catatan: catatan || null,
    },
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

  await prisma.nadiHufadzSetoran.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
