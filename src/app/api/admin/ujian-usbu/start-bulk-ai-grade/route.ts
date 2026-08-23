import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { recalculateSesiNilai } from "@/lib/recalculate-sesi-nilai";

// Function yang berjalan di belakang layar secara asinkron tanpa kutunggu
async function runBackgroundAutoGrade(paketId: string) {
  try {
    // 1. Dapatkan semua Soal yang tipenya ESSAY pada paket terkait
    const soalPakets = await prisma.soalPaket.findMany({
      where: { paketId },
      include: { soal: true }
    });
    const essaySoals = soalPakets.map(sp => sp.soal).filter(s => Array.isArray(s.tipeSoal) ? false : (s.tipeSoal as string).startsWith("ESSAY"));
    const essayIds = essaySoals.map(s => s.id);

    if (essayIds.length === 0) return;

    // 2. Dapatkan Sesi yang berjalan untuk Paket ini
    const sesiList = await prisma.sesiUjianSantri.findMany({
      where: {
        paketId,
        status: { in: ["AUTO_SUBMIT", "SELESAI", "MENGERJAKAN"] }
      },
      select: { id: true }
    });
    const sesiIds = sesiList.map(s => s.id);

    if (sesiIds.length === 0) return;

    // 3. Looping sampai semua JawabanUjianSantri di sesi tsb yang memiliki nilaiManual null terpanggil
    while (true) {
       const pendingJawabans = await prisma.jawabanUjianSantri.findMany({
          where: {
             sesiId: { in: sesiIds },
             soalId: { in: essayIds },
             nilaiManual: null,
             aiGraded: false
          },
          take: 5,
          select: { id: true }
       });

       if (pendingJawabans.length === 0) {
          console.log("[BULK-AI-GRADE] Semua antrean essay untuk paket ini selesai dinilai.");
          break; // Exit loop, done!
       }

       // Ambil jawaban, extract array of ID, dan kirim batch ke endpoint /api/admin/ujian-usbu/ai-grade internal logic
       const batchIds = pendingJawabans.map(j => j.id);
       
       console.log(`[BULK-AI-GRADE] Menilai batch sebanyak ${batchIds.length} ID ...`);

       try {
          // Menjalankan HTTP call lokal ke Endpoint API AI-Grade bawaan
          // Karena domain belum tentu pasti di server, lebih aman require logic-nya secara langsung.
          // Tapi karena ini server-side Next.js, memanggil absolute fetch() memerlukan domain environment.
          // Untuk amannya, kita kerjakan API logic Gemini menggunakan API absolute.
          let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;
          
          const aiRes = await fetch(`${baseUrl}/api/admin/ujian-usbu/ai-grade`, {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ jawabanIds: batchIds })
          });
          
          if (!aiRes.ok) {
             console.error("[BULK-AI-GRADE] AI Grade Batch Error: ", await aiRes.text());
          }
       } catch (err) {
          console.error("[BULK-AI-GRADE] AI Fetch Exception: ", err);
       }

       // 4. Jeda / Delay Throttle 3.5 Detik untuk menghargai Free Tier RPM Google Gemini
       await new Promise(resolve => setTimeout(resolve, 3500));
    }

  } catch (error) {
     console.error("[BULK-AI-GRADE] Terhenti dengan error:", error);
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

    const { paketId } = await req.json();

    if (!paketId) {
      return NextResponse.json({ error: "Paket ID invalid" }, { status: 400 });
    }

    // Fire and Forget (TIDAK ADA keyword `await`)
    // Menjalankan tugas di background. Response Langsung dikirimkan ke client.
    runBackgroundAutoGrade(paketId).catch(err => console.error(err));

    return NextResponse.json({ 
      success: true, 
      message: "Proses grading AI server-side telah berhasil diluncurkan."
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
