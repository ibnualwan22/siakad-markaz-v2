import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getActiveDufahName } from "@/lib/absensi";
import { NADI_HUFADZ_MIN_HADIR } from "@/lib/nadi-hufadz";

export const dynamic = "force-dynamic";

// GET ?dufahNama=... — daftar peserta + hitung kehadiran + status tasmi'
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dufahNama = searchParams.get("dufahNama") || (await getActiveDufahName()) || "";

  const peserta = await prisma.nadiHufadzPeserta.findMany({
    where: { dufahNama },
    include: {
      santri: { select: { id: true, nama: true } },
      setoran: { select: { id: true } },
      tasmi: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const data = peserta.map((p) => ({
    id: p.id,
    santriId: p.santriId,
    nama: p.santri.nama,
    tanggalDaftar: p.tanggalDaftar,
    kehadiran: p.setoran.length,
    eligibleTasmi: p.setoran.length >= NADI_HUFADZ_MIN_HADIR,
    tasmi: p.tasmi,
  }));

  return NextResponse.json({ dufahNama, data });
}

// POST { santriId, dufahNama? } — tambah peserta
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { santriId } = body;
  if (!santriId) {
    return NextResponse.json({ error: "santriId wajib diisi" }, { status: 400 });
  }
  const dufahNama = body.dufahNama || (await getActiveDufahName()) || "";
  if (!dufahNama) {
    return NextResponse.json({ error: "Dufah aktif tidak ditemukan" }, { status: 400 });
  }

  const created = await prisma.nadiHufadzPeserta.upsert({
    where: { santriId_dufahNama: { santriId, dufahNama } },
    update: {},
    create: { santriId, dufahNama },
  });

  return NextResponse.json(created);
}

// DELETE ?id=... — hapus peserta (cascade setoran & tasmi')
export async function DELETE(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });

  await prisma.nadiHufadzPeserta.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
