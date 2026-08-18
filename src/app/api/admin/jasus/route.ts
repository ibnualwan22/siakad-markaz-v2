import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/admin/jasus?dufah=xxx
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dufahNama = searchParams.get("dufah");

  try {
    const whereClause: any = {};
    if (dufahNama) whereClause.dufahNama = dufahNama;

    const jasusList = await prisma.anggotaJasus.findMany({
      where: whereClause,
      include: {
        santri: {
          select: { nama: true, sakan: true, kamar: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(jasusList);
  } catch (error) {
    console.error("Error fetching jasus:", error);
    return NextResponse.json({ error: "Gagal memuat data jasus" }, { status: 500 });
  }
}

// POST /api/admin/jasus — supports bulk add via santriIds[]
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { santriIds, dufahNama } = body;

    if (!santriIds || !Array.isArray(santriIds) || santriIds.length === 0 || !dufahNama) {
      return NextResponse.json({ error: "santriIds[] dan dufahNama wajib diisi" }, { status: 400 });
    }

    // Filter out already-existing members
    const existing = await prisma.anggotaJasus.findMany({
      where: {
        dufahNama,
        santriId: { in: santriIds }
      },
      select: { santriId: true }
    });
    const existingIds = new Set(existing.map(e => e.santriId));
    const newIds = santriIds.filter((id: string) => !existingIds.has(id));

    if (newIds.length === 0) {
      return NextResponse.json({ error: "Semua santri yang dipilih sudah terdaftar sebagai Jasus" }, { status: 400 });
    }

    await prisma.anggotaJasus.createMany({
      data: newIds.map((santriId: string) => ({ santriId, dufahNama })),
      skipDuplicates: true
    });

    return NextResponse.json({ success: true, added: newIds.length });
  } catch (error) {
    console.error("Error creating jasus:", error);
    return NextResponse.json({ error: "Gagal menambah jasus" }, { status: 500 });
  }
}
