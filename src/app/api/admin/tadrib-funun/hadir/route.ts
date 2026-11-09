import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { TADRIB_FUNUN_MAX_PERTEMUAN } from "@/lib/tadrib-funun";

export const dynamic = "force-dynamic";

// GET ?pesertaId=... — daftar hadir satu peserta
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("tadrib_funun");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pesertaId = searchParams.get("pesertaId");
  if (!pesertaId) return NextResponse.json({ error: "pesertaId wajib diisi" }, { status: 400 });

  const hadir = await prisma.tadribFununHadir.findMany({
    where: { pesertaId },
    include: { pencatat: { select: { nama: true } } },
    orderBy: { pertemuanKe: "asc" },
  });

  return NextResponse.json(hadir);
}

// POST — upsert hadir per pertemuan. pencatatId otomatis dari admin yang login.
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("tadrib_funun_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pesertaId, pertemuanKe, tanggal } = body;

  if (!pesertaId || !pertemuanKe || !tanggal) {
    return NextResponse.json(
      { error: "pesertaId, pertemuanKe, dan tanggal wajib diisi" },
      { status: 400 }
    );
  }
  if (pertemuanKe < 1 || pertemuanKe > TADRIB_FUNUN_MAX_PERTEMUAN) {
    return NextResponse.json(
      { error: `pertemuanKe harus 1-${TADRIB_FUNUN_MAX_PERTEMUAN}` },
      { status: 400 }
    );
  }

  const saved = await prisma.tadribFununHadir.upsert({
    where: { pesertaId_pertemuanKe: { pesertaId, pertemuanKe: Number(pertemuanKe) } },
    update: { tanggal: new Date(tanggal), pencatatId: session.userId },
    create: {
      pesertaId,
      pertemuanKe: Number(pertemuanKe),
      tanggal: new Date(tanggal),
      pencatatId: session.userId,
    },
  });

  return NextResponse.json(saved);
}

// DELETE ?id=...
export async function DELETE(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("tadrib_funun_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });

  await prisma.tadribFununHadir.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
