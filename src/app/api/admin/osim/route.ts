import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/admin/osim?dufah=Duf'ah 92
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dufahNama = searchParams.get("dufah");

  try {
    const whereClause: any = {};
    if (dufahNama) whereClause.dufahNama = dufahNama;

    const osimList = await prisma.anggotaOsim.findMany({
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

    return NextResponse.json(osimList);
  } catch (error) {
    console.error("Error fetching osim:", error);
    return NextResponse.json({ error: "Gagal memuat data osim" }, { status: 500 });
  }
}

// POST /api/admin/osim
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { santriId, dufahNama } = await request.json();

    if (!santriId || !dufahNama) {
      return NextResponse.json({ error: "Santri dan periode harus diisi" }, { status: 400 });
    }

    // Check if already exists
    const existing = await prisma.anggotaOsim.findUnique({
      where: {
        santriId_dufahNama: { santriId, dufahNama }
      }
    });

    if (existing) {
      return NextResponse.json({ error: "Santri ini sudah menjadi anggota OSIM pada periode tersebut" }, { status: 400 });
    }

    // OSIM hanya untuk santri Markaz Turats: riwayat pada periode itu harus
    // ber-program kategori TURATS.
    const riwayat = await prisma.riwayatSantri.findFirst({
      where: { santriId, dufahNama },
      include: { program: { select: { kategori: true } } },
    });
    if (riwayat?.program?.kategori !== "TURATS") {
      return NextResponse.json({ error: "Hanya santri Markaz Turats yang bisa menjadi anggota OSIM" }, { status: 400 });
    }

    const osim = await prisma.anggotaOsim.create({
      data: {
        santriId,
        dufahNama
      }
    });

    return NextResponse.json({ success: true, osim });
  } catch (error) {
    console.error("Error creating osim:", error);
    return NextResponse.json({ error: "Gagal menyimpan data osim" }, { status: 500 });
  }
}
