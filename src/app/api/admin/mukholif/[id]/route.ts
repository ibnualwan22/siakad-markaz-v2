import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: Request, context: any) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get params from context
  const params = await Promise.resolve(context.params);
  const { id } = params;

  try {
    const laporan = await prisma.laporanMukholif.findUnique({
      where: { id },
      include: {
        pelanggarList: true,
        jasus: {
          select: {
            sakan: true,
            kamar: true,
            riwayatRecords: {
              orderBy: { id: 'desc' },
              take: 1,
              select: { kelas: { select: { nama: true } } }
            }
          }
        }
      }
    });

    if (!laporan) {
      return NextResponse.json({ error: "Laporan not found" }, { status: 404 });
    }

    return NextResponse.json(laporan);
  } catch (error) {
    console.error("Error fetching laporan detail:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
