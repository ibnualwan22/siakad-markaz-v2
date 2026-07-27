import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseWibDateString } from "@/lib/absensi";
import { getMasterSantriList } from "@/lib/santri-api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dari = searchParams.get("dari");
  const sampai = searchParams.get("sampai");

  const dateFilter: any = {};
  if (dari) dateFilter.gte = new Date(`${dari}T00:00:00Z`);
  if (sampai) dateFilter.lte = new Date(`${sampai}T23:59:59Z`);

  const tanggalWhere = Object.keys(dateFilter).length > 0 ? { tanggal: dateFilter } : {};

  // Ambil santri aktif untuk validasi dufah
  const masterSantriList = await getMasterSantriList();
  const activeSantriMap = new Map<string, string>();
  for (const ms of masterSantriList) {
    if (ms.isAktif) {
      activeSantriMap.set(ms.id, ms.dufahNama);
    }
  }

  // Helper untuk filter riwayat aktif
  const isActiveRiwayat = (riwayat: { santriId: string; dufahNama: string }) => {
    const activeDufah = activeSantriMap.get(riwayat.santriId);
    return activeDufah && activeDufah === riwayat.dufahNama;
  };

  const riwayatSelect = { select: { santriId: true, dufahNama: true } };

  const hariLiburList = await prisma.hariLibur.findMany({
    where: tanggalWhere
  });
  const liburCount = hariLiburList.filter(h => h.isSemuaSesi).length;

  // --- Rekap Sakan ---
  const sakanRecords = await prisma.absenSakan.findMany({
    where: tanggalWhere,
    select: { status: true, tanggal: true, riwayat: riwayatSelect },
  });
  
  const sakanRekap: Record<string, number> = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 };
  for (const r of sakanRecords) {
    if (isActiveRiwayat(r.riwayat)) {
      const tgl = r.tanggal.toISOString().split("T")[0];
      const hl = hariLiburList.find(h => h.tanggal.toISOString().split("T")[0] === tgl);
      if (!(hl && hl.isSemuaSesi)) {
        if (r.status in sakanRekap) sakanRekap[r.status]++;
      }
    }
  }

  // --- Rekap Kelas ---
  const kelasRecords = await prisma.absenKelas.findMany({
    where: tanggalWhere,
    select: { status: true, sesi: true, tanggal: true, riwayat: riwayatSelect },
  });

  const kelasRekap: Record<string, number> = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 };
  for (const r of kelasRecords) {
    if (isActiveRiwayat(r.riwayat)) {
      const tgl = r.tanggal.toISOString().split("T")[0];
      const hl = hariLiburList.find(h => h.tanggal.toISOString().split("T")[0] === tgl);
      const sesiIsLibur = hl && (hl.isSemuaSesi || hl.sesiLibur.includes(r.sesi as any));
      if (!sesiIsLibur) {
        if (r.status in kelasRekap) kelasRekap[r.status]++;
      }
    }
  }

  // --- Rekap Kegiatan (per kategori) ---
  const kegiatanList = await prisma.kategoriKegiatan.findMany({
    orderBy: { nama: "asc" },
  });

  const kegiatanRecords = await prisma.absenKegiatan.findMany({
    where: tanggalWhere,
    select: { status: true, kategoriId: true, tanggal: true, riwayat: riwayatSelect },
  });

  const kegiatanRekap = kegiatanList.map((k) => {
    const counts: Record<string, number> = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 };
    for (const r of kegiatanRecords) {
      if (r.kategoriId === k.id && isActiveRiwayat(r.riwayat)) {
        const tgl = r.tanggal.toISOString().split("T")[0];
        const hl = hariLiburList.find(h => h.tanggal.toISOString().split("T")[0] === tgl);
        if (!(hl && hl.isSemuaSesi)) {
           if (r.status in counts) counts[r.status]++;
        }
      }
    }
    return {
      id: k.id,
      nama: k.nama,
      counts,
    };
  });

  return NextResponse.json({
    sakan: sakanRekap,
    kelas: kelasRekap,
    kegiatan: kegiatanRekap,
    liburCount,
  });
}
