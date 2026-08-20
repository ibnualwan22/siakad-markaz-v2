import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { gradeEssayWithAI } from "@/lib/ai-grader";
import { recalculateSesiNilai } from "@/lib/recalculate-sesi-nilai";

const removeHtmlTags = (str: string) => (str || "").replace(/<[^>]*>?/gm, '');

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

    const { jawabanIds } = await req.json(); // array of string id
    if (!jawabanIds || !Array.isArray(jawabanIds)) {
      return NextResponse.json({ error: "Invalid data: jawabanIds array is required" }, { status: 400 });
    }

    const feedbacks = [];
    const errors = [];
    const uniqueSesiIds = new Set<string>();
    
    for (const jawId of jawabanIds) {
      const jaw: any = await prisma.jawabanUjianSantri.findUnique({
        where: { id: jawId }
      });

      if (!jaw || !jaw.jawabanTeks) continue;
      if (jaw.sesiId) {
        uniqueSesiIds.add(jaw.sesiId);
      }

      const soal: any = await prisma.bankSoalUsbu.findUnique({
        where: { id: jaw.soalId }
      });

      if (!soal) continue;
      
      const res = await gradeEssayWithAI({
        pertanyaan: removeHtmlTags(soal.pertanyaan),
        kunciJawaban: soal.kunciJawaban || "",
        jawabanSantri: jaw.jawabanTeks,
        bobot: soal.bobot,
        tipeSoal: soal.tipeSoal
      });

      if (res && res.score !== undefined) {
        let finalScore = res.score;
        const bobot = soal.bobot || 10;
        
        if (finalScore > bobot && finalScore <= 100) {
          finalScore = (finalScore / 100) * bobot;
        }
        
        if (finalScore > bobot) finalScore = bobot;
        if (finalScore < 0) finalScore = 0;
        
        // @ts-ignore
        await prisma.jawabanUjianSantri.update({
          where: { id: jawId },
          // @ts-ignore - Prisma cache workaround
          data: {
            nilaiManual: finalScore,
            aiGraded: true,
            aiFeedback: res.feedback
          }
        });
        feedbacks.push({ id: jawId, score: finalScore, feedback: res.feedback });
      } else if (res && (res as any).error) {
        errors.push({ id: jawId, error: (res as any).error });
      } else {
         errors.push({ id: jawId, error: "Failed to grade without explicit error from AI" });
      }
    }

    // Recalculate unique sesiIds
    if (uniqueSesiIds.size > 0) {
      for (const sId of uniqueSesiIds) {
        await recalculateSesiNilai(sId).catch(console.error);
      }
    }

    if (feedbacks.length === 0 && errors.length > 0) {
       return NextResponse.json({ error: errors[0].error }, { status: 500 });
    }

    return NextResponse.json({ success: true, processed: feedbacks.length, feedbacks, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
