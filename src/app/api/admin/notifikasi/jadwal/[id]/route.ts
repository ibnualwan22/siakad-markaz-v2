import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { validasiJadwal } from "../validasi";

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

type Ctx = { params: Promise<{ id: string }> };

const templateSelect = { select: { id: true, label: true, isActive: true } };

export async function GET(_req: Request, context: Ctx) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const jadwal = await prisma.notifikasiJadwal.findUnique({
      where: { id },
      include: { template: templateSelect },
    });
    if (!jadwal) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(jadwal);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal memuat jadwal" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: Ctx) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = await req.json();

    // PUT menerima payload penuh (seperti POST) maupun parsial — mis.
    // toggle aktif/nonaktif yang hanya mengirim { isActive }.
    // Field yang tidak dikirim diambil dari jadwal yang tersimpan, lalu
    // gabungannya divalidasi dengan aturan yang sama seperti POST.
    const lama = await prisma.notifikasiJadwal.findUnique({ where: { id } });
    if (!lama) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }
    const gabungan = {
      templateId: body?.templateId ?? lama.templateId,
      judul: body?.judul ?? lama.judul,
      isi: body?.isi ?? lama.isi,
      tautan: body?.tautan !== undefined ? body.tautan : lama.tautan,
      targetLembaga: body?.targetLembaga !== undefined ? body.targetLembaga : lama.targetLembaga,
      jenisJadwal: body?.jenisJadwal ?? lama.jenisJadwal,
      hari: body?.hari !== undefined ? body.hari : lama.hari,
      tanggal:
        body?.tanggal !== undefined
          ? body.tanggal
          : lama.tanggal
            ? lama.tanggal.toISOString().slice(0, 10)
            : null,
      waktu: body?.waktu ?? lama.waktu,
      isActive: body?.isActive ?? lama.isActive,
    };
    const hasil = validasiJadwal(gabungan);
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

    const jadwal = await prisma.notifikasiJadwal.update({
      where: { id },
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
    return NextResponse.json(jadwal);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Gagal mengubah jadwal" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Ctx) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    // Pengumuman & log lama tetap ada: FK jadwalId di schema SetNull.
    await prisma.notifikasiJadwal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Gagal menghapus jadwal" }, { status: 500 });
  }
}
