import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMasterSantriList } from "@/lib/santri-api";

export async function GET() {
  try {
    // Hitung tanggal hari ini WIB
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibNow = new Date(now.getTime() + wibOffset);
    const todayStr = wibNow.toISOString().split("T")[0];

    // Ambil semua santri aktif dan kumpulkan sakan unik
    const masterSantriList = await getMasterSantriList();
    const allSakan = new Set<string>();
    const santriPerSakan = new Map<string, number>();

    for (const ms of masterSantriList) {
      if (ms.isAktif && !ms.isCheckedOut && ms.sakan && ms.sakan !== "-") {
        allSakan.add(ms.sakan);
        santriPerSakan.set(ms.sakan, (santriPerSakan.get(ms.sakan) || 0) + 1);
      }
    }

    // Cek AbsenSakan hari ini — sakan mana yang sudah ada record-nya
    const todayAbsen = await prisma.absenSakan.findMany({
      where: {
        tanggal: new Date(`${todayStr}T00:00:00Z`),
      },
      select: {
        riwayat: {
          select: {
            santriId: true,
            dufahNama: true,
          },
        },
      },
    });

    // Map ke sakan name via master data
    const activeSantriMap = new Map<string, string>();
    for (const ms of masterSantriList) {
      if (ms.isAktif && !ms.isCheckedOut) {
        activeSantriMap.set(ms.id, ms.dufahNama);
      }
    }

    const sakanSudahAbsen = new Set<string>();
    for (const record of todayAbsen) {
      const activeDufah = activeSantriMap.get(record.riwayat.santriId);
      if (activeDufah && activeDufah === record.riwayat.dufahNama) {
        const ms = masterSantriList.find(m => m.id === record.riwayat.santriId);
        if (ms && ms.sakan && ms.sakan !== "-") {
          sakanSudahAbsen.add(ms.sakan);
        }
      }
    }

    const belumAbsen = Array.from(allSakan).filter(s => !sakanSudahAbsen.has(s)).sort();
    const sudahAbsen = Array.from(sakanSudahAbsen).sort();

    return NextResponse.json({
      tanggal: todayStr,
      totalSakan: allSakan.size,
      belumAbsen,
      sudahAbsen,
    });
  } catch (error) {
    console.error("Error sakan-status:", error);
    return NextResponse.json({ error: "Terjadi kesalahan sistem" }, { status: 500 });
  }
}
