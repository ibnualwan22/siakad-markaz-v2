import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { validasiJadwal } from "./validasi";

// 401 bila tanpa sesi, 403 bila sesi ada tapi tanpa izin notifikasi_kelola.
async function guard() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ok = await checkPermission("notifikasi_kelola");
  if (!ok) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  return null;
}

const templateSelect = { select: { id: true, label: true, isActive: true } };

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    const jadwal = await prisma.notifikasiJadwal.findMany({
      orderBy: [{ waktu: "asc" }, { createdAt: "asc" }],
      include: { template: templateSelect },
    });
    return NextResponse.json(jadwal);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal memuat jadwal" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const body = await req.json();
    const hasil = validasiJadwal(body);
    if (!hasil.ok) {
      return NextResponse.json({ error: hasil.error }, { status: 400 });
    }
    const data = hasil.data;

    const template = await prisma.notifikasiTemplate.findUnique({
      where: { id: data.templateId },
    });
    if (!template || !template.isActive) {
      return NextResponse.json(
        { error: "Template pengirim tidak ditemukan atau tidak aktif" },
        { status: 400 }
      );
    }

    const jadwal = await prisma.notifikasiJadwal.create({
      data: {
        templateId: data.templateId,
        judul: data.judul,
        isi: data.isi,
        tautan: data.tautan,
        targetLembaga: data.targetLembaga as any,
        jenisJadwal: data.jenisJadwal,
        hari: data.hari,
        tanggal: data.tanggal,
        waktu: data.waktu,
        isActive: data.isActive,
      },
      include: { template: templateSelect },
    });
    return NextResponse.json(jadwal, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal membuat jadwal" }, { status: 500 });
  }
}
