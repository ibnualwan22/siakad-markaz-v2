import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import prisma from "@/lib/prisma";
import { buildAiGraderInputFromSoal, gradeEssayWithAI } from "@/lib/ai-grader";
import { recalculateSesiNilai } from "@/lib/recalculate-sesi-nilai";

// Background loop: ambil 3 jawaban pending, nilai AI, ulangi sampai habis
async function runBackgroundAutoGrade(targetId?: string, isSesiGlobal = false) {
  console.log(
    `[BULK-AI] Memulai background auto-grade... ${
      targetId ? `(${isSesiGlobal ? "SesiGlobal" : "Target"}: ${targetId})` : "(GLOBAL - Seluruh Sistem)"
    }`,
  );

  let totalProcessed = 0;
  let totalErrors = 0;
  const uniqueSesiIds = new Set<string>();

  // Resolusi paketId yang valid: mendukung baik sesiGlobalId maupun paketUjian.id
  let resolvedPaketIds: string[] | null = null;
  if (targetId) {
    const byGlobal = await prisma.paketUjian.findMany({
      where: { sesiGlobalId: targetId },
      select: { id: true },
    });
    if (byGlobal.length > 0) {
      resolvedPaketIds = byGlobal.map((p) => p.id);
    } else if (!isSesiGlobal) {
      resolvedPaketIds = [targetId];
    } else {
      console.log(`[BULK-AI] Tidak ada PaketUjian ditemukan untuk sesiGlobalId ${targetId}.`);
      return;
    }
  }

  // Dapatkan daftar soal essay beserta konteks lengkapnya (mapel, program, jenisSoal, grupInduk)
  const essaySoals = await prisma.bankSoalUsbu.findMany({
    where: {
      tipeSoal: { in: ["ESSAY_SINGKAT", "ESSAY_PANJANG", "ESSAY_ARAB", "ESSAY_GAMBAR"] },
    },
    include: {
      mapel: true,
      program: true,
      jenisSoal: true,
      grupInduk: { select: { pertanyaan: true } },
    },
  });
  const essaySoalIds = essaySoals.map((s) => s.id);
  const soalMap = new Map(essaySoals.map((s) => [s.id, s]));

  if (essaySoalIds.length === 0) {
    console.log("[BULK-AI] Tidak ada soal essay ditemukan.");
    return;
  }

  // Muat snapshot SoalPaket agar bobot/kunci sesuai saat paket dibuat
  const snapshotMap = new Map<
    string,
    { pertanyaanSnapshot: string | null; kunciJawabanSnapshot: string | null; bobotSnapshot: number | null }
  >();
  if (resolvedPaketIds && resolvedPaketIds.length > 0) {
    const spList = await prisma.soalPaket.findMany({
      where: { paketId: { in: resolvedPaketIds }, soalId: { in: essaySoalIds } },
      select: {
        paketId: true,
        soalId: true,
        pertanyaanSnapshot: true,
        kunciJawabanSnapshot: true,
        bobotSnapshot: true,
      },
    });
    for (const sp of spList) {
      snapshotMap.set(`${sp.paketId}::${sp.soalId}`, {
        pertanyaanSnapshot: sp.pertanyaanSnapshot,
        kunciJawabanSnapshot: sp.kunciJawabanSnapshot,
        bobotSnapshot: sp.bobotSnapshot,
      });
    }
  }

  try {
    while (true) {
      const whereClause: any = {
        nilaiManual: null,
        aiGraded: false,
        jawabanTeks: { not: null, notIn: [""] },
        soalId: { in: essaySoalIds },
      };

      if (resolvedPaketIds && resolvedPaketIds.length > 0) {
        whereClause.sesi = {
          paketId: { in: resolvedPaketIds },
          status: { in: ["AUTO_SUBMIT", "SELESAI", "MENGERJAKAN"] },
        };
      }

      const pendingBatch = await prisma.jawabanUjianSantri.findMany({
        where: whereClause,
        include: { sesi: { select: { paketId: true } } },
        take: 3,
      });

      if (pendingBatch.length === 0) {
        console.log(
          `[BULK-AI] Selesai! Total diproses: ${totalProcessed}, Error: ${totalErrors}`,
        );
        break;
      }

      let calledExternalApiInBatch = false;

      for (const jaw of pendingBatch) {
        if (!jaw.jawabanTeks) continue;
        const soal = soalMap.get(jaw.soalId);
        if (!soal) continue;

        try {
          const paketIdForJaw = jaw.sesi?.paketId;
          let snapshot = paketIdForJaw
            ? snapshotMap.get(`${paketIdForJaw}::${soal.id}`) || null
            : null;
          if (!snapshot && paketIdForJaw && !resolvedPaketIds) {
            const sp = await prisma.soalPaket.findUnique({
              where: { paketId_soalId: { paketId: paketIdForJaw, soalId: soal.id } },
              select: {
                pertanyaanSnapshot: true,
                kunciJawabanSnapshot: true,
                bobotSnapshot: true,
              },
            });
            if (sp) {
              snapshot = sp;
              snapshotMap.set(`${paketIdForJaw}::${soal.id}`, sp);
            }
          }

          const graderInput = buildAiGraderInputFromSoal(soal, jaw.jawabanTeks, snapshot);
          const result = await gradeEssayWithAI(graderInput);

          if (!result?.deterministic) {
            calledExternalApiInBatch = true;
          }

          if (result && result.score !== undefined) {
            const bobot = graderInput.bobot || 10;
            const finalScore = Math.min(Math.max(Number(result.score) || 0, 0), bobot);

            // FIX race condition: conditional update — hanya tulis jika
            // nilaiManual masih null DAN aiGraded masih false.
            const updateResult = await prisma.jawabanUjianSantri.updateMany({
              where: { id: jaw.id, nilaiManual: null, aiGraded: false },
              data: {
                nilaiManual: finalScore,
                aiGraded: true,
                aiFeedback: result.feedback || null,
                needsReview: Boolean(result.needsTeacherReview),
              },
            });

            if (updateResult.count > 0) {
              if (jaw.sesiId) uniqueSesiIds.add(jaw.sesiId);
              totalProcessed++;
            } else {
              console.log(`[BULK-AI] Skip ${jaw.id}: sudah dikoreksi manual`);
            }
          } else {
            await prisma.jawabanUjianSantri.updateMany({
              where: { id: jaw.id, nilaiManual: null, aiGraded: false },
              data: {
                aiGraded: true,
                needsReview: true,
                aiFeedback: `[ERROR] ${result?.error || "Gagal mendapatkan respon AI"}`,
              },
            });
            totalErrors++;
          }
        } catch (err: any) {
          console.error(`[BULK-AI] Error pada jawaban ${jaw.id}:`, err);
          await prisma.jawabanUjianSantri
            .updateMany({
              where: { id: jaw.id, nilaiManual: null, aiGraded: false },
              data: {
                aiGraded: true,
                needsReview: true,
                aiFeedback: `[FATAL] ${err.message || String(err)}`,
              },
            })
            .catch(console.error);
          totalErrors++;
        }
      }

      for (const sId of uniqueSesiIds) {
        await recalculateSesiNilai(sId).catch(console.error);
      }
      uniqueSesiIds.clear();

      if (calledExternalApiInBatch) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  } catch (error) {
    console.error("[BULK-AI] Fatal error:", error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await checkPermission("ujian_usbu"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const sesiGlobalId = body.sesiGlobalId || undefined;
    const paketId = body.paketId || undefined;
    const targetId = sesiGlobalId || paketId;

    runBackgroundAutoGrade(targetId, Boolean(sesiGlobalId)).catch((err) =>
      console.error("[BULK-AI] Uncaught:", err),
    );

    return NextResponse.json({
      success: true,
      message: targetId
        ? "Proses grading AI untuk paket ini telah diluncurkan di background."
        : "Proses grading AI GLOBAL (seluruh sistem) telah diluncurkan di background. Anda boleh menutup halaman.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
