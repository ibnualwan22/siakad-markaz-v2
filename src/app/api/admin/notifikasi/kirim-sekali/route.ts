import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { kirimPengumuman } from "@/lib/notifikasi-kirim";
import { validasiIsiPengumuman } from "../jadwal/validasi";

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

// Kirim pengumuman sekali pakai (tanpa jadwal): isi ditulis di form tab
// "Kirim Sekali", langsung terkirim ke semua jalur (FCM + web push +
// inbox santri) dan tercatat di riwayat. Tidak ada baris jadwal yang dibuat.
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const body = await req.json();
    const hasil = validasiIsiPengumuman(body);
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

    const kirim = await kirimPengumuman({
      jadwalId: null,
      templateLabel: template.label,
      judul: data.judul,
      isi: data.isi,
      tautan: data.tautan,
      targetLembaga: data.targetLembaga,
    });
    return NextResponse.json({ success: true, ...kirim });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal mengirim pengumuman" }, { status: 500 });
  }
}
