import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";

export async function GET(request: Request) {
  const session = await getSantriSession();
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const santriList = await prisma.santriInternal.findMany({
      where: {
        nama: {
          contains: query,
          mode: "insensitive"
        },
        isAktif: true
      },
      select: {
        id: true,
        nama: true,
        sakan: true,
        kamar: true,
        riwayatRecords: {
          orderBy: { id: 'desc' },
          take: 1,
          select: {
            kelas: {
              select: { nama: true }
            }
          }
        }
      },
      take: 10
    });

    const formattedList = santriList.map(s => ({
      id: s.id,
      nama: s.nama,
      kelas: s.riwayatRecords[0]?.kelas?.nama || "Tanpa Kelas",
      asrama: s.sakan ? `${s.sakan} - ${s.kamar || ''}` : "Tanpa Asrama"
    }));

    return NextResponse.json(formattedList);
  } catch (error) {
    console.error("Error search santri:", error);
    return NextResponse.json({ error: "Gagal mencari data santri" }, { status: 500 });
  }
}
