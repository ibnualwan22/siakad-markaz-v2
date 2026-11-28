import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getActiveAkbarnasBulan } from "@/lib/absensi";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const meta = searchParams.get("meta");

    // Mode ringan: kembalikan daftar (programId|mapelId) yang masuk regulasi PDF ATAU sudah punya soal CBT
    // Khusus Akbarnas, otomatis mengikuti bulan aktif (akbarnasBulan) pada Dufah berjalan
    if (meta === "cbt-mapels") {
      const [{ dufahNama: activeDufah, akbarnasBulan }, akbarnasProg, regPairs, soalPairs] =
        await Promise.all([
          getActiveAkbarnasBulan(),
          prisma.program.findFirst({
            where: { nama_indo: { contains: "Akbarnas", mode: "insensitive" } },
            select: { id: true },
          }),
          prisma.regulasiSoalUsbu.findMany({
            select: { programId: true, mapelId: true, bulanKe: true },
            distinct: ["programId", "mapelId", "bulanKe"],
          }),
          prisma.bankSoalUsbu.groupBy({
            by: ["programId", "mapelId"],
          }),
        ]);

      const keySet = new Set<string>();
      const progSet = new Set<string>();
      for (const r of regPairs) {
        if (akbarnasProg && r.programId === akbarnasProg.id && r.bulanKe !== akbarnasBulan) {
          continue;
        }
        keySet.add(`${r.programId}|${r.mapelId}`);
        progSet.add(r.programId);
      }
      for (const s of soalPairs) {
        // Khusus Akbarnas, mapel yang tampil ketat mengikuti panduan bulan aktif
        if (akbarnasProg && s.programId === akbarnasProg.id) {
          continue;
        }
        keySet.add(`${s.programId}|${s.mapelId}`);
        progSet.add(s.programId);
      }

      return NextResponse.json({
        allowedKeys: Array.from(keySet),
        allowedProgramIds: Array.from(progSet),
        akbarnasBulan,
        activeDufah,
      });
    }

    const programId = searchParams.get("programId");
    const mapelId = searchParams.get("mapelId");
    const bulanKe = searchParams.get("bulanKe");

    const where: Record<string, unknown> = {};
    if (programId) where.programId = programId;
    if (mapelId) where.mapelId = mapelId;
    if (bulanKe) where.bulanKe = Number(bulanKe);

    const rules = await prisma.regulasiSoalUsbu.findMany({
      where,
      include: {
        mapel: { select: { id: true, nama_indo: true } },
        program: { select: { id: true, nama_indo: true } },
      },
      orderBy: [{ mapelId: "asc" }, { bulanKe: "asc" }, { urutanQism: "asc" }],
    });

    return NextResponse.json({ rules });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat regulasi" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await checkPermission("ujian_usbu"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      programId,
      mapelId,
      bulanKe,
      urutanQism,
      tipeSoal,
      targetJumlah,
      targetBobot,
      catatan,
      usbuBerlaku,
    } = body;

    if (!programId || !mapelId || !tipeSoal || !targetJumlah || targetBobot === undefined) {
      return NextResponse.json(
        { error: "Data regulasi Qism tidak lengkap" },
        { status: 400 },
      );
    }

    const bKe = Number(bulanKe) || 1;
    let qOrder = Number(urutanQism);
    if (!qOrder) {
      const last = await prisma.regulasiSoalUsbu.findFirst({
        where: { programId, mapelId, bulanKe: bKe },
        orderBy: { urutanQism: "desc" },
        select: { urutanQism: true },
      });
      qOrder = (last?.urutanQism ?? 0) + 1;
    }

    const saved = await prisma.regulasiSoalUsbu.upsert({
      where: {
        programId_mapelId_bulanKe_urutanQism: {
          programId,
          mapelId,
          bulanKe: bKe,
          urutanQism: qOrder,
        },
      },
      update: {
        tipeSoal: String(tipeSoal),
        targetJumlah: Number(targetJumlah),
        targetBobot: Number(targetBobot),
        catatan: catatan ? String(catatan).trim() : null,
        usbuBerlaku: String(usbuBerlaku || "1,2"),
      },
      create: {
        programId,
        mapelId,
        bulanKe: bKe,
        urutanQism: qOrder,
        tipeSoal: String(tipeSoal),
        targetJumlah: Number(targetJumlah),
        targetBobot: Number(targetBobot),
        catatan: catatan ? String(catatan).trim() : null,
        usbuBerlaku: String(usbuBerlaku || "1,2"),
      },
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan regulasi" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await checkPermission("ujian_usbu"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Sinkronkan bobot soal-soal yang sudah dicentang di Usbu' 1 / 2 agar sesuai regulasi PDF
    if (body.action === "sync-bobot") {
      const { programId, mapelId, usbuKe, bulanKe } = body as {
        programId?: string;
        mapelId?: string;
        usbuKe?: number;
        bulanKe?: number;
      };
      if (!programId || !mapelId || (usbuKe !== 1 && usbuKe !== 2)) {
        return NextResponse.json(
          { error: "Sinkron bobot regulasi hanya berlaku untuk Usbu' 1 & 2" },
          { status: 400 },
        );
      }

      const bKe = Number(bulanKe) || 1;
      const rules = await prisma.regulasiSoalUsbu.findMany({
        where: { programId, mapelId, bulanKe: bKe },
        orderBy: { urutanQism: "asc" },
      });

      // Kelompokkan rules per tipeSoal
      const byType = new Map<string, typeof rules>();
      for (const r of rules) {
        const arr = byType.get(r.tipeSoal) || [];
        arr.push(r);
        byType.set(r.tipeSoal, arr);
      }

      let updatedCount = 0;
      const skippedDualTypes: string[] = [];

      for (const [tipe, list] of byType.entries()) {
        if (list.length === 1) {
          // Tipe unik dalam mapel ini -> aman langsung set bobot ke targetBobot
          const res = await prisma.bankSoalUsbu.updateMany({
            where: {
              programId,
              mapelId,
              tipeSoal: tipe,
              usbuAssignments: { some: { usbuKe } },
            },
            data: { bobot: list[0].targetBobot },
          });
          updatedCount += res.count;
        } else {
          skippedDualTypes.push(tipe);
        }
      }

      return NextResponse.json({
        success: true,
        updated: updatedCount,
        skippedDualTypes,
      });
    }

    const { id, urutanQism, tipeSoal, targetJumlah, targetBobot, catatan, usbuBerlaku } = body;
    if (!id) {
      return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 });
    }

    const updated = await prisma.regulasiSoalUsbu.update({
      where: { id },
      data: {
        ...(urutanQism !== undefined ? { urutanQism: Number(urutanQism) } : {}),
        ...(tipeSoal !== undefined ? { tipeSoal: String(tipeSoal) } : {}),
        ...(targetJumlah !== undefined ? { targetJumlah: Number(targetJumlah) } : {}),
        ...(targetBobot !== undefined ? { targetBobot: Number(targetBobot) } : {}),
        ...(catatan !== undefined ? { catatan: catatan ? String(catatan).trim() : null } : {}),
        ...(usbuBerlaku !== undefined ? { usbuBerlaku: String(usbuBerlaku) } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal update regulasi" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await checkPermission("ujian_usbu"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 });
    }

    await prisma.regulasiSoalUsbu.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus regulasi" },
      { status: 500 },
    );
  }
}
