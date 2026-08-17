import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permission manually or handle it on layout? Let's check manually here too for security
  if (session.role !== "ADMIN") {
    const rolePerms = await prisma.rolePermission.findMany({
      where: { role: session.role as any, permission: "mukholif_lughoh" }
    });
    if (rolePerms.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") || "MENUNGGU"; // MENUNGGU | SELESAI | ALL
  const q = searchParams.get("q") || "";

  try {
    const whereClause: any = {};
    if (statusFilter !== "ALL") {
      whereClause.status = statusFilter;
    }

    if (q) {
      whereClause.pelanggarList = {
        some: {
          santri: {
            nama: { contains: q, mode: 'insensitive' }
          }
        }
      };
    }

    const laporanList = await prisma.laporanMukholif.findMany({
      where: whereClause,
      include: {
        pelanggarList: {
          select: { 
            id: true, 
            statusTabayun: true, 
            jumlahTidakHadir: true, 
            tabayunAt: true,
            santri: { select: { nama: true } }
          }
        },
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
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(laporanList);
  } catch (error) {
    console.error("Error fetching admin laporan mukholif:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
