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
        select: { dufahNama: true, program: { select: { nama_indo: true } } },
      },
    },
  });
  if (!santri) return NextResponse.json({ error: "Santri tidak ditemukan" }, { status: 404 });

  const riwayatAktif = santri.riwayatRecords.find((r) => r.dufahNama === santri.dufahNama);
  const isHufadz = (riwayatAktif?.program?.nama_indo || "").toLowerCase().includes("hufadz");
  if (!isHufadz) {
    return NextResponse.json({ isHufadz: false, total: 0, terakhir: null, items: [] });
  }

  const rows = await prisma.huffadzTasmi.findMany({
    where: { santriId: session.santriId },
    orderBy: { waktuSubmit: "desc" },
  });

  const items = rows.map((r) => ({
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
    rataRata: Math.round((r.nilaiTahfidz + r.nilaiTahsin + r.nilaiTartil + r.nilaiAdab) / 4),
    catatan: r.catatan,
  }));

  return NextResponse.json({
    isHufadz: true,
    total: items.length,
    terakhir: items.length > 0 ? items[0] : null,
    items,
  });
}
