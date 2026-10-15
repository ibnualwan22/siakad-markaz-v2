import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PUT /api/admin/ujian-usbu/monitoring/tambah-waktu
 * Mengatur tambahan waktu (menit) untuk santri tertentu.
 * Body: { sesiUjianSantriId: string, tambahanMenit: number }
 *
 * Pengaman:
 * - tambahanMenit: integer 0-120
 * - Hanya untuk sesi dengan status MENGERJAKAN
 * - Butuh permission ujian_usbu (atau ADMIN)
 */
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { sesiUjianSantriId, tambahanMenit } = body;

    if (!sesiUjianSantriId) {
      return NextResponse.json({ error: "sesiUjianSantriId diperlukan" }, { status: 400 });
    }

    const menit = Number(tambahanMenit);
    if (!Number.isInteger(menit) || menit < 0 || menit > 120) {
      return NextResponse.json(
        { error: "tambahanMenit harus bilangan bulat 0-120" },
        { status: 400 }
      );
    }

    const sesiSantri = await prisma.sesiUjianSantri.findUnique({
      where: { id: sesiUjianSantriId },
      select: { id: true, status: true, tambahanMenit: true }
    });

    if (!sesiSantri) {
      return NextResponse.json({ error: "Sesi santri tidak ditemukan" }, { status: 404 });
    }

    if (sesiSantri.status !== "MENGERJAKAN") {
      return NextResponse.json(
        { error: `Tidak bisa ubah waktu: status santri sudah ${sesiSantri.status}` },
        { status: 400 }
      );
    }

    const updated = await prisma.sesiUjianSantri.update({
      where: { id: sesiUjianSantriId },
      data: { tambahanMenit: menit },
      select: { id: true, tambahanMenit: true }
    });

    return NextResponse.json({
      success: true,
      sesiUjianSantriId: updated.id,
      tambahanMenit: updated.tambahanMenit,
      message: menit === 0
        ? "Tambahan waktu dihapus (kembali normal)"
        : `Tambahan waktu ${menit} menit berhasil disimpan`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Terjadi kesalahan" }, { status: 500 });
  }
}
