import { NextResponse } from "next/server";

export async function gradeEssayWithAI(params: {
  pertanyaan: string;
  kunciJawaban: string;
  jawabanSantri: string;
  bobot: number;
  tipeSoal: string; // ESSAY_SINGKAT | ESSAY_PANJANG
}): Promise<{ score?: number; feedback?: string; isPartiallyCorrect?: boolean; error?: string } | null> {
  try {
    const apiKey = process.env.AGNES_AI_API_KEY;
    const baseUrl = process.env.AGNES_AI_BASE_URL || "https://apihub.agnes-ai.com/v1";

    if (!apiKey) {
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

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
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
      console.error("Agnes AI API Error:", errorText);
      return { error: `Agnes AI Error: ${response.status} ${errorText}` };
    }

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
  } catch (error: any) {
    console.error("Error in gradeEssayWithAI:", error);
    return { error: `Koneksi ke Agnes AI gagal: ${error.message || String(error)}` };
  }
}
