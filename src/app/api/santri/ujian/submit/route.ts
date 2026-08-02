import { NextResponse } from "next/server";
import { getSantriSession } from "@/lib/santri-auth";
import prisma from "@/lib/prisma";
import { calcMapelNilaiAkhir, calcMapelNilaiAkhirUsbuain2, calcAkbarnasMapelAverage } from "@/lib/grade-calculator";

export async function POST(req: Request) {
  try {
    const session = await getSantriSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { sesiId, reason } = body;

    if (!sesiId) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const sesi = await prisma.sesiUjianSantri.findUnique({
      where: { id: sesiId },
      include: {
        paket: {
          include: {
            sesiGlobal: true,
            program: true,
            soalPaketList: {
              include: {
                soal: {
                  include: {
                    opsiList: {
                      where: { isCorrect: true } // Hanya ambil jawaban benar
                    },
                    mapel: true
                  }
                }
              }
            }
          }
        },
        jawabanList: true,
        riwayat: true
      }
    });

    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    if (sesi.riwayat.santriId !== session.santriId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (sesi.status !== "MENGERJAKAN") return NextResponse.json({ error: "Ujian ini sudah ditutup/disubmit sebelumnya" }, { status: 400 });

    const paket = sesi.paket;
    const isAkbarnas = paket.program.nama_indo.toLowerCase().includes('akbarnas');
    const riwayatId = sesi.riwayatId;
    const effectiveUsbuainMode = sesi.riwayat.jumlah_kolom_usbu ?? (await prisma.kelas.findUnique({ where: { id: sesi.riwayat.kelasId || "" } }))?.jumlah_kolom_usbu ?? 0;

    // Kelompokkan soal per mapel
    const soalPerMapel = new Map<string, any[]>();
    for (const sp of paket.soalPaketList) {
      const mapelId = sp.soal.mapelId;
      if (!soalPerMapel.has(mapelId)) soalPerMapel.set(mapelId, []);
      soalPerMapel.get(mapelId)!.push(sp.soal);
    }

    // Identifikasi jawaban santri
    const jawabanMap = new Map<string, string | null>(); // soalId -> opsiId
    for (const j of sesi.jawabanList) {
      jawabanMap.set(j.soalId, j.opsiId);
    }

    let totalSkorSeluruh = 0;
    const recordsMapel = [];

    const timeCompleted = new Date();
    const isCheat = !["MANUAL", "TIME_UP", "FORCE_SUBMIT"].includes(reason);
    const statusSubmit = (isCheat || reason === "TIME_UP" || reason === "FORCE_SUBMIT") ? "AUTO_SUBMIT" : "SELESAI";

    // Hitung per mapel dan masukkan ke tabel Nilai
    for (const [mapelId, listSoal] of soalPerMapel.entries()) {
      const mapel = listSoal[0].mapel; // ambil obyek mapel
      
      let sumBobotTotal = 0;
      let sumSkorBenar = 0;

      for (const soal of listSoal) {
        sumBobotTotal += soal.bobot;
        const jawabanSantri = jawabanMap.get(soal.id);
        const opsiBenar = soal.opsiList.length > 0 ? soal.opsiList[0].id : null;

        if (jawabanSantri && jawabanSantri === opsiBenar) {
          sumSkorBenar += soal.bobot;
        }
      }

      // Hindari NaN jika sumBobotTotal 0
      let nilaiAkhir = sumBobotTotal > 0 ? (sumSkorBenar / sumBobotTotal) * 100 : 0;
      nilaiAkhir = Number(nilaiAkhir.toFixed(2));
      totalSkorSeluruh += nilaiAkhir;

      recordsMapel.push({
        mapelId,
        mapel,
        nilai: nilaiAkhir
      });

      // Update nilai di tabel `Nilai`
      let fieldToUpdate = "";
      if (paket.sesiGlobal.usbuKe === 3 || mapel.jumlah_tes === 1 || effectiveUsbuainMode === 1) {
        // Jika ujian ini adalah ujian ke-3, atau mapel ini cuma 1 tes (langsung final), atau modenya 1 kolom
        fieldToUpdate = "nilaiNihai";
      } else if (paket.sesiGlobal.usbuKe === 1) {
        fieldToUpdate = "nilaiUsbu1";
      } else if (paket.sesiGlobal.usbuKe === 2) {
        fieldToUpdate = "nilaiUsbu2";
      }

      // Ambil nilai lama
      let recordNilai = await prisma.nilai.findUnique({
        where: { riwayatId_mapelId: { riwayatId, mapelId } }
      });

      if (!recordNilai) {
        recordNilai = await prisma.nilai.create({
          data: { riwayatId, mapelId, [fieldToUpdate]: nilaiAkhir }
        });
      } else {
        recordNilai = await prisma.nilai.update({
          where: { id: recordNilai.id },
          data: { [fieldToUpdate]: nilaiAkhir }
        });
      }

      // Recalculate Final Score 'nilaiAkhir' for this mapel if possible
      let finalA = null;
      if (mapel.jumlah_tes === 1 || effectiveUsbuainMode === 1) {
        finalA = recordNilai.nilaiNihai;
      } else if (effectiveUsbuainMode === 2 && mapel.jumlah_tes === 3) {
        if (recordNilai.nilaiUsbu1 !== null && recordNilai.nilaiUsbu2 !== null) {
           finalA = calcMapelNilaiAkhirUsbuain2({ u1: recordNilai.nilaiUsbu1, u2: recordNilai.nilaiUsbu2 });
        }
      } else {
        // Normal 3 kolom atau sesuai rules akbarnas
        finalA = calcMapelNilaiAkhir(
          { u1: recordNilai.nilaiUsbu1, u2: recordNilai.nilaiUsbu2, n: recordNilai.nilaiNihai },
          isAkbarnas
        );
      }

      if (finalA !== null) {
        await prisma.nilai.update({
          where: { id: recordNilai.id },
          data: { nilaiAkhir: finalA }
        });
      }
    }

    const rataRataPaket = soalPerMapel.size > 0 ? Number((totalSkorSeluruh / soalPerMapel.size).toFixed(2)) : 0;

    // Update SesiUjianSantri
    const updatedSesi = await prisma.sesiUjianSantri.update({
      where: { id: sesiId },
      data: {
        status: statusSubmit,
        waktuSelesai: timeCompleted,
        nilaiTotal: rataRataPaket,
        tabCloseCount: isCheat ? { increment: 1 } : undefined 
      }
    });

    return NextResponse.json({ success: true, sesi: updatedSesi, mapelResults: recordsMapel });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
