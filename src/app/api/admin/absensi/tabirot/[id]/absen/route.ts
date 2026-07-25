import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseWibDateString } from "@/lib/jadwal-sesi";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const tanggal = searchParams.get("tanggal");
  const { id } = await params;

  if (!tanggal) {
    return NextResponse.json({ error: "Tanggal harus diisi" }, { status: 400 });
  }

  try {
    const parsedDate = parseWibDateString(tanggal);
    
    const absenData = await prisma.absenTabirot.findMany({
      where: {
        kelompokId: id,
        tanggal: parsedDate,
      },
    });

    return NextResponse.json({ success: true, data: absenData });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal mengambil data absen" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const { tanggal, absenList } = payload as { 
      tanggal: string, 
      absenList: { santriId: string, status: any, keterangan?: string }[] 
    };

    if (!tanggal || !absenList || !Array.isArray(absenList)) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const parsedDate = parseWibDateString(tanggal);

    const toUpsert = absenList.filter((a: any) => a.status !== "KOSONG");
    const toDelete = absenList.filter((a: any) => a.status === "KOSONG");

    // Upsert each using transaction
    const operations: any[] = toUpsert.map((absen: any) =>
      prisma.absenTabirot.upsert({
        where: {
          kelompokId_santriId_tanggal: {
            kelompokId: id,
            santriId: absen.santriId,
            tanggal: parsedDate,
          },
        },
        update: {
          status: absen.status,
          keterangan: absen.keterangan || null,
        },
        create: {
          kelompokId: id,
          santriId: absen.santriId,
          tanggal: parsedDate,
          status: absen.status,
          keterangan: absen.keterangan || null,
        },
      })
    );

    if (toDelete.length > 0) {
      operations.push(
        prisma.absenTabirot.deleteMany({
          where: {
            kelompokId: id,
            tanggal: parsedDate,
            santriId: { in: toDelete.map((d: any) => d.santriId) }
          }
        })
      );
    }

    await prisma.$transaction(operations);

    return NextResponse.json({ success: true, count: operations.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal menyimpan absensi" }, { status: 500 });
  }
}
