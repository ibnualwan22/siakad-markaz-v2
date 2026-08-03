import { NextResponse } from "next/server";
import { getSantriSession } from "@/lib/santri-auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSantriSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const santri = await prisma.santriInternal.findUnique({
      where: { id: session.santriId },
      include: {
        riwayatRecords: {
          orderBy: { dufahNama: 'desc' },
          take: 1
        }
      }
    });

    if (!santri || santri.riwayatRecords.length === 0) {
      return NextResponse.json({ error: "Riwayat santri tidak ditemukan" }, { status: 404 });
    }

    const riwayat = santri.riwayatRecords[0];

    // Ambil program dari kelas santri (prioritas), fallback ke program riwayat
    const kelasData = riwayat.kelasId ? await prisma.kelas.findUnique({
      where: { id: riwayat.kelasId },
      select: { programId: true }
    }) : null;

    const programIdForExam = kelasData?.programId || riwayat.programId;

    if (!programIdForExam) {
      return NextResponse.json({ error: "Santri belum memiliki program/kelas" }, { status: 400 });
    }

    // Cari paket ujian yang tersedia untuk program kelas ini
    const paketTersedia = await prisma.paketUjian.findMany({
      where: {
        programId: programIdForExam
      },
      include: {
        sesiList: {
          where: { riwayatId: riwayat.id }
        },
        sesiGlobal: true,
        soalPaketList: {
          select: {
            soal: {
              select: { mapelId: true }
            }
          }
        }
      },
      orderBy: { sesiGlobal: { waktuMulai: 'desc' } }
    });

    const nilaiRecords = await prisma.nilai.findMany({
      where: { riwayatId: riwayat.id },
      include: { mapel: { select: { nama_indo: true } } }
    });

    const data = paketTersedia.map(p => {
      const sesi = p.sesiList.length > 0 ? p.sesiList[0] : null;
      
      let finalStatus = "BELUM_MULAI";
      if (sesi) finalStatus = sesi.status;
      else if (!p.sesiGlobal.isActive) finalStatus = "BELUM_DIBUKA";

      let mapelScores: any[] = [];
      if (sesi && (sesi.status === 'SELESAI' || sesi.status === 'AUTO_SUBMIT')) {
        // Collect distinct mapelIds inside this paket
        const mapelIds = Array.from(new Set(p.soalPaketList.map((sp: any) => sp.soal.mapelId)));
        
        mapelScores = mapelIds.map(mId => {
          const rec = nilaiRecords.find(n => n.mapelId === mId);
          let score = null;
          if (rec) {
             if (p.sesiGlobal.usbuKe === 1) score = rec.nilaiUsbu1;
             else if (p.sesiGlobal.usbuKe === 2) score = rec.nilaiUsbu2;
             else score = rec.nilaiNihai;
          }
          return { mapelName: rec?.mapel.nama_indo || "Unknown", score };
        });
      }

      return {
        id: p.id,
        nama: p.nama.replace(/\s*\(P\.\s*[a-zA-Z0-9]+\)\s*$/i, ''),
        usbuKe: p.sesiGlobal.usbuKe,
        durasiMenit: p.sesiGlobal.durasiMenit,
        jumlahSoal: p.soalPaketList.length,
        status: finalStatus,
        sesiId: sesi ? sesi.id : null,
        nilaiTotal: sesi ? sesi.nilaiTotal : null,
        tanggalBuka: p.sesiGlobal.waktuMulai,
        waktuMulaiSantri: sesi?.waktuMulai || null,
        waktuSelesaiSantri: sesi?.waktuSelesai || null,
        mapelScores
      };
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
