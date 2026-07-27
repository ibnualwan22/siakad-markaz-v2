import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseWibDateString, getActiveRiwayatListForAbsen } from "@/lib/absensi";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const sesi = await prisma.sesiAbsenKegiatan.findUnique({
    where: { id },
    include: { kategori: true, lokasiList: { include: { lokasi: true } } }
  });
  if (!sesi) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get total santri active
  const santriList = await getActiveRiwayatListForAbsen();
  const santriMap = new Map(santriList.map(s => [s.riwayatId, s]));

  // Get who already checked in
  const today = new Date(sesi.createdAt);
  today.setHours(0,0,0,0);
  const absenHadir = await prisma.absenKegiatan.findMany({
    where: { kategoriId: sesi.kategoriId, tanggal: today, status: "HADIR" },
    select: { riwayatId: true }
  });

  const sudahAbsenArr = absenHadir.map(a => santriMap.get(a.riwayatId)).filter(x => x);

  return NextResponse.json({
    ...sesi,
    sudahAbsen: sudahAbsenArr,
    totalSantriAktif: santriList.length
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sesi = await prisma.sesiAbsenKegiatan.findUnique({ where: { id } });
    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    if (sesi.isClosed) return NextResponse.json({ error: "Sesi sudah ditutup" }, { status: 400 });

    const updated = await prisma.sesiAbsenKegiatan.update({
      where: { id },
      data: { isClosed: true, ditutupPada: new Date() }
    });

    // AUTO-ALPHA LOGIC
    const santriList = await getActiveRiwayatListForAbsen();
    const santriIds = santriList.map(s => s.riwayatId);
    const today = new Date(sesi.createdAt);
    today.setHours(0,0,0,0);

    // Get active tasrih today
    const currentActiveIzin = await prisma.perizinan.findMany({
      where: {
        riwayatId: { in: santriIds },
        statusIzin: "AKTIF",
        OR: [
          { tipeIzin: { notIn: ["HARIAN", "KELUAR_PARE"] }, tanggalMulai: { lte: today }, tanggalSelesai: { gte: today } },
          { tipeIzin: "KELUAR_PARE", tanggalMulai: { lte: today } }
        ]
      },
      select: { riwayatId: true, statusAbsen: true }
    });
    
    // Also include tasrih HARIAN for today
    const harianIzin = await prisma.perizinan.findMany({
      where: {
        riwayatId: { in: santriIds },
        statusIzin: "AKTIF",
        tipeIzin: "HARIAN",
        tanggalMulai: today
      },
      select: { riwayatId: true, statusAbsen: true }
    });

    const izinMap = new Map<string, string>();
    for (const i of currentActiveIzin) izinMap.set(i.riwayatId, i.statusAbsen || "IZIN");
    for (const i of harianIzin) izinMap.set(i.riwayatId, i.statusAbsen || "IZIN");

    // Get who already checked in
    const absenHadir = await prisma.absenKegiatan.findMany({
      where: { kategoriId: sesi.kategoriId, tanggal: today },
      select: { riwayatId: true }
    });
    const sudahAbsenSet = new Set(absenHadir.map(a => a.riwayatId));

    const operations = [];
    for (const santri of santriList) {
      if (!sudahAbsenSet.has(santri.riwayatId)) {
        // If not checked in, check if has tasrih, if not -> ALPHA
        const fallbackStatus = izinMap.get(santri.riwayatId) || "ALPHA";
        operations.push(
          prisma.absenKegiatan.upsert({
            where: {
              riwayatId_kategoriId_tanggal: {
                riwayatId: santri.riwayatId,
                kategoriId: sesi.kategoriId,
                tanggal: today
              }
            },
            update: {},
            create: {
              riwayatId: santri.riwayatId,
              kategoriId: sesi.kategoriId,
              tanggal: today,
              status: fallbackStatus as any,
              keterangan: fallbackStatus !== "ALPHA" ? 'Auto ' + fallbackStatus : 'Auto ALPHA ditutup'
            }
          })
        );
      }
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    return NextResponse.json({ success: true, sesi: updated, totalAutoFilled: operations.length });
  } catch (error) {
    console.error("PATCH sesi error", error);
    return NextResponse.json({ error: "Gagal menutup sesi" }, { status: 500 });
  }
}
