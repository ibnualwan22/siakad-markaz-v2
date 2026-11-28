import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMasterSantriList } from "@/lib/santri-api";
import { calcAkumulatif, applyNilaiTambahan } from "@/lib/grade-calculator";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usbuParam = req.nextUrl.searchParams.get("usbu") || "1";
  const targetUsbu = parseInt(usbuParam);

  if (targetUsbu < 1 || targetUsbu > 4) {
    return NextResponse.json({ error: "Invalid usbu parameter" }, { status: 400 });
  }

  try {
    const masterList = await getMasterSantriList();
    const masterMap = new Map(masterList.map(m => [m.id, m]));
    const activeStudentIds = new Set(
      Array.from(masterMap.values()).filter(m => m.isAktif).map(m => m.id)
    );

    const kelasList = await prisma.kelas.findMany({
      where: { isActive: true, isDeleted: false },
      include: {
        waliKelas: true,
        program: {
          include: {
            programMapels: {
              include: { mapel: true },
              orderBy: { urutan: "asc" }
            }
          }
        }
      },
      orderBy: { nama: "asc" }
    });

    // Struktur: programId -> { programNama, mapelHeaders, rank1Students[] }
    const programDataMap = new Map<string, {
      programNama: string;
      mapelHeaders: string[];
      rank1Students: {
        nama: string;
        kelasNama: string;
        waliKelas: string;
        mapelScores: (number | "-")[];
        nilaiAkumulatif: number;
        gender: string;
      }[];
    }>();

    for (const kelas of kelasList) {
      const riwayatListRaw = await prisma.riwayatSantri.findMany({
        where: { kelasId: kelas.id },
        include: { santri: true, nilaiList: true }
      });

      if (riwayatListRaw.length === 0) continue;

      const isAkbarnas = kelas.program.nama_indo.toLowerCase().includes("akbarnas");
      const isMonth2 = kelas.is_akbarnas_b2 || false;

      // Filter active students
      const riwayatList = riwayatListRaw.filter(r => {
        const ms = masterMap.get(r.santriId);
        return activeStudentIds.has(r.santriId) && ms?.dufahNama === r.dufahNama;
      });

      if (riwayatList.length === 0) continue;

      // Filter mapels based on usbu and program
      const activeMapels = kelas.program.programMapels.filter(pm => {
        if (targetUsbu !== 4 && pm.mapel.jumlah_tes === 1) return false;
        if (isAkbarnas && targetUsbu === 4) return true;
        if (!isAkbarnas) return true;
        if (isMonth2) {
          return (pm.mapel as any).bulan_aktif !== 1;
        } else {
          return (pm.mapel as any).bulan_aktif !== 2;
        }
      });

      // Calculate scores per student
      const rows = riwayatList.map(riwayat => {
        const ms = masterMap.get(riwayat.santriId);
        if (!ms && !riwayat.santri) return null;

        const nama = ms?.nama || riwayat.santri.nama || "Tanpa Nama";
        const gender = ms?.gender || "-";

        const mapelScores: (number | "-")[] = [];
        const akumulatifItems: { score: number; bobot: number }[] = [];

        for (const pm of activeMapels) {
          const match = riwayat.nilaiList.find((n: any) => n.mapelId === pm.mapelId);

          let score: number | null = null;
          if (match) {
            if (targetUsbu === 1) score = match.nilaiUsbu1 ?? match.nilaiAkhir;
            if (targetUsbu === 2) score = match.nilaiUsbu2 ?? match.nilaiAkhir;
            if (targetUsbu === 3) score = match.nilaiNihai ?? match.nilaiAkhir;
            if (targetUsbu === 4) {
              const base = match.nilaiAkhir;
              const tmb = match.nilaiTambahan ?? 0;
              score = base !== null && base !== undefined ? applyNilaiTambahan(base, tmb) : null;
            }
          }

          if (score !== null && score !== undefined) {
            mapelScores.push(score);
            if (pm.mapel.masuk_akumulasi !== false) {
              const currentWeight = targetUsbu === 4 ? (pm.mapel.bobot ?? 1) : ((pm.mapel as any).bobot_usbu ?? 1);
              akumulatifItems.push({ score, bobot: currentWeight });
            }
          } else {
            mapelScores.push("-");
          }
        }

        const nilaiAkumulatif = calcAkumulatif(akumulatifItems);

        return { nama, gender, mapelScores, nilaiAkumulatif };
      }).filter(Boolean) as any[];

      if (rows.length === 0) continue;

      // Sort by akumulatif descending to find rank 1
      rows.sort((a: any, b: any) => b.nilaiAkumulatif - a.nilaiAkumulatif);

      // Get rank 1 student(s) — could be ties
      const rank1Score = rows[0].nilaiAkumulatif;
      
      // DO NOT include if the max score is 0 (meaning no one has scores)
      if (rank1Score <= 0) continue;

      const rank1Students = rows.filter((r: any) => r.nilaiAkumulatif === rank1Score);

      // Get or create program group
      const programId = kelas.programId;
      if (!programDataMap.has(programId)) {
        programDataMap.set(programId, {
          programNama: kelas.program.nama_indo,
          mapelHeaders: activeMapels.map(pm => pm.mapel.nama_indo.toUpperCase()),
          rank1Students: []
        });
      }

      const programData = programDataMap.get(programId)!;

      // Update mapel headers if this class has more subjects (take the longest)
      const currentHeaders = activeMapels.map(pm => pm.mapel.nama_indo.toUpperCase());
      if (currentHeaders.length > programData.mapelHeaders.length) {
        programData.mapelHeaders = currentHeaders;
      }

      for (const student of rank1Students) {
        programData.rank1Students.push({
          nama: student.nama,
          kelasNama: kelas.nama + (isMonth2 ? " (B2)" : ""),
          waliKelas: kelas.waliKelas?.nama || "-",
          mapelScores: student.mapelScores,
          nilaiAkumulatif: student.nilaiAkumulatif,
          gender: student.gender,
        });
      }
    }

    // Now rank the rank-1 students within each program
    const programs = Array.from(programDataMap.values()).map(prog => {
      // Sort by akumulatif descending
      prog.rank1Students.sort((a, b) => b.nilaiAkumulatif - a.nilaiAkumulatif);

      // Assign overall rank
      const rankedStudents = prog.rank1Students.map((student, idx) => ({
        ...student,
        overallRank: idx + 1,
      }));

      return {
        programNama: prog.programNama,
        mapelHeaders: prog.mapelHeaders,
        rankedStudents,
      };
    });

    // Sort programs alphabetically
    programs.sort((a, b) => a.programNama.localeCompare(b.programNama, "id"));

    return NextResponse.json({ programs });
  } catch (error) {
    console.error("Error fetching thalib mitsali data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
