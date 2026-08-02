import { NextResponse } from "next/server";
import { getSantriSession } from "@/lib/santri-auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getSantriSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { sesiId, soalId, opsiId, rpiId } = body; // rpiId = tag ragu-ragu

    if (!sesiId || !soalId) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    // Validasi SESI
    const sesi = await prisma.sesiUjianSantri.findUnique({
      where: { id: sesiId },
      include: { riwayat: true, paket: { include: { sesiGlobal: true } } }
    });

    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    
    // Validasi own santri
    if (sesi.riwayat.santriId !== session.santriId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (sesi.status !== "MENGERJAKAN") {
      return NextResponse.json({ error: "Ujian sudah ditutup" }, { status: 400 });
    }

    // Check time limit
    const durasiReal = sesi.paket.sesiGlobal.durasiMenit;
    const batasWaktu = new Date(sesi.waktuMulai.getTime() + (durasiReal + 2) * 60000);
    if (new Date() > batasWaktu) {
       return NextResponse.json({ error: "Waktu sudah habis" }, { status: 400 });
    }

    // Update Jawaban
    const jawaban = await prisma.jawabanUjianSantri.upsert({
      where: {
        sesiId_soalId: {
          sesiId,
          soalId
        }
      },
      update: {
        opsiId: opsiId !== undefined ? opsiId : undefined,
        rpiId: rpiId !== undefined ? rpiId : undefined,
      },
      create: {
        sesiId,
        soalId,
        opsiId,
        rpiId
      }
    });

    return NextResponse.json({ success: true, jawabanId: jawaban.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
