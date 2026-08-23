import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveRiwayatListForAbsen } from "@/lib/absensi";
import { parseWibDateString } from "@/lib/jadwal-sesi";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tanggal = searchParams.get("tanggal");
  const sakan = searchParams.get("sakan") || "ALL";

  if (!tanggal) {
    return NextResponse.json({ error: "Tanggal harus diisi" }, { status: 400 });
  }

  const parsedDate = parseWibDateString(tanggal);
  const santriList = await getActiveRiwayatListForAbsen(undefined, sakan);
  const santriIds = santriList.map((s) => s.riwayatId);

  const existingAbsen = await prisma.absenSakan.findMany({
    where: {
      tanggal: parsedDate,
      riwayatId: { in: santriIds },
    },
  });

  // --- AUTO-JIT IZIN LOGIC FOR GET --- //
  const dateZero = new Date(parsedDate);
  dateZero.setHours(0,0,0,0);
  
  const activeIzinRecords = await prisma.perizinan.findMany({
    where: {
      riwayatId: { in: santriIds },
      statusIzin: "AKTIF",
      OR: [
        { tipeIzin: { notIn: ["HARIAN", "KELUAR_PARE"] }, tanggalMulai: { lte: dateZero }, tanggalSelesai: { gte: dateZero } },
        { tipeIzin: "KELUAR_PARE", tanggalMulai: { lte: dateZero } }
      ]
    },
    select: { riwayatId: true, statusAbsen: true, nomorTasrih: true }
  });

  const izinMap = new Map<string, any>();
  for (const i of activeIzinRecords) {
    izinMap.set(i.riwayatId, { status: i.statusAbsen || "IZIN", tasrih: i.nomorTasrih });
  }

  const enhancedAbsen = [...existingAbsen];
  for (const s of santriList) {
    const existing = enhancedAbsen.find(x => x.riwayatId === s.riwayatId);
    if ((!existing || existing.status === "ALPHA") && izinMap.has(s.riwayatId)) {
      const activeIzin = izinMap.get(s.riwayatId);
      if (!existing) {
        enhancedAbsen.push({
          riwayatId: s.riwayatId,
          tanggal: parsedDate,
          status: activeIzin.status,
          keterangan: `Auto ${activeIzin.status} [${activeIzin.tasrih}]`
        } as any);
      } else {
        existing.status = activeIzin.status;
        existing.keterangan = (existing.keterangan ? existing.keterangan + " | " : "") + `Auto ${activeIzin.status} [${activeIzin.tasrih}]`;
      }
    }
  }

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const unconfirmedIzin = await prisma.perizinan.findMany({
    where: {
      riwayatId: { in: santriIds },
      statusIzin: "AKTIF",
      tipeIzin: { not: "HARIAN" },
      OR: [
        { tanggalSelesai: { lt: today } },
        { tipeIzin: "KELUAR_PARE", tanggalMulai: { lt: today } }
      ]
    }
  });

  const unconfirmedIds = unconfirmedIzin.map((u: any) => u.riwayatId);

  return NextResponse.json({
    santriList,
    absenData: enhancedAbsen,
    unconfirmedIds,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { tanggal, absenList } = payload as { 
      tanggal: string, 
      absenList: { riwayatId: string, status: any, keterangan?: string }[] 
    };

    if (!tanggal || !absenList || !Array.isArray(absenList)) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const parsedDate = parseWibDateString(tanggal);

    // --- AUTO-JIT IZIN LOGIC FOR POST --- //
    const santriIds = absenList.map((a: any) => a.riwayatId);
    const dateZero = new Date(parsedDate);
    dateZero.setHours(0,0,0,0);
    
    const activeIzinRecords = await prisma.perizinan.findMany({
      where: {
        riwayatId: { in: santriIds },
        statusIzin: "AKTIF",
        OR: [
          { tipeIzin: { notIn: ["HARIAN", "KELUAR_PARE"] }, tanggalMulai: { lte: dateZero }, tanggalSelesai: { gte: dateZero } },
          { tipeIzin: "KELUAR_PARE", tanggalMulai: { lte: dateZero } }
        ]
      },
      select: { riwayatId: true, statusAbsen: true, nomorTasrih: true }
    });

    const izinMap = new Map<string, any>();
    for (const i of activeIzinRecords) {
      izinMap.set(i.riwayatId, { status: i.statusAbsen || "IZIN", tasrih: i.nomorTasrih });
    }

    const modifiedAbsenList = absenList.map((absen: any) => {
      if (absen.status === "KOSONG") return absen; // Langsung pass jika admin eksplisit minta KOSONG

      const activeIzin = izinMap.get(absen.riwayatId);
      // Jika disubmit sebagai ALPHA/kosong, tapi dia punya Izin aktif, otomatis inject IZIN
      if ((absen.status === "ALPHA" || !absen.status) && activeIzin) {
        return {
          ...absen,
          status: activeIzin.status,
          keterangan: (absen.keterangan ? absen.keterangan + " | " : "") + `Auto ${activeIzin.status} [${activeIzin.tasrih}]`
        };
      }
      return absen;
    });

    const toUpsert = modifiedAbsenList.filter((a: any) => a.status !== "KOSONG");
    const toDelete = modifiedAbsenList.filter((a: any) => a.status === "KOSONG");

    // Upsert each using transaction
    const operations: any[] = toUpsert.map((absen: any) =>
      prisma.absenSakan.upsert({
        where: {
          riwayatId_tanggal: {
            riwayatId: absen.riwayatId,
            tanggal: parsedDate,
          },
        },
        update: {
          status: absen.status,
          keterangan: absen.keterangan || null,
        },
        create: {
          riwayatId: absen.riwayatId,
          tanggal: parsedDate,
          status: absen.status,
          keterangan: absen.keterangan || null,
        },
      })
    );

    if (toDelete.length > 0) {
      operations.push(
        prisma.absenSakan.deleteMany({
          where: {
            tanggal: parsedDate,
            riwayatId: { in: toDelete.map((d: any) => d.riwayatId) }
          }
        })
      );
    }

    await prisma.$transaction(operations);

    return NextResponse.json({ success: true, count: operations.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal menyimpan absensi" }, { status: 500 });
  }
}
