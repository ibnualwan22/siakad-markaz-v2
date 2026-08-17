import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Current total active santri
    const totalSantriAktif = await prisma.santriInternal.count({
      where: { isAktif: true }
    });

    // We'll calculate stats based on the last 5 weeks grouping by ISO week
    // Doing this in SQL is more efficient but we'll do it via basic Prisma query then map it in memory.
    
    // Get date 5 weeks ago
    const fiveWeeksAgo = new Date();
    fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35);

    const pelanggarRecords = await prisma.pelanggarMukholif.findMany({
      where: {
        statusTabayun: "PELANGGAR",
        laporan: {
          createdAt: {
            gte: fiveWeeksAgo
          }
        }
      },
      include: {
        laporan: {
          select: { createdAt: true }
        }
      }
    });

    // Group by week of year approx
    const getWeekKey = (d: Date) => {
      const year = d.getFullYear();
      // basic week number calculation
      const firstDay = new Date(year, 0, 1);
      const days = Math.floor((d.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000));
      const week = Math.ceil(days / 7);
      return `Minggu ${week}, ${year}`;
    };

    const groupedData: Record<string, Set<string>> = {};

    pelanggarRecords.forEach((p: any) => {
      const wKey = getWeekKey(p.laporan.createdAt);
      if (!groupedData[wKey]) {
        groupedData[wKey] = new Set();
      }
      groupedData[wKey].add(p.santriId);
    });

    const chartData = Object.keys(groupedData).map(key => {
      const totalPelanggarUnique = groupedData[key].size;
      const percentage = totalSantriAktif > 0 ? (totalPelanggarUnique / totalSantriAktif) * 100 : 0;
      return {
        name: key,
        pelanggar: totalPelanggarUnique,
        persentase: parseFloat(percentage.toFixed(2))
      };
    });

    return NextResponse.json({
      totalSantriAktif,
      chartData
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
