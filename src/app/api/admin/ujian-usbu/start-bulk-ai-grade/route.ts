import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { gradeEssayWithAI } from "@/lib/ai-grader";
import { recalculateSesiNilai } from "@/lib/recalculate-sesi-nilai";

const removeHtmlTags = (str: string) => (str || "").replace(/<[^>]*>?/gm, '');

// Background loop: ambil 3 jawaban pending, nilai AI, ulangi sampai habis
async function runBackgroundAutoGrade(paketId?: string) {
  console.log(`[BULK-AI] Memulai background auto-grade... ${paketId ? `(Paket: ${paketId})` : "(GLOBAL - Seluruh Sistem)"}`);
  
  let totalProcessed = 0;
  let totalErrors = 0;
  const uniqueSesiIds = new Set<string>();

  // Dapatkan daftar soal essay
  const essaySoals = await prisma.bankSoalUsbu.findMany({
    where: { tipeSoal: { in: ["ESSAY_SINGKAT", "ESSAY_PANJANG", "ESSAY_ARAB", "ESSAY_GAMBAR"] } },
    select: { id: true, pertanyaan: true, kunciJawaban: true, bobot: true, tipeSoal: true }
  });
  const essaySoalIds = essaySoals.map(s => s.id);
  const soalMap = new Map(essaySoals.map(s => [s.id, s]));

  if (essaySoalIds.length === 0) {
    console.log("[BULK-AI] Tidak ada soal essay ditemukan.");
    return;
  }

  try {
    while (true) {
      // Bangun where clause
      const whereClause: any = {
        nilaiManual: null,
        aiGraded: false,
        jawabanTeks: { not: null },
        soalId: { in: essaySoalIds }
      };

      if (paketId) {
        whereClause.sesi = {
          paketId: paketId,
          status: { in: ["AUTO_SUBMIT", "SELESAI", "MENGERJAKAN"] }
        };
      }

      const pendingBatch = await prisma.jawabanUjianSantri.findMany({
        where: whereClause,
        take: 3
      });

      if (pendingBatch.length === 0) {
        console.log(`[BULK-AI] Selesai! Total diproses: ${totalProcessed}, Error: ${totalErrors}`);
        break;
      }

      for (const jaw of pendingBatch) {
        if (!jaw.jawabanTeks) continue;
        const soal = soalMap.get(jaw.soalId);
        if (!soal) continue;

        try {
          const result = await gradeEssayWithAI({
            pertanyaan: removeHtmlTags(soal.pertanyaan),
            kunciJawaban: soal.kunciJawaban || "",
            jawabanSantri: jaw.jawabanTeks,
            bobot: soal.bobot,
            tipeSoal: soal.tipeSoal
          });

          if (result && result.score !== undefined) {
            let finalScore = result.score;
            const bobot = soal.bobot || 10;
            if (finalScore > bobot && finalScore <= 100) finalScore = (finalScore / 100) * bobot;
            if (finalScore > bobot) finalScore = bobot;
            if (finalScore < 0) finalScore = 0;

            // @ts-ignore
            await prisma.jawabanUjianSantri.update({
              where: { id: jaw.id },
              // @ts-ignore
              data: {
                nilaiManual: finalScore,
                aiGraded: true,
                aiFeedback: result.feedback || null
              }
            });

            if (jaw.sesiId) uniqueSesiIds.add(jaw.sesiId);
            totalProcessed++;
          } else {
            // @ts-ignore
            await prisma.jawabanUjianSantri.update({
              where: { id: jaw.id },
              // @ts-ignore
              data: { aiFeedback: `[ERROR] ${result?.error || "Gagal mendapatkan respon AI"}` }
            });
            totalErrors++;
          }
        } catch (err) {
          console.error(`[BULK-AI] Error pada jawaban ${jaw.id}:`, err);
          totalErrors++;
        }
      }

      // Recalculate sesi yang terdampak setiap batch
      for (const sId of uniqueSesiIds) {
        await recalculateSesiNilai(sId).catch(console.error);
      }
      uniqueSesiIds.clear();

      // Jeda 3 detik antar batch
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (error) {
    console.error("[BULK-AI] Fatal error:", error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const paketId = body.paketId || undefined; // Opsional! Jika kosong = GLOBAL

    // Fire-and-forget: langsung jalan di background, response dikirim langsung
    runBackgroundAutoGrade(paketId).catch(err => console.error("[BULK-AI] Uncaught:", err));

    return NextResponse.json({
      success: true,
      message: paketId
        ? "Proses grading AI untuk paket ini telah diluncurkan di background."
        : "Proses grading AI GLOBAL (seluruh sistem) telah diluncurkan di background. Anda boleh menutup halaman."
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
