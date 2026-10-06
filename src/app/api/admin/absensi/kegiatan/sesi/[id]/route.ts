import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function checkAkses() {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "ADMIN") return session;
  const rp = await prisma.rolePermission.findMany({
    where: { role: session.role as any, permission: "pengaturan_kegiatan" },
  });
  return rp.length > 0 ? session : null;
}

/**
 * Tutup sesi scan. Sesuai desain baru: penutupan TIDAK menulis record otomatis.
 * Ia hanya mengunci scan; penentuan ALPHA/IZIN dilakukan eksplisit via finalisasi.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await checkAkses();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const sesi = await prisma.sesiAbsenKegiatan.findUnique({ where: { id } });
    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    if (sesi.metode !== "SCAN_PETUGAS") {
      return NextResponse.json({ error: "Bukan sesi scan petugas" }, { status: 400 });
    }
    if (sesi.isClosed) return NextResponse.json({ error: "Sesi sudah ditutup" }, { status: 400 });

    const updated = await prisma.sesiAbsenKegiatan.update({
      where: { id },
      data: { isClosed: true, ditutupPada: new Date() },
      include: { kategori: { select: { id: true, nama: true } } },
    });

    return NextResponse.json({ success: true, sesi: updated });
  } catch (error) {
    console.error("PATCH tutup sesi scan error", error);
    return NextResponse.json({ error: "Gagal menutup sesi" }, { status: 500 });
  }
}
