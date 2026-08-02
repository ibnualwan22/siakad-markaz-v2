import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import * as xlsx from "xlsx";

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
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet) as any[];

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "File Excel kosong atau format salah" }, { status: 400 });
    }

    let count = 0;
    await prisma.$transaction(async (tx: any) => {
      // Jika override, hapus soal mapel ini pada program, usbuKe, dan paketSoal ini dulu
      if (timpaSoal) {
        await tx.bankSoalUsbu.deleteMany({
          where: { programId, mapelId, usbuKe, paketSoal }
        });
      }

      for (const row of data) {
        const pertanyaan = row["Pertanyaan"] || row["pertanyaan"];
        if (!pertanyaan) continue;

        const bobot = row["Bobot"] || row["bobot"] || 10;
        // Optionally allow row-level paket_soal override
        const rowPaketSoal = row["Paket Soal"] || row["paket_soal"] || paketSoal;
        
        let opsiList = [];
        const isCorrectA = (row["Jawaban Benar"] || row["jawaban_benar"])?.toString().toUpperCase() === "A";
        const isCorrectB = (row["Jawaban Benar"] || row["jawaban_benar"])?.toString().toUpperCase() === "B";
        const isCorrectC = (row["Jawaban Benar"] || row["jawaban_benar"])?.toString().toUpperCase() === "C";
        const isCorrectD = (row["Jawaban Benar"] || row["jawaban_benar"])?.toString().toUpperCase() === "D";

        if (row["Pilihan A"] || row["pilihan_a"]) {
          opsiList.push({ teks: (row["Pilihan A"] || row["pilihan_a"]).toString(), isCorrect: isCorrectA, urutan: 1 });
        }
        if (row["Pilihan B"] || row["pilihan_b"]) {
          opsiList.push({ teks: (row["Pilihan B"] || row["pilihan_b"]).toString(), isCorrect: isCorrectB, urutan: 2 });
        }
        if (row["Pilihan C"] || row["pilihan_c"]) {
          opsiList.push({ teks: (row["Pilihan C"] || row["pilihan_c"]).toString(), isCorrect: isCorrectC, urutan: 3 });
        }
        if (row["Pilihan D"] || row["pilihan_d"]) {
          opsiList.push({ teks: (row["Pilihan D"] || row["pilihan_d"]).toString(), isCorrect: isCorrectD, urutan: 4 });
        }

        // Must have at least 1 correct answer, default to A if none match
        const hasCorrect = opsiList.some(o => o.isCorrect);
        if (!hasCorrect && opsiList.length > 0) opsiList[0].isCorrect = true;

        await tx.bankSoalUsbu.create({
          data: {
            programId,
            mapelId,
            usbuKe,
            paketSoal: rowPaketSoal,
            tipeSoal: "PG",
            pertanyaan: pertanyaan.toString(),
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
