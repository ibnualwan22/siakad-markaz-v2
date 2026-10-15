import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function checkAuth() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.role !== "ADMIN") {
    const p = await prisma.rolePermission.findUnique({
      where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
    });
    if (!p) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/**
 * GET /api/admin/ujian-usbu/sesi/tambah-waktu-bulk?sesiId=X
 * Jumlah santri MENGERJAKAN per paket dalam satu sesi global.
 */
export async function GET(req: Request) {
  const auth = await checkAuth();
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(req.url);
    const sesiId = searchParams.get("sesiId");
    if (!sesiId) return NextResponse.json({ error: "sesiId diperlukan" }, { status: 400 });

    const counts = await prisma.sesiUjianSantri.groupBy({
      by: ["paketId"],
      where: {
        status: "MENGERJAKAN",
        paket: { sesiGlobalId: sesiId }
      },
      _count: { id: true }
    });

    const map: Record<string, number> = {};
    for (const c of counts) map[c.paketId] = c._count.id;
    return NextResponse.json({ counts: map });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Terjadi kesalahan" }, { status: 500 });
  }
}

/**
 * POST /api/admin/ujian-usbu/sesi/tambah-waktu-bulk
 * Body: { paketIds: string[], menit: number }
 * Menambah (akumulasi) tambahanMenit untuk semua santri MENGERJAKAN di paket terpilih.
 */
export async function POST(req: Request) {
  const auth = await checkAuth();
  if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const { paketIds, menit } = body;

    if (!Array.isArray(paketIds) || paketIds.length === 0) {
      return NextResponse.json({ error: "Pilih minimal satu kelas" }, { status: 400 });
    }
    const m = Number(menit);
    if (!Number.isInteger(m) || m < 1 || m > 120) {
      return NextResponse.json({ error: "Menit harus bilangan bulat 1-120" }, { status: 400 });
    }

    const result = await prisma.sesiUjianSantri.updateMany({
      where: {
        paketId: { in: paketIds },
        status: "MENGERJAKAN"
      },
      data: { tambahanMenit: { increment: m } }
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
      menit: m,
      message: `+${m} menit diterapkan ke ${result.count} santri`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Terjadi kesalahan" }, { status: 500 });
  }
}
