import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";

export async function GET(request: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const records = await prisma.pelanggarMukholif.findMany({
      where: {
        statusTabayun: "PELANGGAR",
        OR: [
          { iqobSounding: true, iqobSoundingDone: false },
          { iqobJawal: true, iqobJawalDone: false },
          { iqobPenyetoran: true, iqobPenyetoranDone: false }
        ]
      },
      include: {
        laporan: {
          select: { waktuMelanggar: true, jasusNama: true }
        }
      },
      orderBy: { laporan: { waktuMelanggar: 'asc' } } // Oldest first to clear backlog
    });

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ error: "Gagal memuat tugas Lajnah" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { pelanggarId, iqobType } = await request.json(); 
    // iqobType: "SOUNDING" | "JAWAL" | "PENYETORAN"

    const dataToUpdate: any = {
      eksekusiAt: new Date(),
      eksekusiOleh: session.santriId // the ID of the santri acting as Lajnah
    };

    if (iqobType === "SOUNDING") dataToUpdate.iqobSoundingDone = true;
    else if (iqobType === "JAWAL") dataToUpdate.iqobJawalDone = true;
    else if (iqobType === "PENYETORAN") dataToUpdate.iqobPenyetoranDone = true;
    else return NextResponse.json({ error: "Invalid iqob type" }, { status: 400 });

    await prisma.pelanggarMukholif.update({
      where: { id: pelanggarId },
      data: dataToUpdate
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Gagal menyimpan eksekusi" }, { status: 500 });
  }
}
