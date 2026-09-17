import { NextResponse } from "next/server";
import { getSantriSession } from "@/lib/santri-auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getSantriSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const sesiId = searchParams.get("sesiId");

    if (!sesiId) {
      return NextResponse.json({ error: "Sesi ujian tidak valid" }, { status: 400 });
    }

    // 1. Ambil data sesi santri & validasi kepemilikan
    const sesiSantri = await prisma.sesiUjianSantri.findUnique({
      where: { id: sesiId },
      include: {
        jawabanList: true,
        paket: {
          include: {
            sesiGlobal: true,
            soalPaketList: {
              include: {
                soal: {
                  include: {
                    opsiList: true,
                    mapel: true
                  }
                }
              },
              orderBy: { urutan: 'asc' }
            }
          }
        },
        riwayat: true
      }
    });

    if (!sesiSantri) return NextResponse.json({ error: "Sesi Ujian tidak ditemukan" }, { status: 404 });
    if (sesiSantri.riwayat.santriId !== session.santriId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (sesiSantri.status === "MENGERJAKAN") return NextResponse.json({ error: "Ujian masih berlangsung, tidak bisa direview" }, { status: 400 });

    // 2. Cek izin showReview
    if (!sesiSantri.paket.sesiGlobal.showReview) {
      return NextResponse.json({ error: "Hak akses review untuk ujian ini sedang ditutup" }, { status: 403 });
    }

    // 3. Mapping data ke bentuk grouping: Mapel -> Tipe Soal
    // Gunakan Map untuk mengelompokkan
    const mapGrouping = new Map<string, {
      namaMapel: string,
      namaMapelArab: string,
      totalBobot: number,
      totalScore: number,
      tipeGroupMap: Map<string, any>
    }>();

    for (const soalPaket of sesiSantri.paket.soalPaketList) {
      const soal = soalPaket.soal;
      const mapelId = soal.mapelId;
      const mapel = soal.mapel;
      
      if (!mapGrouping.has(mapelId)) {
        mapGrouping.set(mapelId, {
          namaMapel: mapel.nama_indo || "Tanpa Nama",
          namaMapelArab: mapel.nama_arab || "Tanpa Nama",
          totalBobot: 0,
          totalScore: 0,
          tipeGroupMap: new Map<string, any>()
        });
      }

      const mGroup = mapGrouping.get(mapelId)!;
      mGroup.totalBobot += soal.bobot;

      const tipeSoal = soal.tipeSoal;
      if (!mGroup.tipeGroupMap.has(tipeSoal)) {
        mGroup.tipeGroupMap.set(tipeSoal, {
          tipeSoal,
          soalList: [],
          summary: { benar: 0, salah: 0, kosong: 0, totalBobot: 0 }
        });
      }

      const tGroup = mGroup.tipeGroupMap.get(tipeSoal)!;
      tGroup.summary.totalBobot += soal.bobot;

      const jawaban = sesiSantri.jawabanList.find(j => j.soalId === soal.id);
      
      const isEssay = tipeSoal.startsWith("ESSAY");
      let isCorrect: boolean | null = null;
      let calculatedScore = 0;

      // Hitung correctness (sama dengan logika hasil)
      if (jawaban) {
        if (jawaban.nilaiManual !== null) {
          calculatedScore = jawaban.nilaiManual;
          isCorrect = calculatedScore > 0 ? (calculatedScore === soal.bobot ? true : null) : false; // null means partial
        } else if (["PG", "BENAR_SALAH", "MUFRODAT", "ISIAN_SAMPING", "ISIAN_BAWAH"].includes(tipeSoal)) {
          const opsiBenar = soal.opsiList.find(o => o.isCorrect)?.id;
          if (jawaban.opsiId && jawaban.opsiId === opsiBenar) {
            isCorrect = true;
            calculatedScore = soal.bobot;
          } else if (jawaban.jawabanTeks && soal.kunciJawaban && jawaban.jawabanTeks.trim().toLowerCase() === soal.kunciJawaban.trim().toLowerCase()) {
            isCorrect = true;
            calculatedScore = soal.bobot;
          } else {
            isCorrect = false;
          }
        } else if (tipeSoal === "PG_MULTI") {
           const correctIds = soal.opsiList.filter(o => o.isCorrect).map(o => o.id);
           const jawData = typeof jawaban.jawabanData === 'string' ? JSON.parse(jawaban.jawabanData) : jawaban.jawabanData;
           const selectedIds = jawData?.selectedIds || [];
           if (correctIds.length > 0 && correctIds.length === selectedIds.length && selectedIds.every((id: string) => correctIds.includes(id))) {
             isCorrect = true;
             calculatedScore = soal.bobot;
           } else {
             isCorrect = false;
           }
        }
      }

      if (jawaban && !isEssay) {
        if (isCorrect === true) tGroup.summary.benar++;
        else if (isCorrect === false) tGroup.summary.salah++;
        else tGroup.summary.kosong++; // Partial / complex structural
      } else if (!jawaban && !isEssay) {
        tGroup.summary.kosong++;
      }
      
      mGroup.totalScore += calculatedScore;

      const parsedTambahan = soal.dataTambahan ? (typeof soal.dataTambahan === 'string' ? JSON.parse(soal.dataTambahan) : soal.dataTambahan) : null;
      const parsedJawabanData = jawaban?.jawabanData ? (typeof jawaban.jawabanData === 'string' ? JSON.parse(jawaban.jawabanData) : jawaban.jawabanData) : null;

      tGroup.soalList.push({
        nomor: tGroup.soalList.length + 1, // Akan direset ulang nanti agar penomoran per mapel berurutan
        pertanyaan: soal.pertanyaan,
        gambarUrl: soal.gambarUrl,
        bobot: soal.bobot,
        tipeSoal: soal.tipeSoal,
        // Jawaban Santri
        jawabanSantri: jawaban ? {
          opsiId: jawaban.opsiId,
          jawabanTeks: jawaban.jawabanTeks,
          jawabanData: parsedJawabanData
        } : null,
        isCorrect,
        // Essay fields
        isEssay,
        statusEssay: isEssay ? (jawaban?.nilaiManual !== null ? "SUDAH_DIKOREKSI" : "MENUNGGU_DIKOREKSI") : null,
        skorEssay: isEssay ? jawaban?.nilaiManual : null, 
        
        // Kunci (JANGAN DIKIRIM UNTUK ESSAY)
        opsiList: isEssay ? null : soal.opsiList,
        kunciJawaban: isEssay ? null : soal.kunciJawaban,
        dataTambahan: isEssay ? null : parsedTambahan
      });
    }

    // 4. Transform Map into ordered array
    const resultMapels = Array.from(mapGrouping.values()).map(mg => {
      // Re-numbering from 1..N across all TipeSoal continuously
      let globalNumber = 1;
      
      const groups = Array.from(mg.tipeGroupMap.values()).map(tg => {
         tg.soalList = tg.soalList.map((s: any) => {
           s.nomor = globalNumber++;
           return s;
         });
         return tg;
      });

      return {
        namaMapel: mg.namaMapel,
        namaMapelArab: mg.namaMapelArab,
        totalBobot: mg.totalBobot,
        totalScore: Number(mg.totalScore.toFixed(2)),
        groups
      };
    });

    return NextResponse.json({
      paketNama: sesiSantri.paket.nama,
      mapels: resultMapels
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
