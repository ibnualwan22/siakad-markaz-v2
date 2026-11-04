import { requirePermission } from "@/lib/permission";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// Penanda syahadah ditahan untuk prosesi Haflah Wada' (per santri per dufah).
// HANYA dipakai halaman haflah-wada: denah & pemanggilan. Cetak, status
// kelulusan, dan portal santri TIDAK membaca penanda ini.

export async function GET(req: Request) {
  try {
    await requirePermission("haflah_wada");
    const { searchParams } = new URL(req.url);
    const dufahNama = searchParams.get("dufahNama");
    if (!dufahNama) {
      return NextResponse.json({ message: "dufahNama wajib diisi" }, { status: 400 });
    }
    const rows = await prisma.syahadahDitahan.findMany({
      where: { dufahNama },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ ok: true, ditahan: rows });
  } catch (error: any) {
    console.error("GET /api/admin/haflah-wada/ditahan error:", error);
    return NextResponse.json(
      { message: error.message || "Gagal memuat daftar ditahan" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("haflah_wada");
    const body = await req.json();
    const { santriId, dufahNama, ditahan, catatan } = body ?? {};
    if (!santriId || !dufahNama || typeof ditahan !== "boolean") {
      return NextResponse.json(
        { message: "santriId, dufahNama, dan ditahan wajib diisi" },
        { status: 400 }
      );
    }
    if (ditahan) {
      await prisma.syahadahDitahan.upsert({
        where: { santriId_dufahNama: { santriId, dufahNama } },
        update: { catatan: catatan ?? null },
        create: { santriId, dufahNama, catatan: catatan ?? null },
      });
    } else {
      await prisma.syahadahDitahan.deleteMany({
        where: { santriId, dufahNama },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("POST /api/admin/haflah-wada/ditahan error:", error);
    return NextResponse.json(
      { message: error.message || "Gagal menyimpan penanda ditahan" },
      { status: 500 }
    );
  }
}
