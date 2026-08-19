import prisma from "@/lib/prisma";
import { calcMapelNilaiAkhir, calcMapelNilaiAkhirUsbuain2 } from "@/lib/grade-calculator";

export async function submitSesiUjianSantri(sesiId: string, reason: string) {
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

  if (!sesi) throw new Error("Sesi tidak ditemukan");
  if (sesi.status !== "MENGERJAKAN") throw new Error("Ujian ini sudah ditutup/disubmit sebelumnya");

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
  const jawabanMap = new Map<string, any>(); // soalId -> { id, opsiId, teks, data, nilaiManual }
  for (const j of sesi.jawabanList) {
    jawabanMap.set(j.soalId, {
      id: j.id,
      opsiId: j.opsiId,
      teks: j.jawabanTeks,
      data: (typeof j.jawabanData === 'string' && j.jawabanData) ? JSON.parse(j.jawabanData) : (j.jawabanData || {}),
      nilaiManual: j.nilaiManual
    });
  }

  let totalSkorSeluruh = 0;
  const recordsMapel = [];
  const jawabanUpdates: any[] = [];

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
      const jaw = jawabanMap.get(soal.id);
      if (!jaw) continue;

      let skorSoal = 0;
      const dt = soal.dataTambahan ? (typeof soal.dataTambahan === 'string' ? JSON.parse(soal.dataTambahan) : JSON.parse(JSON.stringify(soal.dataTambahan))) : {};

      switch (soal.tipeSoal) {
        case "PG":
        case "BENAR_SALAH":
        case "MUFRODAT":
        case "ISIAN_SAMPING":
        case "ISIAN_BAWAH": {
          const opsiBenar = soal.opsiList.length > 0 ? soal.opsiList[0].id : null;
          if (jaw.opsiId && jaw.opsiId === opsiBenar) {
            skorSoal = soal.bobot;
          } else if (jaw.teks && soal.kunciJawaban && jaw.teks.trim().toLowerCase() === soal.kunciJawaban.trim().toLowerCase()) {
            skorSoal = soal.bobot;
          }
          break;
        }

        case "PG_MULTI": {
          if (jaw.data && Array.isArray(jaw.data.selectedIds)) {
            const bnr = soal.opsiList.map((o: any) => o.id);
            const sel = jaw.data.selectedIds;
            if (sel.length === bnr.length && sel.every((s: string) => bnr.includes(s))) {
              skorSoal = soal.bobot;
            }
          }
          break;
        }

        case "MENJODOHKAN": {
          if (jaw.data && Array.isArray(jaw.data.pairs) && dt.pairs) {
            let benar = 0;
            jaw.data.pairs.forEach((jp: any) => {
              if (dt.pairs.some((dp: any) => dp.left === jp.left && dp.right === jp.right)) {
                benar++;
              }
            });
            skorSoal = (benar / Math.max(1, dt.pairs.length)) * soal.bobot;
          }
          break;
        }

        case "MENGURUTKAN": {
          if (jaw.data && Array.isArray(jaw.data.items) && dt.items) {
            let benar = 0;
            jaw.data.items.forEach((item: any, i: number) => {
              if (item === dt.items[i]) benar++;
            });
            skorSoal = (benar / Math.max(1, dt.items.length)) * soal.bobot;
          }
          break;
        }

        case "KITABAH": {
          if (jaw.teks && dt.jawaban) {
            if (jaw.teks.trim() === dt.jawaban.trim()) skorSoal = soal.bobot;
          }
          break;
        }

        case "DRAG_KATEGORI": {
          if (jaw.data && Array.isArray(jaw.data.items) && dt.items) {
            let benar = 0;
            const dtValid = dt.items;
            jaw.data.items.forEach((jitem: any) => {
              const found = dtValid.find((d: any) => d.text === jitem.text);
              if (found && found.category === jitem.category) benar++;
            });
            skorSoal = (benar / Math.max(1, dtValid.length)) * soal.bobot;
          }
          break;
        }

        case "DRAG_TO_BLANK":
        case "PARAGRAF_RUMPANG": {
          if (jaw.data && jaw.data.answers && Array.isArray(dt.blanks)) {
            let benar = 0;
            const answers = jaw.data.answers;
            dt.blanks.forEach((b: any) => {
              const studentAns = (answers[b.index] || "").trim().toLowerCase();
              const possibleAnswers = (b.jawaban || "").split("|").map((k: string) => k.trim().toLowerCase());
              if (possibleAnswers.includes(studentAns)) {
                benar++;
              }
            });
            skorSoal = (benar / Math.max(1, dt.blanks.length)) * soal.bobot;
            // Push ke nilaiManual karena ini sudah fix (tidak perlu AI).
            jawabanUpdates.push({ id: jaw.id, nilaiManual: skorSoal });
          }
          break;
        }

        case "IDENTIFIKASI_KESALAHAN": {
          if (jaw.data && Array.isArray(jaw.data.selectedIndices) && Array.isArray(dt.segments)) {
            let points = 0;
            let errorCount = dt.segments.filter((s:any) => s.isError).length;
            if (errorCount === 0) errorCount = 1; // Failsafe
            
            const selectedIndices = jaw.data.selectedIndices;
            
            dt.segments.forEach((seg: any, idx: number) => {
              const isSelected = selectedIndices.includes(idx);
              if (seg.isError && isSelected) {
                points++; // True Positive
              } else if (!seg.isError && isSelected) {
                points--; // False Positive (Penalty)
              }
            });
            
            // Normalize points
            points = Math.max(0, points);
            skorSoal = (points / errorCount) * soal.bobot;
            jawabanUpdates.push({ id: jaw.id, nilaiManual: skorSoal });
          }
          break;
        }

        case "STABILO_SYNTAX": {
          if (jaw.data && jaw.data.assignments && Array.isArray(dt.words)) {
            let points = 0;
            let targetCount = dt.words.filter((w:any) => w.category).length;
            if (targetCount === 0) targetCount = 1; // Failsafe
            
            const assignments = jaw.data.assignments;
            
            dt.words.forEach((w: any, idx: number) => {
              const assignedCat = assignments[idx];
              const trueCat = w.category;
              
              if (assignedCat) {
                if (assignedCat === trueCat) {
                  points++; // True positive
                } else {
                  points--; // False positive penalty
                }
              }
            });
            
            points = Math.max(0, points);
            skorSoal = (points / targetCount) * soal.bobot;
            jawabanUpdates.push({ id: jaw.id, nilaiManual: skorSoal });
          }
          break;
        }

        case "JARING_RELASI": {
          if (jaw.data && jaw.data.connections && Array.isArray(dt.connections)) {
            let points = 0;
            let targetEdges = 0;
            
            // Map true connections
            const trueGraph = new Map<number, number[]>();
            dt.connections.forEach((c: any) => {
               trueGraph.set(c.left, c.right || []);
               targetEdges += (c.right || []).length;
            });
            if (targetEdges === 0) targetEdges = 1; // Failsafe

            const studentConns = jaw.data.connections;
            
            studentConns.forEach((c: any) => {
               const left = c.left;
               const trueRights = trueGraph.get(left) || [];
               (c.right || []).forEach((r: number) => {
                  if (trueRights.includes(r)) {
                     points++;
                  } else {
                     points--;
                  }
               });
            });
            
            points = Math.max(0, points);
            skorSoal = (points / targetEdges) * soal.bobot;
            jawabanUpdates.push({ id: jaw.id, nilaiManual: skorSoal });
          }
          break;
        }

        case "TABEL_TASRIF": {
          if (jaw.data && jaw.data.cells && Array.isArray(dt.rows)) {
            let totalBlank = 0;
            let benar = 0;
            const answers = jaw.data.cells;
            
            dt.rows.forEach((row: any, rIdx: number) => {
              (row.cells || []).forEach((cell: any, cIdx: number) => {
                if (cell.isBlank) {
                  totalBlank++;
                  const key = `${rIdx}-${cIdx}`;
                  const studentAns = (answers[key] || "").trim().toLowerCase();
                  const possibleAnswers = (cell.value || "").split("|").map((k: string) => k.trim().toLowerCase());
                  if (studentAns !== "" && possibleAnswers.includes(studentAns)) {
                    benar++;
                  }
                }
              });
            });
            
            skorSoal = (benar / Math.max(1, totalBlank)) * soal.bobot;
            jawabanUpdates.push({ id: jaw.id, nilaiManual: skorSoal });
          }
          break;
        }

        case "SUSUN_HURUF": {
          if (jaw.data && Array.isArray(jaw.data.susunanIndices) && dt.jawaban && Array.isArray(dt.hurufAcak)) {
            const studentCompiled = jaw.data.susunanIndices.map((i: number) => dt.hurufAcak[i]).join('');
            const targetCompiled = (dt.jawaban || "").replace(/\s+/g, '');
            if (studentCompiled.replace(/\s+/g, '') === targetCompiled) {
              skorSoal = soal.bobot;
            }
            jawabanUpdates.push({ id: jaw.id, nilaiManual: skorSoal });
          }
          break;
        }

        case "ESSAY_SINGKAT":
        case "ESSAY_GAMBAR":
        case "ESSAY_ARAB":
        case "ESSAY_PANJANG": {
          if (jaw.nilaiManual !== null) {
            skorSoal = jaw.nilaiManual;
          } else {
            // Evaluasi otomatis khusus untuk esai singkat / Arab jika Kunci Jawaban ada
            if ((soal.tipeSoal === "ESSAY_SINGKAT" || soal.tipeSoal === "ESSAY_ARAB") && soal.kunciJawaban && jaw.teks) {
              const studentAnswer = jaw.teks.trim().toLowerCase();
              const possibleAnswers = soal.kunciJawaban.split('|').map((k: string) => k.trim().toLowerCase());
              
              if (possibleAnswers.includes(studentAnswer)) {
                skorSoal = soal.bobot;
                // Nilai mutlak benar, simpan langsung ke DB agar tidak direview AI
                jawabanUpdates.push({
                   id: jaw.id,
                   nilaiManual: skorSoal
                });
              }
            }
          }
          break;
        }

        default:
          break;
      }

      sumSkorBenar += skorSoal;
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

    if (!paket.sesiGlobal.isSimulasi) {
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
  }

  const rataRataPaket = soalPerMapel.size > 0 ? Number((totalSkorSeluruh / soalPerMapel.size).toFixed(2)) : 0;

  const dataToUpdate: any = {
    status: statusSubmit,
    waktuSelesai: timeCompleted,
    nilaiTotal: rataRataPaket,
    alasanSubmit: reason
  };

  if (isCheat) {
    dataToUpdate.tabCloseCount = { increment: 1 };
  }

  // Update SesiUjianSantri
  const updatedSesi = await prisma.sesiUjianSantri.update({
    where: { id: sesiId },
    data: dataToUpdate
  });

  // Batch update jawaban jika ada auto-grade
  if (jawabanUpdates.length > 0) {
     const promises = jawabanUpdates.map((u) => 
        prisma.jawabanUjianSantri.update({
           where: { id: u.id },
           data: { nilaiManual: u.nilaiManual, aiGraded: false } // aiGraded false karena ini disistem manual oleh string-matching otomatis, tapi krn nilaiManual udh ada maka tdk akan diganggu gugat
        })
     );
     await prisma.$transaction(promises);
  }

  return updatedSesi;
}
