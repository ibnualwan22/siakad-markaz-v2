import { NextResponse } from "next/server";
import * as xlsx from "xlsx";

export async function GET() {
  try {
    // Data dummy untuk guide format
    const ws_data = [
      ["Pertanyaan", "Bobot", "Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D", "Jawaban Benar"],
      ["Siapakah rasul terakhir penutup para nabi?", 10, "Nabi Musa AS", "Nabi Isa AS", "Nabi Muhammad SAW", "Nabi Ibrahim AS", "C"],
      ["Rukun Islam yang pertama adalah?", 15, "Sholat", "Zakat", "Puasa", "Syahadat", "D"],
      ["(Contoh Soal 3 - Silakan ditimpa)", 10, "Opsi A", "Opsi B", "Opsi C", "Opsi D", "A"]
    ];

    const ws = xlsx.utils.aoa_to_sheet(ws_data);
    
    // Set column width for better visibility
    ws["!cols"] = [
      { wch: 40 }, // Pertanyaan
      { wch: 10 }, // Bobot
      { wch: 25 }, // Pilihan A
      { wch: 25 }, // Pilihan B
      { wch: 25 }, // Pilihan C
      { wch: 25 }, // Pilihan D
      { wch: 15 }, // Jawaban Benar
    ];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Template Soal");
    
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Template_Import_Soal_CBT.xlsx"'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "Gagal membuat template" }, { status: 500 });
  }
}
