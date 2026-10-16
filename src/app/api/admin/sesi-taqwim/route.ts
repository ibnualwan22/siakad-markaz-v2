import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Taqwim kini global: satu konfigurasi untuk semua program
    const config = await prisma.sesiTaqwim.findFirst();

    const tanggalList = await prisma.tanggalTaqwim.findMany({
      orderBy: { tanggal: 'asc' }
    });

    return NextResponse.json({ config, tanggalList });
  } catch (error) {
    console.error("Gagal memuat sesi taqwim", error);
    return NextResponse.json({ error: "Failed to fetch sesi taqwim" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("manajemen_sesi");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { jamBuka, jamTutup, toleransiMenit, isActive } = body;

    if (!jamBuka || !jamTutup) {
      return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
    }

    const existing = await prisma.sesiTaqwim.findFirst();

    const data = existing
      ? await prisma.sesiTaqwim.update({
          where: { id: existing.id },
          data: {
            jamBuka,
            jamTutup,
            toleransiMenit: toleransiMenit !== undefined ? Number(toleransiMenit) : 15,
            isActive: Boolean(isActive)
          }
        })
      : await prisma.sesiTaqwim.create({
          data: {
            jamBuka,
            jamTutup,
            toleransiMenit: toleransiMenit !== undefined ? Number(toleransiMenit) : 15,
            isActive: Boolean(isActive)
          }
        });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Gagal menyimpan sesi taqwim", error);
    return NextResponse.json({ error: "Gagal menyimpan sesi taqwim" }, { status: 500 });
  }
}
