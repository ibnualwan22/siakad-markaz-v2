import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPermission } from "@/lib/permission";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const hasPermission = await checkPermission("martabah_ula");
  if (!session || !hasPermission) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const riwayatId = searchParams.get("riwayatId");

  if (!riwayatId) {
    return NextResponse.json({ error: "riwayatId is required" }, { status: 400 });
  }

  // Cari apakah sudah ada
  const existing = await prisma.syahadahCacRecord.findUnique({
    where: { riwayatId }
  });

  if (existing) {
    return NextResponse.json({ serialNumber: existing.serialNumber });
  }

  // Jika belum, buat baru dengan tahun secara spesifik (2026 atau tahun saat ini)
  const templateConfig = await prisma.syahadahTemplate.findFirst({ orderBy: { id: "asc" } });

  // Extra logic to use year from settings if possible, else 2026 as user requested "2026 adalah tahun cetak". Let's parse from template if mapped, or default to current date. The user mentioned: "2026 adalah tahun cetak dan 0001 adalah syahadah keberapa dicetak". If template config is 2026, we extract it.
  let tahunCetak = new Date().getFullYear();
  if (templateConfig?.tgl_cetak_indo) {
    const match = templateConfig.tgl_cetak_indo.match(/\d{4}/);
    if (match) tahunCetak = parseInt(match[0], 10);
  }

  // Use lock transaction to get proper sequential next urutan under high concurrency
  const newRecord = await prisma.$transaction(async (tx) => {
    // Check again inside transaction to prevent race conditions
    const checkEx = await tx.syahadahCacRecord.findUnique({ where: { riwayatId } });
    if (checkEx) return checkEx;

    const lastRecord = await tx.syahadahCacRecord.findFirst({
      where: { tahunCetak },
      orderBy: { urutan: 'desc' }
    });

    const nextUrutan = lastRecord ? lastRecord.urutan + 1 : 1;
    const serialNumber = `No.:C.AC/MA/${tahunCetak}/${String(nextUrutan).padStart(4, '0')}`;

    return tx.syahadahCacRecord.create({
      data: {
        riwayatId,
        serialNumber,
        tahunCetak,
        urutan: nextUrutan
      }
    });
  });

  return NextResponse.json({ serialNumber: newRecord.serialNumber });
}
