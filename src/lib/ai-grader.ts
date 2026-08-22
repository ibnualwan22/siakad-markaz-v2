import { NextResponse } from "next/server";

export async function gradeEssayWithAI(params: {
  pertanyaan: string;
  kunciJawaban: string;
  jawabanSantri: string;
  bobot: number;
  tipeSoal: string; // ESSAY_SINGKAT | ESSAY_PANJANG
}): Promise<{ score?: number; feedback?: string; isPartiallyCorrect?: boolean; error?: string } | null> {
  try {
    const apiKeys: string[] = [];
    // Deteksi AGNES_AI_API_KEY, AGNES_AI_API_KEY_2, AGNES_AI_API_KEY_3, dst... sampai max 20
    for (let i = 1; i <= 20; i++) {
      const keyName = i === 1 ? 'AGNES_AI_API_KEY' : `AGNES_AI_API_KEY_${i}`;
      if (process.env[keyName]) {
        apiKeys.push(process.env[keyName] as string);
      }
    }
    
    const baseUrl = process.env.AGNES_AI_BASE_URL || "https://apihub.agnes-ai.com/v1";

    if (apiKeys.length === 0) {
      console.error("AGNES_AI_API_KEY is not set in environment variables");
      return { error: "API Key Agnes AI belum dikonfigurasi (AGNES_AI_API_KEY)" };
    }

    const systemPrompt = `Anda adalah asisten pengoreksi ujian otomatis (AI Grader) yang sangat teliti.
Tugas Anda adalah menilai jawaban siswa untuk soal essay berdasarkan Kunci Jawaban yang diberikan oleh guru.
Berdasarkan jawaban siswa, Anda harus memberikan:
1. Skor (0 sampai ${params.bobot}), dengan mempertimbangkan:
   - Nilai penuh (${params.bobot}) jika jawaban sangat tepat dan mencakup ide utama kunci jawaban.
   - Nilai sebagian jika jawaban benar tapi kurang lengkap atau ada sedikit ketidaktepatan.
   - Nilai 0 jika jawaban salah sama sekali atau melenceng jauh.
2. Feedback atau alasan singkat mengapa nilai tersebut diberikan.
3. Status partially correct (true/false) jika jawaban benar sebagian.

- Nilai minimal adalah 0, nilai maksimal adalah bobot soal (misal: jika bobot 50, maka rentangnya 0 sampai 50).
- Untuk soal lainnya, nilai berdasarkan makna dan relevansi, tidak perlu terlalu kaku pada susunan kata (kecuali konteksnya sangat spesifik).

TOLONG MERESPON HANYA DENGAN JSON FORMAT BERIKUT (TANPA MARKDOWN, TANPA TEKS LAIN):
{
  "score": number, // (0 sampai ${params.bobot})
  "feedback": "string",
  "isPartiallyCorrect": boolean
}`;

    const userPrompt = `Tipe Soal: ${params.tipeSoal}
Pertanyaan: ${params.pertanyaan}
Kunci Jawaban Guru: ${params.kunciJawaban}

Jawaban Siswa: ${params.jawabanSantri}`;

    let lastError = "";

    // Loop mencoba satu persatu API key dari daftar
    for (let i = 0; i < apiKeys.length; i++) {
      const apiKey = apiKeys[i];
      const keyNumber = i + 1;

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(60000), // Batasi maksimal 60 detik
          body: JSON.stringify({
            model: "agnes-2.5-flash", // fallback default, maybe need adjust config later
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.1, // Keep it deterministic
            response_format: { type: "json_object" }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          // Jika rate limit atau server down (503/502/500/504), skip dan coba key berikutnya
          if (response.status === 429 || response.status >= 500) {
            console.warn(`[AI Grader] API Key ke-${keyNumber} gagal (Status ${response.status}). Mengganti ke API cadangan...`);
            lastError = `Status ${response.status}: ${errorText.substring(0, 60)}`;
            continue; 
          }
          
          // Jika bukan karena overload/limit (contoh 400 Bad Request, artinya prompt yg salah)
          console.error(`[AI Grader] Fatal Error dari Agnes AI (Status ${response.status}):`, errorText);
          return { error: `Agnes AI Error: ${response.status} ${errorText}` };
        }

        // --- BERHASIL MENDAPATKAN RESPONS ---
        const data = await response.json();
        const resultText = data.choices?.[0]?.message?.content;

        if (!resultText) return { error: "Agnes AI memberikan respon kosong / tidak berformat JSON" };

        try {
          const resultObj = JSON.parse(resultText);
          return {
            score: Math.min(Math.max(Number(resultObj.score) || 0, 0), params.bobot),
            feedback: resultObj.feedback || "AI tidak memberikan alasan.",
            isPartiallyCorrect: !!resultObj.isPartiallyCorrect
          };
        } catch (parseError) {
          console.error("Failed to parse AI response json:", parseError, resultText);
          return { error: `Gagal mem-parsing balasan AI (bukan JSON riil): ${resultText.substring(0, 50)}...` };
        }

      } catch (reqError: any) {
        // Triggered jika terjadi Timeout 60s atau koneksi putus
        console.warn(`[AI Grader] API Key ke-${keyNumber} Timeout / Error Jaringan: ${reqError.message}. Mengganti ke API cadangan...`);
        lastError = reqError.message || String(reqError);
        continue;
      }
    }

    // Jika LOOP selesai dan semua api keys di dalam array gagal
    console.error("[AI Grader] Semua API keys dalam sistem telah gagal.");
    return { error: `Sistem sedang dalam lalu lintas sangat tinggi, seluruh API cadangan telah habis dipakai. Kesalahan terakhir: ${lastError}` };

  } catch (error: any) {
    console.error("Unexpected Error in gradeEssayWithAI:", error);
    return { error: `Sistem AI Grader mengalami kendala: ${error.message || String(error)}` };
  }
}
