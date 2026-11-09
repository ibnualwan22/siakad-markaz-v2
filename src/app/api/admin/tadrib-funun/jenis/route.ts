import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import {
  resolveTadribFununMinHadir,
  validasiTadribFununMinHadir,
} from "@/lib/tadrib-funun";

export const dynamic = "force-dynamic";

// GET — daftar semua jenis (termasuk yang nonaktif) + jumlah peserta
export async function GET() {
  const session = await getSession();
  const hasPerm = await checkPermission("tadrib_funun");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jenis = await prisma.tadribFununJenis.findMany({
    include: { _count: { select: { peserta: true } } },
    orderBy: { nama: "asc" },
  });

  return NextResponse.json(
    jenis.map((j) => ({
      id: j.id,
      nama: j.nama,
      deskripsi: j.deskripsi,
      isActive: j.isActive,
      minHadir: resolveTadribFununMinHadir(j.minHadir),
      jumlahPeserta: j._count.peserta,
      createdAt: j.createdAt,
    }))
  );
}

// POST { nama, deskripsi?, minHadir?, isActive? } — tambah jenis baru
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("tadrib_funun_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const nama = String(body.nama || "").trim();
  if (!nama) return NextResponse.json({ error: "nama wajib diisi" }, { status: 400 });
  if (body.minHadir !== undefined) {
    const err = validasiTadribFununMinHadir(body.minHadir);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  try {
    const jenis = await prisma.tadribFununJenis.create({
      data: {
        nama,
        deskripsi: body.deskripsi ? String(body.deskripsi).trim() || null : null,
        minHadir: body.minHadir !== undefined ? body.minHadir : undefined,
        isActive: body.isActive !== false,
      },
    });
    return NextResponse.json(jenis);
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: `Jenis "${nama}" sudah ada` }, { status: 400 });
    }
    throw e;
  }
}

// PATCH { id, nama?, deskripsi?, minHadir?, isActive? } — ubah jenis
export async function PATCH(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("tadrib_funun_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  if (body.minHadir !== undefined) {
    const err = validasiTadribFununMinHadir(body.minHadir);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const data: any = {};
  if (body.nama !== undefined) {
    const nama = String(body.nama || "").trim();
    if (!nama) return NextResponse.json({ error: "nama tidak boleh kosong" }, { status: 400 });
    data.nama = nama;
  }
  if (body.deskripsi !== undefined) {
    data.deskripsi = body.deskripsi ? String(body.deskripsi).trim() || null : null;
  }
  if (body.minHadir !== undefined) data.minHadir = body.minHadir;
  if (body.isActive !== undefined) data.isActive = !!body.isActive;

  try {
    const jenis = await prisma.tadribFununJenis.update({
      where: { id: body.id },
      data,
    });
    return NextResponse.json(jenis);
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Nama jenis sudah dipakai jenis lain" }, { status: 400 });
    }
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Jenis tidak ditemukan" }, { status: 404 });
    }
    throw e;
  }
}
