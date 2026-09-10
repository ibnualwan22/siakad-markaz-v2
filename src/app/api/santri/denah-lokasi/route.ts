import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const data = await prisma.lokasiDenah.findMany({
      where: { isActive: true },
      orderBy: { nama: "asc" },
    });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error GET /api/santri/denah-lokasi", error);
    return NextResponse.json(
      { error: "Gagal mengambil rute." },
      { status: 500 }
    );
  }
}
