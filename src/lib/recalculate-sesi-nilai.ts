import prisma from "@/lib/prisma";
import { calcMapelNilaiAkhir, calcMapelNilaiAkhirUsbuain2 } from "@/lib/grade-calculator";

export async function recalculateSesiNilai(sesiId: string) {
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
      
      if (jaw.nilaiManual !== null) {
        sumSkorBenar += jaw.nilaiManual;
        continue;
      }

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
          if (jaw.data && Array.isArray(jaw.data.pairs) && dt.lefts && dt.rights) {
            let benar = 0;
            jaw.data.pairs.forEach((jp: any) => {
              const idx = dt.lefts.indexOf(jp.left);
              if (idx !== -1 && dt.rights[idx] === jp.right) {
                benar++;
              }
            });
            skorSoal = (benar / Math.max(1, dt.lefts.length)) * soal.bobot;
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
          const kitabahKunci = soal.kunciJawaban || dt.jawaban || null;
          if (jaw.teks && kitabahKunci) {
            const possibleKitabah = kitabahKunci.split('|').map((k: string) => k.trim().toLowerCase());
            if (possibleKitabah.includes(jaw.teks.trim().toLowerCase())) {
              skorSoal = soal.bobot;
            }
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
            if (jaw.nilaiManual !== null) {
              skorSoal = jaw.nilaiManual;
            } else {
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
            }
          }
          break;
        }

        case "IDENTIFIKASI_KESALAHAN": {
          if (jaw.data && (jaw.data.selectedIndex !== undefined || Array.isArray(jaw.data.selectedIndices))) {
            if (jaw.nilaiManual !== null) {
              skorSoal = jaw.nilaiManual;
            } else if (dt.correctIndex !== undefined && Array.isArray(dt.words)) {
              const studentIdx = jaw.data.selectedIndex ?? (jaw.data.selectedIndices ? jaw.data.selectedIndices[0] : -1);
              if (studentIdx === dt.correctIndex) {
                skorSoal = soal.bobot;
              }
            } else if (Array.isArray(dt.segments)) {
              let points = 0;
              let errorCount = dt.segments.filter((s:any) => s.isError).length;
              if (errorCount === 0) errorCount = 1;
              const selectedIndices = jaw.data.selectedIndices || [];
              dt.segments.forEach((seg: any, idx: number) => {
                const isSelected = selectedIndices.includes(idx);
                if (seg.isError && isSelected) points++;
                else if (!seg.isError && isSelected) points--;
              });
              points = Math.max(0, points);
              skorSoal = (points / errorCount) * soal.bobot;
            }
          }
          break;
        }

        case "STABILO_SYNTAX": {
          if (jaw.data && jaw.data.assignments && Array.isArray(dt.words)) {
            if (jaw.nilaiManual !== null) {
               skorSoal = jaw.nilaiManual;
            } else {
              let points = 0;
              const trueAnswers = dt.answers || {};
              let targetCount = Object.keys(trueAnswers).length;
              if (targetCount === 0) targetCount = 1;
              
              const assignments = jaw.data.assignments;
              
              dt.words.forEach((_w: any, idx: number) => {
                const assignedCat = assignments[idx] || assignments[String(idx)];
                const trueCat = trueAnswers[String(idx)];
                
                if (assignedCat && trueCat) {
                  if (assignedCat === trueCat) {
                    points++;
                  } else {
                    points--;
                  }
                }
              });
              
              points = Math.max(0, points);
              skorSoal = (points / targetCount) * soal.bobot;
            }
          }
          break;
        }

        case "JARING_RELASI": {
          if (jaw.data && jaw.data.connections && Array.isArray(dt.connections)) {
            if (jaw.nilaiManual !== null) {
               skorSoal = jaw.nilaiManual;
            } else {
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
            }
          }
          break;
        }

        case "TABEL_TASRIF": {
          if (jaw.data && jaw.data.cells && Array.isArray(dt.rows)) {
            if (jaw.nilaiManual !== null) {
               skorSoal = jaw.nilaiManual;
            } else {
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
            }
          }
          break;
        }

        case "SUSUN_HURUF": {
          if (jaw.data && Array.isArray(jaw.data.susunanIndices) && Array.isArray(dt.hurufAcak)) {
            if (jaw.nilaiManual !== null) {
               skorSoal = jaw.nilaiManual;
            } else {
              const studentCompiled = jaw.data.susunanIndices.map((i: number) => dt.hurufAcak[i]).join('');
              let targetCompiled = '';
              if (dt.jawaban) {
                targetCompiled = dt.jawaban.replace(/\s+/g, '');
              } else {
                targetCompiled = dt.hurufAcak.join('').replace(/\s+/g, '');
              }
              if (studentCompiled.replace(/\s+/g, '') === targetCompiled) {
                skorSoal = soal.bobot;
              }
            }
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
    let nilaiAkhirMapel = sumBobotTotal > 0 ? (sumSkorBenar / sumBobotTotal) * 100 : 0;
    nilaiAkhirMapel = Number(nilaiAkhirMapel.toFixed(2));
    totalSkorSeluruh += nilaiAkhirMapel;

    if (!paket.sesiGlobal.isSimulasi) {
      // Update nilai di tabel `Nilai`
      let fieldToUpdate = "";
      if (paket.sesiGlobal.usbuKe === 3 || mapel.jumlah_tes === 1 || effectiveUsbuainMode === 1) {
        fieldToUpdate = "nilaiNihai";
      } else if (paket.sesiGlobal.usbuKe === 1) {
        fieldToUpdate = "nilaiUsbu1";
      } else if (paket.sesiGlobal.usbuKe === 2) {
        fieldToUpdate = "nilaiUsbu2";
      }

      let recordNilai = await prisma.nilai.findUnique({
        where: { riwayatId_mapelId: { riwayatId, mapelId } }
      });

      if (!recordNilai) {
        recordNilai = await prisma.nilai.create({
          data: { riwayatId, mapelId, [fieldToUpdate]: nilaiAkhirMapel }
        });
      } else {
        recordNilai = await prisma.nilai.update({
          where: { id: recordNilai.id },
          data: { [fieldToUpdate]: nilaiAkhirMapel }
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

  // Update SesiUjianSantri dengan perhitungan total yang baru
  const updatedSesi = await prisma.sesiUjianSantri.update({
    where: { id: sesiId },
    data: { nilaiTotal: rataRataPaket }
  });

  return updatedSesi;
}
