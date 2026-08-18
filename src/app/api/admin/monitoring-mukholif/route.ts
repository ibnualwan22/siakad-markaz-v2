import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const statusEks = searchParams.get("statusEks") || "ALL"; // ALL, BELUM, MENUNGGU_VERIF, TUNTAS
  const q = searchParams.get("q") || "";

  try {
    const whereClause: any = {
      statusTabayun: "PELANGGAR"
    };

    if (q) {
      whereClause.santriNama = { contains: q, mode: 'insensitive' };
    }

    const records = await prisma.pelanggarMukholif.findMany({
      where: whereClause,
      include: {
        laporan: {
          select: {
            waktuMelanggar: true,
            tempatMelanggar: true,
            jasusNama: true
          }
        },
        santri: {
          select: { nama: true }
        }
      },
      orderBy: { laporan: { waktuMelanggar: 'desc' } }
    });

    // In-memory filter for statusEks since boolean logic can be complex in prisma
    const filteredRecords = records.filter((p) => {
      const hasIqob = p.iqobSounding || p.iqobJawal || p.iqobPenyetoran;
      const allDone = (!p.iqobSounding || p.iqobSoundingDone) && 
                      (!p.iqobJawal || p.iqobJawalDone) && 
                      (!p.iqobPenyetoran || p.iqobPenyetoranDone);
      
      const isVerified = p.verifikasiAt !== null;
      
      if (statusEks === "ALL") return true;
      if (statusEks === "BELUM") {
        if (!hasIqob) return false;
        return !allDone;
      }
      if (statusEks === "TUNTAS") {
        if (!hasIqob) return true; // Tuntas secara default karena tidak ada kewajiban
        return allDone;
      }
      return true;
    });

    return NextResponse.json(filteredRecords);
  } catch (error) {
    console.error("Error monitoring:", error);
    return NextResponse.json({ error: "Gagal memuat monitoring" }, { status: 500 });
  }
}
