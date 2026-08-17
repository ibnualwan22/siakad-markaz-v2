import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getActiveDufahName } from "@/lib/absensi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(request.url);
    const usbuFilter = url.searchParams.get("usbu") || "ALL";

    const activeDufahName = await getActiveDufahName();
    let dufah = null;
    let chartData: { name: string; pelanggar: number; persentase: number }[] = [];

    if (activeDufahName) {
      dufah = await prisma.dufah.findUnique({ where: { nama: activeDufahName } });
    }

    // Current total active santri
    const totalSantriAktif = await prisma.santriInternal.count({
      where: { isAktif: true }
    });

    if (dufah) {
      let startDate: Date | null | undefined = null;
      let endDate: Date | null | undefined = null;

      if (usbuFilter === "usbu1") {
        startDate = dufah.usbu1StartDate;
        endDate = dufah.usbu1EndDate;
      } else if (usbuFilter === "usbu2") {
        startDate = dufah.usbu2StartDate;
        endDate = dufah.usbu2EndDate;
      } else if (usbuFilter === "usbu3") {
        startDate = dufah.usbu3StartDate;
        endDate = dufah.usbu3EndDate;
      } else {
        // "ALL" - spans the earliest to the latest
        startDate = dufah.usbu1StartDate;
        endDate = dufah.usbu3EndDate || dufah.usbu2EndDate || dufah.usbu1EndDate;
      }

      if (startDate && endDate) {
        const queryEndDate = new Date(endDate);
        queryEndDate.setHours(23, 59, 59, 999);

        const pelanggarRecords = await prisma.pelanggarMukholif.findMany({
          where: {
            statusTabayun: "PELANGGAR",
            laporan: {
              waktuMelanggar: {
                gte: startDate,
                lte: queryEndDate
              }
            }
          },
          include: {
            laporan: { select: { waktuMelanggar: true } }
          }
        });

        // Group by Date string
        const violationsByDate: Record<string, Set<string>> = {};
        pelanggarRecords.forEach((p: any) => {
          if (p.laporan?.waktuMelanggar) {
            // Local date mapping
            const d = new Date(p.laporan.waktuMelanggar);
            const dateStr = d.toLocaleDateString("en-CA"); // YYYY-MM-DD local
            if (!violationsByDate[dateStr]) {
              violationsByDate[dateStr] = new Set();
            }
            violationsByDate[dateStr].add(p.santriId);
          }
        });

        const formatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
        
        let current = new Date(startDate);
        current.setHours(0, 0, 0, 0); // normalize start to midnight
        
        const limit = new Date(endDate);
        limit.setHours(23, 59, 59, 999);

        let safetyCounter = 0;
        while (current <= limit && safetyCounter < 100) {
          safetyCounter++;
          const dateStr = current.toLocaleDateString("en-CA");
          const uniqueSantri = violationsByDate[dateStr]?.size || 0;
          const percentage = totalSantriAktif > 0 ? (uniqueSantri / totalSantriAktif) * 100 : 0;
          
          chartData.push({
            name: formatter.format(current),
            pelanggar: uniqueSantri,
            persentase: parseFloat(percentage.toFixed(2))
          });

          // Next day
          current.setDate(current.getDate() + 1);
        }
      }
    }

    // Top Jasus (All time)
    const topJasusQuery = await prisma.laporanMukholif.findMany({
      where: {
        pelanggarList: {
          some: {
            statusTabayun: "PELANGGAR"
          }
        }
      },
      select: {
        jasusNama: true,
        jasus: {
          select: {
            sakan: true,
            kamar: true
          }
        },
        pelanggarList: {
          select: {
            statusTabayun: true
          }
        }
      }
    });

    const jasusScores: Record<string, { nama: string, sakan: string, score: number }> = {};

    topJasusQuery.forEach(laporan => {
      const validReports = laporan.pelanggarList.filter(p => p.statusTabayun === "PELANGGAR").length;
      if (validReports > 0) {
        if (!jasusScores[laporan.jasusNama]) {
          jasusScores[laporan.jasusNama] = {
            nama: laporan.jasusNama,
            sakan: laporan.jasus?.sakan ? `${laporan.jasus.sakan} - ${laporan.jasus.kamar || ''}` : "Tanpa Asrama",
            score: 0
          };
        }
        jasusScores[laporan.jasusNama].score += validReports;
      }
    });

    const topJasus = Object.values(jasusScores).sort((a, b) => b.score - a.score).slice(0, 10);

    return NextResponse.json({
      totalSantriAktif,
      activeDufah: activeDufahName || "Tidak Ada Data",
      chartData,
      topJasus
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
