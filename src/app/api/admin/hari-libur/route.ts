import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { cleanupAbsenKelasForLibur } from "@/lib/hari-libur";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bulan = searchParams.get("bulan"); // format: YYYY-MM
  
  let dateFilter = {};
  if (bulan) {
    const [year, month] = bulan.split("-");
    const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0, 23, 59, 59));
    
    dateFilter = {
      tanggal: {
        gte: startDate,
        lte: endDate
      }
    };
  }

  try {
    const hariLibur = await prisma.hariLibur.findMany({
      where: dateFilter,
      orderBy: { tanggal: "desc" }
    });
    return NextResponse.json(hariLibur);
  } catch (error) {
    return NextResponse.json({ error: "Gagal mengambil data hari libur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tanggal, nama, isSemuaSesi, sesiLibur, keterangan } = body;

    if (!tanggal || !nama) {
      return NextResponse.json({ error: "Tanggal dan Nama harus diisi" }, { status: 400 });
    }

    const tgl = new Date(`${tanggal}T00:00:00Z`); // pastikan tersimpan sebagai midnight UTC

    const newLibur = await prisma.hariLibur.create({
      data: {
        tanggal: tgl,
        nama,
        isSemuaSesi: isSemuaSesi ?? true,
        sesiLibur: sesiLibur || [],
        keterangan: keterangan || null
      }
    });

    // Jalankan pembersihan rekap absen yang terinjeksi izin sebelumnya
    await cleanupAbsenKelasForLibur(tgl, newLibur.isSemuaSesi, newLibur.sesiLibur);

    return NextResponse.json(newLibur);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Hari libur untuk tanggal tersebut sudah ada" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal membuat hari libur" }, { status: 500 });
  }
}
