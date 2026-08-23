import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { recalculateSesiNilai } from "@/lib/recalculate-sesi-nilai";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filterStatus = searchParams.get("status") || "ALL"; // PENDING, GRADED, ALL
    const filterKelasId = searchParams.get("kelasId") || "ALL";

    // 1. Fetch matching soal (essay types)
    const matchingSoals = await prisma.bankSoalUsbu.findMany({
      where: {
        tipeSoal: { in: ["ESSAY_SINGKAT", "ESSAY_PANJANG"] }
      },
      include: { mapel: true }
    });
    const soalIds = matchingSoals.map(s => s.id);

    // 2. Fetch jawaban for these soal
    const whereClause: any = {
      soalId: { in: soalIds }
    };

    if (filterStatus === "PENDING") {
      whereClause.nilaiManual = null;
    } else if (filterStatus === "GRADED") {
      whereClause.nilaiManual = { not: null };
    }

    if (filterKelasId !== "ALL") {
      whereClause.sesi = {
        riwayat: {
          kelasId: filterKelasId
        }
      };
    }

    const data = await prisma.jawabanUjianSantri.findMany({
      where: whereClause,
      include: {
        sesi: {
          include: { 
            riwayat: {
              include: { kelas: true }
            }, 
            paket: true 
          }
        }
      },
      orderBy: { sesiId: 'asc' }
    });

    // 3. Attach soal to jawaban
    const enrichedData = data.map(jaw => ({
      ...jaw,
      soal: matchingSoals.find(s => s.id === jaw.soalId)
    }));

    return NextResponse.json(enrichedData);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "ADMIN") {
       const p = await prisma.rolePermission.findUnique({
         where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
       });
       if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, nilaiManual } = await req.json();

    if (!id || (typeof nilaiManual !== 'number' && nilaiManual !== null)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // @ts-ignore
    const jaw = await prisma.jawabanUjianSantri.update({
      where: { id },
      data: { nilaiManual }
    });

    if (jaw && jaw.sesiId) {
      await recalculateSesiNilai(jaw.sesiId);
    }

    return NextResponse.json({ success: true, jaw });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
