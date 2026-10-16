import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const globalSesi = await prisma.jadwalSesi.findMany({
      orderBy: { sesi: 'asc' }
    });

    const sesiTambahan = await prisma.sesiTambahanProgram.findMany({
      orderBy: { sesi: 'asc' }
    });

    // Taqwim kini global: satu konfigurasi + daftar tanggal untuk semua program
    const taqwimConfig = await prisma.sesiTaqwim.findFirst();
    const taqwimTanggal = await prisma.tanggalTaqwim.findMany();

    return NextResponse.json({
      globalSesi,
      sesiTambahan,
      taqwim: {
        config: taqwimConfig,
        tanggalList: taqwimTanggal
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch full jadwal sesi" }, { status: 500 });
  }
}
