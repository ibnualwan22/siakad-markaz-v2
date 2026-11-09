import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

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

// Riwayat pengumuman sekali-kirim: baris Pengumuman tanpa jadwal
// (jadwalId null), terbaru dulu. Dipakai tab "Kirim Sekali" sebagai daftar
// yang bisa dikirim ulang — isi lengkap disertakan agar admin bisa
// meninjau sebelum mengirim ulang.
export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const diminta = parseInt(searchParams.get("limit") || "", 10);
    const limit = Number.isNaN(diminta) ? 20 : Math.min(Math.max(diminta, 1), 50);

    const items = await prisma.pengumuman.findMany({
      where: { jadwalId: null },
      orderBy: { dibuatAt: "desc" },
      take: limit,
      select: {
        id: true,
        judul: true,
        isi: true,
        tautan: true,
        pengirimLabel: true,
        lembaga: true,
        dibuatAt: true,
      },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal memuat riwayat sekali-kirim" }, { status: 500 });
  }
}
