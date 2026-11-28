import prisma from "@/lib/prisma";

export { getTodayWibString, parseWibDateString } from "./jadwal-sesi";

/**
 * Mendapatkan nama Dufah yang sedang aktif.
 * Sekarang dibaca dari database lokal (SantriInternal) — TIDAK menembak API PPDB.
 */
export async function getActiveDufahName(): Promise<string | null> {
  // Hitung dinamis dari data santri aktif di database lokal
  const activeSantri = await prisma.santriInternal.findMany({
    where: {
      isAktif: true,
      dufahNama: { not: null },
      sakan: { not: "-" },
    },
    select: { dufahNama: true },
  });

  const dufahCounts = new Map<string, number>();
  for (const s of activeSantri) {
    if (s.dufahNama && s.dufahNama !== "-") {
      dufahCounts.set(s.dufahNama, (dufahCounts.get(s.dufahNama) || 0) + 1);
    }
  }

  if (dufahCounts.size === 0) return null;

  // Dufah dengan santri aktif terbanyak = Dufah aktif saat ini
  const sorted = Array.from(dufahCounts.entries()).sort((a, b) => {
    const countDiff = b[1] - a[1];
    if (countDiff !== 0) return countDiff;
    return b[0].localeCompare(a[0], undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  return sorted[0][0];
}

/**
 * Mendapatkan status bulan aktif program Akbarnas (1 atau 2) berdasarkan Dufah berjalan.
 * Seluruh kelas Akbarnas selalu berada di bulan yang sama (tidak ada pembeda per kelas).
 */
export async function getActiveAkbarnasBulan(): Promise<{
  dufahNama: string | null;
  akbarnasBulan: 1 | 2;
}> {
  const activeDufahName = await getActiveDufahName();
  if (!activeDufahName) {
    return { dufahNama: null, akbarnasBulan: 2 };
  }
  const dufah = await prisma.dufah.findUnique({
    where: { nama: activeDufahName },
    select: { akbarnasBulan: true },
  });
  return {
    dufahNama: activeDufahName,
    akbarnasBulan: dufah?.akbarnasBulan === 1 ? 1 : 2,
  };
}

export type SantriAbsenTarget = {
  riwayatId: string;
  santriId: string;
  nama: string;
  sakan: string;
  kamar: string;
  gender: string;
  kategori: string;
  kelasId: string | null;
  kelasNama: string | null;
  programId: string | null;
  programNama: string | null;
  isCheckedOut: boolean;
};

/**
 * Mendapatkan daftar riwayat aktif untuk dilakukan absensi.
 * Sekarang MURNI dari database lokal — TIDAK ada API call.
 */
export async function getActiveRiwayatListForAbsen(
  filterKelasId?: string,
  filterSakan?: string
): Promise<SantriAbsenTarget[]> {
  // Ambil data santri aktif dari database lokal
  const activeSantriList = await prisma.santriInternal.findMany({
    where: {
      isAktif: true,
      dufahNama: { not: null },
      sakan: { not: "-" },
    },
  });

  const activeSantriMap = new Map<string, typeof activeSantriList[0]>();
  for (const s of activeSantriList) {
    if (s.dufahNama && s.dufahNama !== "-") {
      activeSantriMap.set(s.id, s);
    }
  }

  // Gunakan Prisma untuk mendapatkan data riwayat
  const whereClause: any = {};
  if (
    filterKelasId &&
    filterKelasId !== "ALL" &&
    filterKelasId !== "UNASSIGNED"
  ) {
    if (filterKelasId.startsWith("PROGRAM_")) {
      whereClause.programId = filterKelasId.replace("PROGRAM_", "");
    } else {
      whereClause.kelasId = filterKelasId;
    }
  } else if (filterKelasId === "UNASSIGNED") {
    whereClause.programId = null;
  }

  const allRiwayatList = await prisma.riwayatSantri.findMany({
    where: whereClause,
    include: {
      santri: true,
      kelas: true,
      program: true,
    },
  });

  // Filter HANYA riwayat yang dufah-nya sama dengan dufah santri yang isAktif
  const activeRiwayatList = allRiwayatList.filter((r) => {
    const activeSantri = activeSantriMap.get(r.santriId);
    return activeSantri && activeSantri.dufahNama === r.dufahNama;
  });

  let mappedList = activeRiwayatList.map((r) => {
    const s = activeSantriMap.get(r.santriId);
    return {
      riwayatId: r.id,
      santriId: r.santriId,
      nama: s?.nama ?? r.santri?.nama ?? "Tanpa Nama",
      sakan: s?.sakan ?? "-",
      kamar: s?.kamar ?? "-",
      gender: s?.gender ?? "-",
      kategori: s?.kategori ?? "-",
      kelasId: r.kelasId,
      kelasNama: r.kelas?.nama ?? null,
      programId: r.programId,
      programNama: r.program?.nama_indo ?? null,
      isCheckedOut: s?.isCheckedOut ?? false,
    };
  });

  if (filterSakan && filterSakan !== "ALL") {
    mappedList = mappedList.filter((s) => s.sakan === filterSakan);
  }

  return mappedList.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}
