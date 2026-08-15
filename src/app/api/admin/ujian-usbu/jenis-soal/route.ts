import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mapelId = searchParams.get("mapelId");

    if (!mapelId) {
      return NextResponse.json({ error: "mapelId diperlukan" }, { status: 400 });
    }

    const jenisSoalList = await prisma.jenisSoal.findMany({
      where: { mapelId },
      orderBy: { urutan: "asc" },
    });

    return NextResponse.json(jenisSoalList);
  } catch (error: any) {
    console.error("GET JenisSoal Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data jenis soal" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { mapelId, nama } = await req.json();

    if (!mapelId || !nama) {
      return NextResponse.json({ error: "mapelId dan nama diperlukan" }, { status: 400 });
    }

    // Get current max urutan
    const lastItem = await prisma.jenisSoal.findFirst({
      where: { mapelId },
      orderBy: { urutan: "desc" },
    });
    
    const urutan = lastItem ? lastItem.urutan + 1 : 1;

    const newJenisSoal = await prisma.jenisSoal.create({
      data: {
        mapelId,
        nama,
        urutan,
      },
    });

    return NextResponse.json(newJenisSoal);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Nama jenis soal sudah ada untuk mapel ini" }, { status: 400 });
    }
    console.error("POST JenisSoal Error:", error);
    return NextResponse.json({ error: "Gagal membuat jenis soal" }, { status: 500 });
  }
}
