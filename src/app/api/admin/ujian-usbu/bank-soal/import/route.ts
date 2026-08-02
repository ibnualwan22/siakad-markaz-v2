import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import * as xlsx from "xlsx";

// ── Helper: Extract rich text (bold/underline) from an Excel cell as HTML ──
function getCellHtml(sheet: xlsx.WorkSheet, cellAddress: string): string {
  const cell = sheet[cellAddress];
  if (!cell) return "";

  // If xlsx parsed rich text runs (cell.r is an array of XML-like rich text runs)
  // We need to check the raw XML. The 'xlsx' library exposes rich text in cell.r or cell.h
  // But the community edition has limited rich text support.
  // Instead, we read the cell value and check for formatting via the cell style.
  
  // For the community xlsx library, rich text is not directly accessible via cell.r
  // So we return the plain value as a string
  return (cell.v ?? "").toString();
}

// ── Helper: Parse cell rich text from raw XML if available ──
function getCellRichText(workbook: xlsx.WorkBook, sheet: xlsx.WorkSheet, cellAddress: string): string {
  const cell = sheet[cellAddress];
  if (!cell) return "";
  
  // The xlsx library (community) stores rich text in cell.R when parsed with {cellStyles: true}
  // cell.R is an array of {t: string, s?: {bold?: boolean, underline?: boolean}} fragments
  if (cell.R && Array.isArray(cell.R)) {
    return cell.R.map((run: any) => {
      let text = escapeHtml(run.t || "");
      if (run.s) {
        if (run.s.bold) text = `<b>${text}</b>`;
        if (run.s.underline) text = `<u>${text}</u>`;
      }
      return text;
    }).join("");
  }
  
  // Fallback: try cell.h (HTML representation if available)
  if (cell.h) return cell.h;

  // Final fallback: plain text
  return escapeHtml((cell.v ?? "").toString());
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Helper: Get column address from header index ──
function colAddr(col: number, row: number): string {
  let s = "";
  let c = col;
  while (c >= 0) {
    s = String.fromCharCode((c % 26) + 65) + s;
    c = Math.floor(c / 26) - 1;
  }
  return s + row;
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

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const programId = formData.get("programId") as string;
    const mapelId = formData.get("mapelId") as string;
    const usbuKe = Number(formData.get("usbuKe") || "1");
    const paketSoal = (formData.get("paketSoal") as string) || "A";
    const timpaSoal = formData.get("timpaSoal") === "true";

    if (!file || !programId || !mapelId) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const workbook = xlsx.read(buffer, { type: "buffer", cellStyles: true, cellHTML: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Get the range to iterate row by row
    const range = xlsx.utils.decode_range(sheet["!ref"] || "A1");
    
    // Read header row to find column indices
    const headers: Record<string, number> = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = colAddr(c, range.s.r + 1);
      const cell = sheet[addr];
      if (cell && cell.v) {
        headers[cell.v.toString().trim()] = c;
      }
    }

    // Map header names to column indices (case-insensitive fallback)
    const getCol = (names: string[]): number => {
      for (const name of names) {
        if (headers[name] !== undefined) return headers[name];
      }
      return -1;
    };

    const colPertanyaan = getCol(["Pertanyaan", "pertanyaan"]);
    const colBobot = getCol(["Bobot", "bobot"]);
    const colPaketSoal = getCol(["Paket Soal", "paket_soal"]);
    const colPilihanA = getCol(["Pilihan A", "pilihan_a"]);
    const colPilihanB = getCol(["Pilihan B", "pilihan_b"]);
    const colPilihanC = getCol(["Pilihan C", "pilihan_c"]);
    const colPilihanD = getCol(["Pilihan D", "pilihan_d"]);
    const colJawabanBenar = getCol(["Jawaban Benar", "jawaban_benar"]);

    if (colPertanyaan === -1) {
      return NextResponse.json({ error: "Kolom 'Pertanyaan' tidak ditemukan di file Excel" }, { status: 400 });
    }

    let count = 0;
    await prisma.$transaction(async (tx: any) => {
      if (timpaSoal) {
        await tx.bankSoalUsbu.deleteMany({
          where: { programId, mapelId, usbuKe, paketSoal }
        });
      }

      // Iterate data rows (skip header row)
      for (let r = range.s.r + 2; r <= range.e.r + 1; r++) {
        const pertanyaan = getCellRichText(workbook, sheet, colAddr(colPertanyaan, r));
        if (!pertanyaan || pertanyaan.trim() === "") continue;

        const bobotCell = sheet[colAddr(colBobot, r)];
        const bobot = bobotCell?.v ?? 10;

        const paketCell = sheet[colAddr(colPaketSoal, r)];
        const rowPaketSoal = paketCell?.v?.toString() || paketSoal;

        const jawabanCell = sheet[colAddr(colJawabanBenar, r)];
        const jawaban = (jawabanCell?.v ?? "").toString().toUpperCase().trim();

        let opsiList = [];
        const opsiCols = [
          { col: colPilihanA, letter: "A", urutan: 1 },
          { col: colPilihanB, letter: "B", urutan: 2 },
          { col: colPilihanC, letter: "C", urutan: 3 },
          { col: colPilihanD, letter: "D", urutan: 4 },
        ];

        for (const opsi of opsiCols) {
          if (opsi.col === -1) continue;
          const teks = getCellRichText(workbook, sheet, colAddr(opsi.col, r));
          if (teks && teks.trim() !== "") {
            opsiList.push({
              teks,
              isCorrect: jawaban === opsi.letter,
              urutan: opsi.urutan
            });
          }
        }

        const hasCorrect = opsiList.some(o => o.isCorrect);
        if (!hasCorrect && opsiList.length > 0) opsiList[0].isCorrect = true;

        await tx.bankSoalUsbu.create({
          data: {
            programId,
            mapelId,
            usbuKe,
            paketSoal: rowPaketSoal,
            tipeSoal: "PG",
            pertanyaan,
            bobot: Number(bobot),
            opsiList: {
              create: opsiList
            }
          }
        });
        count++;
      }
    });

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
