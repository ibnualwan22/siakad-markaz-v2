import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseWibDateString } from "@/lib/jadwal-sesi";
import { generateNomorTasrih } from "@/lib/perizinan-utils";
import { TipeIzin } from "@prisma/client";
import { getSantriSession } from "@/lib/santri-auth";

export async function POST(request: Request) {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { riwayatIds, tipeIzin, alasan, tanggalMulai, tanggalSelesai } = body;

    if (!riwayatIds || riwayatIds.length === 0 || !tipeIzin || !alasan || !tanggalMulai) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    // Izin Harian dan Ta'birot hanya dibuat admin (halaman admin),
    // bukan dari portal santri — pengajuan santri hanya Keluar Pare
    // dan Berhari-hari.
    if (tipeIzin === "HARIAN" || tipeIzin === "TABIROT") {
      return NextResponse.json(
        { error: "Izin Harian dan Ta'birot hanya dapat dibuat oleh admin" },
        { status: 403 }
      );
    }

    const tglMulai = parseWibDateString(tanggalMulai);
    const tglSelesai = tanggalSelesai ? parseWibDateString(tanggalSelesai) : null;

    const operations = [];
    const grupTasrihId = crypto.randomUUID();

    for (const riwayatId of riwayatIds) {
      const nomorTasrih = await generateNomorTasrih(tglMulai);
      
      const newIzin = await prisma.perizinan.create({
        data: {
          riwayatId,
          tipeIzin: tipeIzin as TipeIzin,
          alasan,
          tanggalMulai: tglMulai,
          tanggalSelesai: tglSelesai,
          statusIzin: "MENUNGGU", // Status menunggu approval dari keamanan
          nomorTasrih,
          isFromPublic: false,
          createdBy: session.nama, // Penanggung Jawab
          grupTasrihId
        }
      });
      
      operations.push(newIzin);
    }

    return NextResponse.json({ success: true, count: operations.length, grupTasrihId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal memproses perizinan" }, { status: 500 });
  }
}
