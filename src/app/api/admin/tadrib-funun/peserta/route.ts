import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getActiveDufahName } from "@/lib/absensi";
import { resolveTadribFununMinHadir } from "@/lib/tadrib-funun";

export const dynamic = "force-dynamic";

// GET ?dufahNama=...&jenisId=... — daftar peserta + kehadiran + status syahadah
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("tadrib_funun");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dufahNama = searchParams.get("dufahNama") || (await getActiveDufahName()) || "";
  const jenisId = searchParams.get("jenisId") || "";

  const peserta = await prisma.tadribFununPeserta.findMany({
    where: { dufahNama, ...(jenisId ? { jenisId } : {}) },
    include: {
      santri: { select: { id: true, nama: true } },
      jenis: { select: { id: true, nama: true, minHadir: true } },
      hadir: { select: { id: true } },
      penerbit: { select: { nama: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const data = peserta.map((p) => {
    const minHadir = resolveTadribFununMinHadir(p.jenis.minHadir);
    return {
      id: p.id,
      santriId: p.santriId,
      nama: p.santri.nama,
      jenis: { id: p.jenis.id, nama: p.jenis.nama },
      tanggalDaftar: p.tanggalDaftar,
      kehadiran: p.hadir.length,
      minHadir,
      eligible: p.hadir.length >= minHadir,
      diterbitkan: !!p.syahadahDiterbitkanAt,
      diterbitkanAt: p.syahadahDiterbitkanAt,
      diterbitkanOleh: p.penerbit?.nama || null,
    };
  });

  return NextResponse.json({ dufahNama, data });
}

// POST { santriId, jenisId, dufahNama? } — tambah peserta manual (admin)
// Satu santri boleh mengikuti lebih dari satu jenis per dufah; yang
// ditolak hanya duplikat jenis yang sama pada dufah yang sama.
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("tadrib_funun_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { santriId, jenisId } = body;
  if (!santriId || !jenisId) {
    return NextResponse.json({ error: "santriId dan jenisId wajib diisi" }, { status: 400 });
  }
  const dufahNama = body.dufahNama || (await getActiveDufahName()) || "";
  if (!dufahNama) return NextResponse.json({ error: "Dufah tidak ditemukan" }, { status: 400 });

  const jenis = await prisma.tadribFununJenis.findUnique({ where: { id: jenisId } });
  if (!jenis || !jenis.isActive) {
    return NextResponse.json({ error: "Jenis tidak ditemukan atau tidak aktif" }, { status: 400 });
  }

  const sudah = await prisma.tadribFununPeserta.findUnique({
    where: { santriId_dufahNama_jenisId: { santriId, dufahNama, jenisId } },
    include: { jenis: { select: { nama: true } } },
  });
  if (sudah) {
    return NextResponse.json(
      { error: `Santri sudah terdaftar di ${sudah.jenis.nama} pada ${dufahNama}` },
      { status: 409 }
    );
  }

  const peserta = await prisma.tadribFununPeserta.create({
    data: { santriId, jenisId, dufahNama },
  });
  return NextResponse.json(peserta);
}
