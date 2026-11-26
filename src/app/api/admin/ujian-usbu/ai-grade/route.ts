import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import prisma from "@/lib/prisma";
import { buildAiGraderInputFromSoal, gradeEssayWithAI } from "@/lib/ai-grader";
import { recalculateSesiNilai } from "@/lib/recalculate-sesi-nilai";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await checkPermission("ujian_usbu"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { jawabanIds } = await req.json(); // array of string id
    if (!jawabanIds || !Array.isArray(jawabanIds)) {
      return NextResponse.json(
        { error: "Invalid data: jawabanIds array is required" },
        { status: 400 },
      );
    }

    const feedbacks = [];
    const errors = [];
    const uniqueSesiIds = new Set<string>();

    for (const jawId of jawabanIds) {
      const jaw: any = await prisma.jawabanUjianSantri.findUnique({
        where: { id: jawId },
        include: { sesi: { select: { paketId: true } } },
      });

      if (!jaw || !jaw.jawabanTeks) continue;
      if (jaw.sesiId) {
        uniqueSesiIds.add(jaw.sesiId);
      }

      const soal: any = await prisma.bankSoalUsbu.findUnique({
        where: { id: jaw.soalId },
        include: {
          mapel: true,
          program: true,
          jenisSoal: true,
          grupInduk: { select: { pertanyaan: true } },
        },
      });

      if (!soal) continue;

      const snapshot = jaw.sesi?.paketId
        ? await prisma.soalPaket.findUnique({
            where: {
              paketId_soalId: { paketId: jaw.sesi.paketId, soalId: soal.id },
            },
            select: {
              pertanyaanSnapshot: true,
              kunciJawabanSnapshot: true,
              bobotSnapshot: true,
            },
          })
        : null;

      const graderInput = buildAiGraderInputFromSoal(soal, jaw.jawabanTeks, snapshot);
      const res = await gradeEssayWithAI(graderInput);

      if (res && res.score !== undefined) {
        const bobot = graderInput.bobot || 10;
        const finalScore = Math.min(Math.max(Number(res.score) || 0, 0), bobot);

        await prisma.jawabanUjianSantri.update({
          where: { id: jawId },
          data: {
            nilaiManual: finalScore,
            aiGraded: true,
            aiFeedback: res.feedback || null,
            needsReview: Boolean(res.needsTeacherReview),
          },
        });
        feedbacks.push({
          id: jawId,
          score: finalScore,
          feedback: res.feedback,
          needsReview: Boolean(res.needsTeacherReview),
        });
      } else if (res && res.error) {
        errors.push({ id: jawId, error: res.error });
      } else {
        errors.push({ id: jawId, error: "Failed to grade without explicit error from AI" });
      }
    }

    if (uniqueSesiIds.size > 0) {
      for (const sId of uniqueSesiIds) {
        await recalculateSesiNilai(sId).catch(console.error);
      }
    }

    if (feedbacks.length === 0 && errors.length > 0) {
      return NextResponse.json({ error: errors[0].error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      processed: feedbacks.length,
      feedbacks,
      errors,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
