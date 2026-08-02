import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  
  // Jika dia bukan super admin, filter program berdasarkan kewenangan mengajarnya
  let whereClause: any = {};
  if (session && session.role !== "ADMIN") {
    const orConditions = [];
    
    if (session.kelasId) {
      orConditions.push({ kelasList: { some: { id: session.kelasId } } });
    }
    
    // Check if they are teaching specific programs
    orConditions.push({ pengajarSesiProgramList: { some: { userId: session.userId } } });
    
    whereClause = { OR: orConditions };
  }

  const programs = await prisma.program.findMany({
    where: whereClause,
    include: {
      programMapels: {
        include: { mapel: true },
        orderBy: { urutan: "asc" },
      },
      _count: { select: { riwayatRecords: true } },
    },
    orderBy: { nama_indo: "asc" },
  });

  return NextResponse.json(programs);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nama_indo, nama_arab, kkm, kategori } = body;

    if (!nama_indo?.trim() || !nama_arab?.trim() || kkm == null) {
      return NextResponse.json({ error: "Semua field wajib diisi." }, { status: 400 });
    }

    const existing = await prisma.program.findUnique({ where: { nama_indo: nama_indo.trim() } });
    if (existing) {
      return NextResponse.json({ error: "Nama program sudah digunakan." }, { status: 400 });
    }

    const program = await prisma.program.create({
      data: {
        nama_indo: nama_indo.trim(),
        nama_arab: nama_arab.trim(),
        kkm: Number(kkm),
        kategori: kategori === "TURATS" ? "TURATS" : "REGULER",
      },
    });

    return NextResponse.json({ success: true, program });
  } catch (error) {
    console.error("Error creating program:", error);
    return NextResponse.json({ error: "Gagal membuat program." }, { status: 500 });
  }
}
