import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { kirimPengumuman } from "@/lib/notifikasi-kirim";
import { normalisasiTargetLembaga } from "@/lib/notifikasi-target";

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

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const jadwal = await prisma.notifikasiJadwal.findUnique({
      where: { id },
      include: { template: { select: { label: true } } },
    });
    if (!jadwal) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }

    // kirimPengumuman sekaligus memperbarui lastSentAt jadwal (dan
    // menonaktifkan jadwal TANGGAL) — jadi cron tidak mengirim ulang
    // hari ini. Itu perilaku yang diinginkan untuk kirim manual.
    const hasil = await kirimPengumuman({
      jadwalId: jadwal.id,
      templateLabel: jadwal.template.label,
      judul: jadwal.judul,
      isi: jadwal.isi,
      tautan: jadwal.tautan,
      targetLembaga: normalisasiTargetLembaga(jadwal.targetLembaga),
    });

    return NextResponse.json({ success: true, ...hasil });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal mengirim pengumuman" }, { status: 500 });
  }
}
