import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMasterSantriList } from "@/lib/santri-api";
import { lembagaFromProgramKategori, type LembagaId } from "@/lib/lembaga";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dari = searchParams.get("dari");
    const sampai = searchParams.get("sampai");
    const kelompokId = searchParams.get("kelompokId");
    const lembagaParam = searchParams.get("lembaga");
    const lembagaFilter: LembagaId | null =
    lembagaParam === "TURATS" || lembagaParam === "HUFADZ" || lembagaParam === "ARABIYAH" ? lembagaParam : null;


    const dateFilter: any = {};
    if (dari) dateFilter.gte = new Date(`${dari}T00:00:00Z`);
    if (sampai) dateFilter.lte = new Date(`${sampai}T23:59:59Z`);
    const tanggalWhere = Object.keys(dateFilter).length > 0 ? { tanggal: dateFilter } : {};

    const whereClause: any = {
      ...tanggalWhere,
    };
    if (kelompokId) {
      whereClause.kelompokId = kelompokId;
    }

    const records = await prisma.absenTabirot.findMany({
      where: whereClause,
      include: {
        santri: {
          select: {
            id: true,
            nama: true,
          }
        },
        kelompok: {
          select: {
            id: true,
            tempat: true,
            bulanKe: true,
          }
        }
      }
    });

    // Filter lembaga (hanya bila param valid): petakan santri -> program aktifnya.
    // Tanpa param, perilaku tidak berubah (semua rekaman tetap dihitung).
    let lembagaSantriIds: Set<string> | null = null;
    if (lembagaFilter) {
      const masterSantriList = await getMasterSantriList();
      const dufahBySantri = new Map<string, string>();
      for (const ms of masterSantriList) {
        dufahBySantri.set(ms.id, ms.dufahNama);
      }
      const santriIds = [...new Set(records.map((r) => r.santriId))];
      const riwayatList = await prisma.riwayatSantri.findMany({
        where: { santriId: { in: santriIds } },
        select: { santriId: true, dufahNama: true, program: { select: { kategori: true } } },
      });
      const lembagaBySantri = new Map<string, string>();
      for (const rw of riwayatList) {
        const dufahAktif = dufahBySantri.get(rw.santriId);
        if (dufahAktif && rw.dufahNama === dufahAktif) {
          lembagaBySantri.set(rw.santriId, lembagaFromProgramKategori(rw.program?.kategori));
        }
      }
      lembagaSantriIds = new Set(
        [...lembagaBySantri.entries()].filter(([, l]) => l === lembagaFilter).map(([id]) => id)
      );
    }

    const recapMap = new Map<string, any>();
    for (const record of records) {
      if (lembagaSantriIds && !lembagaSantriIds.has(record.santriId)) continue;
      const key = `${record.santriId}_${record.kelompokId}`;
      if (!recapMap.has(key)) {
        recapMap.set(key, {
          santriId: record.santriId,
          santriNama: record.santri?.nama || "Tanpa Nama",
          kelompokId: record.kelompokId,
          tempat: record.kelompok.tempat,
          bulanKe: record.kelompok.bulanKe,
          HADIR: 0,
          IZIN: 0,
          SAKIT: 0,
          ALPHA: 0,
        });
      }
      
      const req = recapMap.get(key);
      if (record.status) {
        req[record.status] = (req[record.status] || 0) + 1;
      }
    }

    const results = Array.from(recapMap.values());
    results.sort((a,b) => a.santriNama.localeCompare(b.santriNama));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to fetch rekap tabirot", error);
    return NextResponse.json({ error: "Gagal memuat data rekap" }, { status: 500 });
  }
}
