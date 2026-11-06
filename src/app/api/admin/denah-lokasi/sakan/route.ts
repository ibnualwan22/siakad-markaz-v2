import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Daftar sakan terdaftar: nama-nama sakan yang dipakai data santri.
// Dipakai dropdown admin denah-lokasi (tidak ada tabel master sakan).
export async function GET() {
  try {
    const rows = await prisma.santriInternal.findMany({
      select: { sakan: true },
      distinct: ["sakan"],
      where: { sakan: { not: null } },
    });
    const data = rows
      .map((r) => (r.sakan || "").trim())
      .filter((s) => s.length > 0)
      .sort((a, b) => a.localeCompare(b, "id"));
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error GET /api/admin/denah-lokasi/sakan", error);
    return NextResponse.json(
      { error: "Gagal mengambil daftar sakan." },
      { status: 500 }
    );
  }
}
