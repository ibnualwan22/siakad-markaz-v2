import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/admin/lajnah?dufah=Duf'ah 92
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dufahNama = searchParams.get("dufah");

  try {
    const whereClause: any = {};
    if (dufahNama) whereClause.dufahNama = dufahNama;

    const lajnahList = await prisma.anggotaLajnah.findMany({
      where: whereClause,
      include: {
        santri: {
          select: {
            nama: true,
            sakan: true,
            kamar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(lajnahList);
  } catch (error) {
    console.error("Error fetching lajnah:", error);
    return NextResponse.json({ error: "Gagal memuat data lajnah" }, { status: 500 });
  }
}

// POST /api/admin/lajnah
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { santriId, dufahNama } = await request.json();

    if (!santriId || !dufahNama) {
      return NextResponse.json({ error: "Santri ID dan Dufah harus diisi" }, { status: 400 });
    }

    // Check if already exists
    const existing = await prisma.anggotaLajnah.findUnique({
      where: {
        santriId_dufahNama: { santriId, dufahNama }
      }
    });

    if (existing) {
      return NextResponse.json({ error: "Santri ini sudah menjadi anggota Lajnah di Dufah tersebut" }, { status: 400 });
    }

    const lajnah = await prisma.anggotaLajnah.create({
      data: {
        santriId,
        dufahNama
      }
    });

    return NextResponse.json({ success: true, lajnah });
  } catch (error) {
    console.error("Error creating lajnah:", error);
    return NextResponse.json({ error: "Gagal menyimpan data lajnah" }, { status: 500 });
  }
}
