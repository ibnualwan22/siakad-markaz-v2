import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseWibDateString } from "@/lib/absensi";
import { getMasterSantriList } from "@/lib/santri-api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "sakan", "kelas", "kegiatan"
    const kategoriId = searchParams.get("kategoriId"); // required if type === "kegiatan"
    const dari = searchParams.get("dari");
    const sampai = searchParams.get("sampai");

    if (!type || !["sakan", "kelas", "kegiatan"].includes(type)) {
      return NextResponse.json({ error: "Tipe rekap tidak valid" }, { status: 400 });
    }

    const dateFilter: any = {};
    if (dari) dateFilter.gte = new Date(`${dari}T00:00:00Z`);
    if (sampai) dateFilter.lte = new Date(`${sampai}T23:59:59Z`);
    const tanggalWhere = Object.keys(dateFilter).length > 0 ? { tanggal: dateFilter } : {};

    let records: any[] = [];

    // Helper untuk select relasi
    const riwayatInclude = {
      riwayat: {
        include: {
          santri: true,
          kelas: { select: { nama: true } },
          program: { select: { nama_indo: true } },
        }
      }
    };

    if (type === "sakan") {
      records = await prisma.absenSakan.findMany({
        where: tanggalWhere,
        include: riwayatInclude,
      });
    } else if (type === "kelas") {
      const kelasIdFilter = searchParams.get("kelasId");
      records = await prisma.absenKelas.findMany({
        where: {
          ...tanggalWhere,
          ...(kelasIdFilter ? { riwayat: { kelasId: kelasIdFilter } } : {}),
        },
        include: riwayatInclude,
      });
    } else if (type === "kegiatan") {
      const kegWhere = kategoriId ? { ...tanggalWhere, kategoriId: kategoriId as string } : tanggalWhere;
      records = await prisma.absenKegiatan.findMany({
        where: kegWhere,
        include: {
          ...riwayatInclude,
          kategori: { select: { nama: true } }
        },
      });
    }

    // Ambil hari libur dalam rentang tanggal
    const hariLiburList = await prisma.hariLibur.findMany({ where: tanggalWhere });

    // Ambil master santri untuk filter hanya riwayat aktif
    const masterSantriList = await getMasterSantriList();
    const activeSantriMap = new Map<string, string>();
    for (const ms of masterSantriList) {
      if (ms.isAktif && !ms.isCheckedOut) {
        activeSantriMap.set(ms.id, ms.dufahNama);
      }
    }

    // Ambil data Dufah untuk mengetahui batas Usbu'
    const dufahList = await prisma.dufah.findMany();
    const dufahMap = new Map<string, any>();
    for (const d of dufahList) {
      dufahMap.set(d.nama, d);
    }

    // Filter output: Hanya yang dufah-nya sama dengan active dufah
    const filteredRecords = records.filter(r => {
      const activeDufah = activeSantriMap.get(r.riwayat.santriId);
      return activeDufah && activeDufah === r.riwayat.dufahNama;
    });

    const result = filteredRecords.map((r) => {
      const ms = masterSantriList.find(m => m.id === r.riwayat.santriId);
      
      // Fix timezone offset (Prisma UTC vs WIB literal)
      const tanggalStr = r.tanggal.toISOString().split("T")[0];

      // Tentukan Usbu'
      let usbuLabel = "Tidak terjadwal";
      const df = dufahMap.get(r.riwayat.dufahNama);
      if (df) {
        const tTime = r.tanggal.getTime();

        const u1Start = df.usbu1StartDate ? new Date(df.usbu1StartDate).getTime() : 0;
        const u1End = df.usbu1EndDate ? new Date(df.usbu1EndDate).getTime() + 86399999 : Infinity;
        const u2Start = df.usbu2StartDate ? new Date(df.usbu2StartDate).getTime() : 0;
        const u2End = df.usbu2EndDate ? new Date(df.usbu2EndDate).getTime() + 86399999 : Infinity;
        const u3Start = df.usbu3StartDate ? new Date(df.usbu3StartDate).getTime() : 0;
        const u3End = df.usbu3EndDate ? new Date(df.usbu3EndDate).getTime() + 86399999 : Infinity;

        if (!df.usbu1StartDate && !df.usbu2StartDate && !df.usbu3StartDate) {
          // Backward compatibility: old data only had EnDates boundary
          if (tTime <= u1End) usbuLabel = "Usbu' 1";
          else if (tTime <= u2End) usbuLabel = "Usbu' 2";
          else usbuLabel = "Nihai";
        } else {
          // Advanced Usbu Architecture ranges
          if (tTime >= u1Start && tTime <= u1End) usbuLabel = "Usbu' 1";
          else if (tTime >= u2Start && tTime <= u2End) usbuLabel = "Usbu' 2";
          else if (tTime >= u3Start && tTime <= u3End) usbuLabel = "Nihai";
          else usbuLabel = "Di Luar Usbu'";
        }
      }

      let isLibur = false;
      const hl = hariLiburList.find(h => h.tanggal.toISOString().split("T")[0] === tanggalStr);
      if (hl) {
        if (hl.isSemuaSesi) isLibur = true;
        else if (r.sesi && hl.sesiLibur.includes(r.sesi)) isLibur = true;
      }

      return {
        id: r.id,
        riwayatId: r.riwayatId,
        namaSantri: ms ? ms.nama : (r.riwayat.santri?.nama || "Tanpa Nama"),
        sakan: ms ? ms.sakan : "-",
        kelas: r.riwayat.kelas?.nama || r.riwayat.program?.nama_indo || "-",
        sesi: r.sesi || null,
        kategoriId: r.kategoriId || null,
        kegiatanNama: r.kategori?.nama || null,
        status: r.status,
        keterangan: r.keterangan || "-",
        tanggal: tanggalStr,
        usbu: usbuLabel,
        isLibur,
      };
    });

    // Urutkan berdasarkan nama
    result.sort((a, b) => a.namaSantri.localeCompare(b.namaSantri));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error detail rekap:", error);
    return NextResponse.json({ error: "Terjadi kesalahan sistem" }, { status: 500 });
  }
}
