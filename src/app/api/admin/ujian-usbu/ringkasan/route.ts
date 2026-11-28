import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getActiveAkbarnasBulan } from "@/lib/absensi";
import prisma from "@/lib/prisma";
import { evaluateMapelRegulasi } from "@/lib/regulasi-soal-usbu";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("programId");
    const usbuKe = Number(searchParams.get("usbuKe") || "1");
    const rawBulan = searchParams.get("bulanKe");

    if (!programId) {
      return NextResponse.json({ error: "programId wajib diisi" }, { status: 400 });
    }

    const [{ akbarnasBulan }, program] = await Promise.all([
      getActiveAkbarnasBulan(),
      prisma.program.findUnique({
        where: { id: programId },
        include: {
          programMapels: {
            include: {
              mapel: { select: { id: true, nama_indo: true } },
            },
          },
        },
      }),
    ]);
    if (!program) {
      return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });
    }

    const isAkbarnas = program.nama_indo.toLowerCase().includes("akbarnas");
    const bulanKe = rawBulan ? Number(rawBulan) : akbarnasBulan;

    const [regulasiAll, assignedSoals, allSoalMapels] = await Promise.all([
      prisma.regulasiSoalUsbu.findMany({
        where: { programId, bulanKe: isAkbarnas ? bulanKe : 1 },
        orderBy: [{ mapelId: "asc" }, { urutanQism: "asc" }],
      }),
      prisma.bankSoalUsbu.findMany({
        where: {
          programId,
          usbuAssignments: { some: { usbuKe } },
        },
        select: {
          id: true,
          mapelId: true,
          tipeSoal: true,
          bobot: true,
          bulanKe: true,
          pertanyaan: true,
          bab: { select: { id: true, nama: true } },
          jenisSoal: { select: { id: true, nama: true } },
        },
        orderBy: [{ tipeSoal: "asc" }, { createdAt: "asc" }],
      }),
      prisma.bankSoalUsbu.groupBy({
        by: ["mapelId"],
        where: { programId },
      }),
    ]);

    const mapelsWithAnySoal = new Set(allSoalMapels.map((x) => x.mapelId));

    const regByMapel = new Map<string, typeof regulasiAll>();
    for (const r of regulasiAll) {
      const list = regByMapel.get(r.mapelId) || [];
      list.push(r);
      regByMapel.set(r.mapelId, list);
    }

    const soalsByMapel = new Map<string, typeof assignedSoals>();
    for (const s of assignedSoals) {
      const list = soalsByMapel.get(s.mapelId) || [];
      list.push(s);
      soalsByMapel.set(s.mapelId, list);
    }

    // Ketat: khusus Akbarnas ikuti mapel bulan aktif (+ jika ada soal tercentang di usbu ini);
    // program lain tampilkan mapel yang ada di panduan regulasi PDF ATAU sudah punya soal CBT
    const mapelSummaries = program.programMapels
      .filter((pm) =>
        isAkbarnas
          ? regByMapel.has(pm.mapel.id) || (soalsByMapel.get(pm.mapel.id)?.length || 0) > 0
          : regByMapel.has(pm.mapel.id) || mapelsWithAnySoal.has(pm.mapel.id),
      )
      .map((pm) => {
        const m = pm.mapel;
        const rules = (regByMapel.get(m.id) || []).filter((r) => {
          if (usbuKe !== 1 && usbuKe !== 2) return false;
          const allowed = (r.usbuBerlaku || "1,2")
            .split(",")
            .map((x) => Number(x.trim()));
          return allowed.includes(usbuKe);
        });
        const soals = soalsByMapel.get(m.id) || [];
        const evaluation = evaluateMapelRegulasi(rules, soals);
        return {
          mapelId: m.id,
          mapelNama: m.nama_indo,
          evaluation,
          soals,
        };
      })
      .sort((a, b) => {
        // Prioritaskan mapel yang punya regulasi / soal terpilih di atas
        const scoreA = (a.evaluation.hasRegulasi ? 2 : 0) + (a.soals.length > 0 ? 1 : 0);
        const scoreB = (b.evaluation.hasRegulasi ? 2 : 0) + (b.soals.length > 0 ? 1 : 0);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.mapelNama.localeCompare(b.mapelNama);
      });

    const totalSoalGlobal = assignedSoals.length;
    const totalBobotGlobal =
      Math.round(
        assignedSoals.reduce((acc, s) => acc + (Number(s.bobot) || 0), 0) * 100,
      ) / 100;
    const mapelOver100Count = mapelSummaries.filter(
      (m) => m.evaluation.isOver100,
    ).length;
    const mapelReadyCount = mapelSummaries.filter(
      (m) => m.evaluation.hasRegulasi && m.evaluation.isExact100 && m.evaluation.qisms.every((q) => q.status === "PAS"),
    ).length;
    const mapelWithRegulasiCount = mapelSummaries.filter(
      (m) => m.evaluation.hasRegulasi,
    ).length;

    return NextResponse.json({
      programId,
      programNama: program.nama_indo,
      isAkbarnas,
      usbuKe,
      bulanKe: isAkbarnas ? bulanKe : 1,
      totalSoalGlobal,
      totalBobotGlobal,
      mapelOver100Count,
      mapelReadyCount,
      mapelWithRegulasiCount,
      mapels: mapelSummaries,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat ringkasan" },
      { status: 500 },
    );
  }
}
