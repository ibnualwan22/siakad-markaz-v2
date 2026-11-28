import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getActiveAkbarnasBulan } from "@/lib/absensi";
import { checkQuotaForCandidate } from "@/lib/regulasi-soal-usbu";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await checkPermission("ujian_usbu"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { soalIds, usbuKe, force } = await req.json();

    if (!Array.isArray(soalIds) || soalIds.length === 0 || !usbuKe) {
      return NextResponse.json(
        { error: "soalIds (array) dan usbuKe diperlukan" },
        { status: 400 },
      );
    }

    const usbuFormat = Number(usbuKe);

    const existing = await prisma.soalUsbuAssignment.findMany({
      where: {
        soalId: { in: soalIds },
        usbuKe: usbuFormat,
      },
      select: { soalId: true },
    });

    const existingSoalIds = new Set(existing.map((e) => e.soalId));
    const toInsertIds = soalIds.filter((id: string) => !existingSoalIds.has(id));

    if (toInsertIds.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, autoBobotApplied: [] });
    }

    const candidateSoals = await prisma.bankSoalUsbu.findMany({
      where: { id: { in: toInsertIds } },
      select: {
        id: true,
        programId: true,
        mapelId: true,
        bulanKe: true,
        tipeSoal: true,
        bobot: true,
        program: { select: { nama_indo: true } },
      },
    });

    const autoBobotUpdates: { id: string; bobot: number }[] = [];

    // Validasi kuota & auto-bobot regulasi untuk Usbu' 1 & 2
    if ((usbuFormat === 1 || usbuFormat === 2) && !force) {
      const { akbarnasBulan } = await getActiveAkbarnasBulan();

      // Kelompokkan kandidat berdasarkan (programId, mapelId, effBulan)
      const cacheKey = (s: { programId: string; mapelId: string; program: { nama_indo: string } }) => {
        const isAkbarnas = s.program.nama_indo.toLowerCase().includes("akbarnas");
        return `${s.programId}|${s.mapelId}|${isAkbarnas ? akbarnasBulan : 1}`;
      };

      const rulesCache = new Map<string, Awaited<ReturnType<typeof prisma.regulasiSoalUsbu.findMany>>>();
      const assignedCache = new Map<string, { id: string; tipeSoal: string; bobot: number; bulanKe: number }[]>();

      for (const s of candidateSoals) {
        const isAkbarnas = s.program.nama_indo.toLowerCase().includes("akbarnas");
        const effBulan = isAkbarnas ? akbarnasBulan : 1;
        const key = cacheKey(s);

        if (!rulesCache.has(key)) {
          const [rules, curAssigned] = await Promise.all([
            prisma.regulasiSoalUsbu.findMany({
              where: {
                programId: s.programId,
                mapelId: s.mapelId,
                bulanKe: effBulan,
              },
              orderBy: { urutanQism: "asc" },
            }),
            prisma.bankSoalUsbu.findMany({
              where: {
                programId: s.programId,
                mapelId: s.mapelId,
                usbuAssignments: { some: { usbuKe: usbuFormat } },
              },
              select: { id: true, tipeSoal: true, bobot: true, bulanKe: true },
            }),
          ]);
          rulesCache.set(key, rules);
          assignedCache.set(key, curAssigned);
        }

        const rules = rulesCache.get(key) || [];
        const curAssigned = assignedCache.get(key) || [];

        const quotaCheck = checkQuotaForCandidate(
          rules,
          curAssigned,
          { tipeSoal: s.tipeSoal, bobot: s.bobot },
          usbuFormat,
        );

        if (!quotaCheck.allowed) {
          return NextResponse.json(
            {
              error: quotaCheck.reason || "Kuota soal sesuai panduan sudah penuh",
              quotaFull: true,
            },
            { status: 400 },
          );
        }

        const nextBobot =
          quotaCheck.suggestedBobot !== undefined ? quotaCheck.suggestedBobot : s.bobot;
        if (
          quotaCheck.suggestedBobot !== undefined &&
          Math.abs(quotaCheck.suggestedBobot - s.bobot) >= 0.01
        ) {
          autoBobotUpdates.push({ id: s.id, bobot: quotaCheck.suggestedBobot });
        }

        // Tambahkan ke simulasi list agar pengecekan soal berikutnya akurat
        curAssigned.push({
          id: s.id,
          tipeSoal: s.tipeSoal,
          bobot: nextBobot,
          bulanKe: s.bulanKe,
        });
      }
    }

    await prisma.$transaction([
      prisma.soalUsbuAssignment.createMany({
        data: toInsertIds.map((soalId: string) => ({
          soalId,
          usbuKe: usbuFormat,
        })),
        skipDuplicates: true,
      }),
      ...autoBobotUpdates.map((u) =>
        prisma.bankSoalUsbu.update({
          where: { id: u.id },
          data: { bobot: u.bobot },
        }),
      ),
    ]);

    return NextResponse.json({
      success: true,
      inserted: toInsertIds.length,
      autoBobotApplied: autoBobotUpdates,
    });
  } catch (error: unknown) {
    console.error("POST Assign Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal assign soal" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await checkPermission("ujian_usbu"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { soalIds, usbuKe } = await req.json();

    if (!Array.isArray(soalIds) || !usbuKe) {
      return NextResponse.json(
        { error: "soalIds dan usbuKe diperlukan" },
        { status: 400 },
      );
    }

    await prisma.soalUsbuAssignment.deleteMany({
      where: {
        soalId: { in: soalIds },
        usbuKe: Number(usbuKe),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE Assign Error:", error);
    return NextResponse.json(
      { error: "Gagal unassign soal" },
      { status: 500 },
    );
  }
}
