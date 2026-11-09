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

// Kirim ulang satu pengumuman sekali-kirim: isinya yang sama (judul, isi,
// tautan, pengirim, target) terkirim lagi sebagai pengumuman BARU — santri
// menerimanya sebagai pengumuman baru di inbox. Hanya untuk pengumuman
// tanpa jadwal; pengumuman dari jadwal dikirim ulang lewat jadwalnya.
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const p = await prisma.pengumuman.findUnique({ where: { id } });
    if (!p) {
      return NextResponse.json({ error: "Pengumuman tidak ditemukan" }, { status: 404 });
    }
    if (p.jadwalId) {
      return NextResponse.json(
        { error: "Hanya pengumuman sekali-kirim yang bisa dikirim ulang dari sini" },
        { status: 400 }
      );
    }

    const hasil = await kirimPengumuman({
      jadwalId: null,
      templateLabel: p.pengirimLabel,
      judul: p.judul,
      isi: p.isi,
      tautan: p.tautan,
      targetLembaga: normalisasiTargetLembaga(p.lembaga),
    });
    return NextResponse.json({ success: true, ...hasil });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal mengirim ulang pengumuman" }, { status: 500 });
  }
}
