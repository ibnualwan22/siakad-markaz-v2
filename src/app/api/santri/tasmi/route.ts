import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";

export const dynamic = "force-dynamic";

// Hasil Tasmi Huffadz milik santri yang login (read-only, tanpa filter)
export async function GET() {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Program aktif santri = riwayat pada dufah santri saat ini
  const santri = await prisma.santriInternal.findUnique({
    where: { id: session.santriId },
    select: {
      dufahNama: true,
      riwayatRecords: {
        select: { dufahNama: true, program: { select: { kategori: true } } },
      },
    },
  });
  if (!santri) return NextResponse.json({ error: "Santri tidak ditemukan" }, { status: 404 });

  const riwayatAktif = santri.riwayatRecords.find((r) => r.dufahNama === santri.dufahNama);
  const isHufadz = riwayatAktif?.program?.kategori === "HUFADZ";
  if (!isHufadz) {
    return NextResponse.json({ isHufadz: false, total: 0, terakhir: null, items: [] });
  }

  const rows = await prisma.huffadzTasmi.findMany({
    where: { santriId: session.santriId },
    orderBy: { waktuSubmit: "desc" },
  });

  // Rata-rata dari kolom yang terisi: rubrik baru (Nukhbah 2+) atau lama (Nukhbah 1).
  const items = rows.map((r) => {
    const baru = [r.nilaiHafalan, r.nilaiKelancaran, r.nilaiTajwid, r.nilaiMakhorijulHuruf];
    const lama = [r.nilaiTahfidz, r.nilaiTahsin, r.nilaiTartil, r.nilaiAdab];
    const pakai = baru.every((v) => v != null) ? baru : lama;
    return {
      id: r.id,
      tanggal: r.waktuSubmit,
      surahNama: r.surahNama,
      ayatDari: r.ayatDari,
      surahSampaiNama: r.surahSampaiNama,
      ayatSampai: r.ayatSampai,
      juz: r.juz,
      durasiMenit: r.durasiMenit,
      nilaiTahfidz: r.nilaiTahfidz,
      nilaiTahsin: r.nilaiTahsin,
      nilaiTartil: r.nilaiTartil,
      nilaiAdab: r.nilaiAdab,
      nilaiHafalan: r.nilaiHafalan,
      nilaiKelancaran: r.nilaiKelancaran,
      nilaiTajwid: r.nilaiTajwid,
      nilaiMakhorijulHuruf: r.nilaiMakhorijulHuruf,
      rataRata: Math.round(pakai.reduce<number>((a, b) => a + (b ?? 0), 0) / 4),
      catatan: r.catatan,
    };
  });

  return NextResponse.json({
    isHufadz: true,
    total: items.length,
    terakhir: items.length > 0 ? items[0] : null,
    items,
  });
}
