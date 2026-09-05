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
  const nilaiOpsQueue: Array<{ mapelId: string; mapel: any; nilaiAkhir: number; fieldToUpdate: string }> = [];

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
            jawabanUpdates.push({ id: jaw.id, nilaiManual: skorSoal });
          }
          break;
        }

        case "KITABAH": {
          // DB stores kunci di kunciJawaban atau dt.jawaban
          const kitabahKunci = soal.kunciJawaban || dt.jawaban || null;
          if (jaw.teks && kitabahKunci) {
            const possibleKitabah = kitabahKunci.split('|').map((k: string) => k.trim().toLowerCase());
            if (possibleKitabah.includes(jaw.teks.trim().toLowerCase())) {
              skorSoal = soal.bobot;
            }
            jawabanUpdates.push({ id: jaw.id, nilaiManual: skorSoal });
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
          // DB stores: words[] + correctIndex (index of the correct/error word)
          if (jaw.data && (jaw.data.selectedIndex !== undefined || Array.isArray(jaw.data.selectedIndices))) {
            if (dt.correctIndex !== undefined && Array.isArray(dt.words)) {
              // Simple mode: single correct answer
              const studentIdx = jaw.data.selectedIndex ?? (jaw.data.selectedIndices ? jaw.data.selectedIndices[0] : -1);
              if (studentIdx === dt.correctIndex) {
                skorSoal = soal.bobot;
              }
            } else if (Array.isArray(dt.segments)) {
              // Legacy segments mode
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
            jawabanUpdates.push({ id: jaw.id, nilaiManual: skorSoal });
          }
          break;
        }

        case "STABILO_SYNTAX": {
          // DB stores: words[] (text only), answers{"idx": "category"}, categories[]
          if (jaw.data && jaw.data.assignments && Array.isArray(dt.words)) {
            let points = 0;
            // True answers from key: dt.answers is {"0":"فعل","1":"فاعل",...}
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
          // DB may have dt.jawaban (target string) or only dt.hurufAcak (shuffled characters)
          // If jawaban is missing, the correct order = hurufAcak joined in original index order [0,1,2,...]
          if (jaw.data && Array.isArray(jaw.data.susunanIndices) && Array.isArray(dt.hurufAcak)) {
            const studentCompiled = jaw.data.susunanIndices.map((i: number) => dt.hurufAcak[i]).join('');
            let targetCompiled = '';
            if (dt.jawaban) {
              targetCompiled = dt.jawaban.replace(/\s+/g, '');
            } else {
              // If no jawaban key, the correct order is the original index order: 0,1,2,...
              targetCompiled = dt.hurufAcak.join('').replace(/\s+/g, '');
            }
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

    // Kumpulkan info untuk batch update nanti (bukan sequential DB per mapel)
    if (!paket.sesiGlobal.isSimulasi) {
      let fieldToUpdate = "";
      if (paket.sesiGlobal.usbuKe === 3 || mapel.jumlah_tes === 1 || effectiveUsbuainMode === 1) {
        fieldToUpdate = "nilaiNihai";
      } else if (paket.sesiGlobal.usbuKe === 1) {
        fieldToUpdate = "nilaiUsbu1";
      } else if (paket.sesiGlobal.usbuKe === 2) {
        fieldToUpdate = "nilaiUsbu2";
      }
      nilaiOpsQueue.push({ mapelId, mapel, nilaiAkhir, fieldToUpdate });
    }
  }

  // ===== BATCH NILAI UPDATE — satu transaction untuk semua mapel =====
  if (nilaiOpsQueue.length > 0) {
    // 1. Pre-fetch semua Nilai records yang ada dalam satu query
    const existingNilai = await prisma.nilai.findMany({
      where: {
        riwayatId,
        mapelId: { in: nilaiOpsQueue.map(q => q.mapelId) }
      }
    });
    const nilaiMap = new Map(existingNilai.map(n => [n.mapelId, n]));

    // 2. Kumpulkan semua operasi DB
    const txOps: any[] = [];

    for (const q of nilaiOpsQueue) {
      const existing = nilaiMap.get(q.mapelId);

      if (!existing) {
        // Create baru
        txOps.push(
          prisma.nilai.create({
            data: { riwayatId, mapelId: q.mapelId, [q.fieldToUpdate]: q.nilaiAkhir }
          })
        );
      } else {
        // Update existing + hitung nilaiAkhir
        const updatedData: any = { [q.fieldToUpdate]: q.nilaiAkhir };

        // Recalculate nilaiAkhir langsung
        const recNilai = { ...existing, [q.fieldToUpdate]: q.nilaiAkhir };
        let finalA = null;
        if (q.mapel.jumlah_tes === 1 || effectiveUsbuainMode === 1) {
          finalA = recNilai.nilaiNihai;
        } else if (effectiveUsbuainMode === 2 && q.mapel.jumlah_tes === 3) {
          if (recNilai.nilaiUsbu1 !== null && recNilai.nilaiUsbu2 !== null) {
            finalA = calcMapelNilaiAkhirUsbuain2({ u1: recNilai.nilaiUsbu1, u2: recNilai.nilaiUsbu2 });
          }
        } else {
          finalA = calcMapelNilaiAkhir(
            { u1: recNilai.nilaiUsbu1, u2: recNilai.nilaiUsbu2, n: recNilai.nilaiNihai },
            isAkbarnas
          );
        }

        if (finalA !== null) {
          updatedData.nilaiAkhir = finalA;
        }

        txOps.push(
          prisma.nilai.update({
            where: { id: existing.id },
            data: updatedData
          })
        );
      }
    }

    // 3. Execute semua dalam SATU transaction (bukan 15+ sequential queries)
    if (txOps.length > 0) {
      await prisma.$transaction(txOps);
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

  // ===== AUTO AI GRADING HOOK =====
  // Kumpulkan essay yang belum dinilai untuk santri ini, lalu jalankan AI di background
  const essayTypes = ["ESSAY_SINGKAT", "ESSAY_PANJANG", "ESSAY_ARAB", "ESSAY_GAMBAR"];
  const pendingEssayIds: string[] = [];
  
  for (const sp of paket.soalPaketList) {
    if (essayTypes.includes(sp.soal.tipeSoal)) {
      const jaw = jawabanMap.get(sp.soal.id);
      // Hanya yang ada jawabannya DAN belum dinilai
      if (jaw && jaw.id && jaw.nilaiManual === null && jaw.teks) {
        // Cek apakah sudah ter-update oleh jawabanUpdates di atas
        const alreadyUpdated = jawabanUpdates.some(u => u.id === jaw.id);
        if (!alreadyUpdated) {
          pendingEssayIds.push(jaw.id);
        }
      }
    }
  }

  if (pendingEssayIds.length > 0) {
    // Fire-and-forget: jangan di-await agar response santri tidak tertunda
    autoGradeEssaysBackground(pendingEssayIds, sesiId).catch(err => 
      console.error("[AUTO-AI-SUBMIT] Background grading error:", err)
    );
  }

  return updatedSesi;
}

// ===== BACKGROUND AI AUTO-GRADER (dipanggil setelah submit) =====

// Global concurrency limiter untuk AI grading
// Membatasi max 3 sesi AI grading berjalan bersamaan di seluruh server
let activeAiGradingCount = 0;
const MAX_CONCURRENT_AI_GRADING = 3;
const AI_GRADING_QUEUE: Array<() => void> = [];

function acquireAiSlot(): Promise<void> {
  if (activeAiGradingCount < MAX_CONCURRENT_AI_GRADING) {
    activeAiGradingCount++;
    return Promise.resolve();
  }
  return new Promise(resolve => {
    AI_GRADING_QUEUE.push(resolve);
  });
}

function releaseAiSlot() {
  if (AI_GRADING_QUEUE.length > 0) {
    const next = AI_GRADING_QUEUE.shift()!;
    next(); // langsung berikan slot ke yang menunggu
  } else {
    activeAiGradingCount--;
  }
}

async function autoGradeEssaysBackground(jawabanIds: string[], sesiId: string) {
  // Tunggu slot tersedia (max 3 bersamaan)
  await acquireAiSlot();
  
  try {
    const { gradeEssayWithAI } = await import("@/lib/ai-grader");
    const { recalculateSesiNilai: recalcFn } = await import("@/lib/recalculate-sesi-nilai");
    const removeHtml = (s: string) => (s || "").replace(/<[^>]*>?/gm, '');

    console.log(`[AUTO-AI-SUBMIT] Memulai auto-grade untuk ${jawabanIds.length} essay (Sesi: ${sesiId}) [Active: ${activeAiGradingCount}/${MAX_CONCURRENT_AI_GRADING}]`);

    for (const jawId of jawabanIds) {
      try {
        const jaw: any = await prisma.jawabanUjianSantri.findUnique({
          where: { id: jawId }
        });
        if (!jaw || !jaw.jawabanTeks || jaw.nilaiManual !== null) continue;

        const soal: any = await prisma.bankSoalUsbu.findUnique({
          where: { id: jaw.soalId }
        });
        if (!soal) continue;

        const result = await gradeEssayWithAI({
          pertanyaan: removeHtml(soal.pertanyaan),
          kunciJawaban: soal.kunciJawaban || "",
          jawabanSantri: jaw.jawabanTeks,
          bobot: soal.bobot,
          tipeSoal: soal.tipeSoal
        });

        if (result && result.score !== undefined) {
          let finalScore = result.score;
          if (finalScore > soal.bobot && finalScore <= 100) finalScore = (finalScore / 100) * soal.bobot;
          if (finalScore > soal.bobot) finalScore = soal.bobot;
          if (finalScore < 0) finalScore = 0;

          // @ts-ignore
          await prisma.jawabanUjianSantri.update({
            where: { id: jawId },
            // @ts-ignore
            data: { nilaiManual: finalScore, aiGraded: true, aiFeedback: result.feedback || null }
          });
        }

        // Jeda 4 detik per soal (rate-limit safety — dinaikkan dari 2.5 detik)
        await new Promise(resolve => setTimeout(resolve, 4000));
      } catch (err) {
        console.error(`[AUTO-AI-SUBMIT] Error pada jawaban ${jawId}:`, err);
      }
    }

    // Recalculate total sesi setelah semua essay dinilai
    await recalcFn(sesiId).catch(console.error);
    console.log(`[AUTO-AI-SUBMIT] Selesai auto-grade sesi ${sesiId}`);
  } finally {
    // PENTING: selalu lepaskan slot meskipun error
    releaseAiSlot();
  }
}

