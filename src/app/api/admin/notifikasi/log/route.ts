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

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const diminta = parseInt(searchParams.get("limit") || "", 10);
    const limit = Number.isNaN(diminta) ? 50 : Math.min(Math.max(diminta, 1), 100);

    const logs = await prisma.notifikasiLog.findMany({
      orderBy: { sentAt: "desc" },
      take: limit,
      include: {
        jadwal: { select: { id: true, judul: true } },
        pengumuman: { select: { id: true, judul: true, pengirimLabel: true } },
      },
    });
    return NextResponse.json(logs);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal memuat riwayat pengiriman" }, { status: 500 });
  }
}
