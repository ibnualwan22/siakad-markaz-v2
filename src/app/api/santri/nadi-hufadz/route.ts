import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { NADI_HUFADZ_MIN_HADIR } from "@/lib/nadi-hufadz";

export const dynamic = "force-dynamic";

// Riwayat Nadi Hufadz milik santri yang login (semua dufah, read-only)
export async function GET() {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const riwayat = await prisma.nadiHufadzPeserta.findMany({
    where: { santriId: session.santriId },
    include: {
      setoran: {
        orderBy: { pertemuanKe: "asc" },
        include: { penyimak: { select: { nama: true } } },
      },
      tasmi: { include: { penguji: { select: { nama: true } } } },
    },
    orderBy: { dufahNama: "desc" },
  });

  const data = riwayat.map((p) => ({
    id: p.id,
    dufahNama: p.dufahNama,
    tanggalDaftar: p.tanggalDaftar,
    kehadiran: p.setoran.length,
    eligibleTasmi: p.setoran.length >= NADI_HUFADZ_MIN_HADIR,
    setoran: p.setoran.map((s) => ({
      pertemuanKe: s.pertemuanKe,
      tanggal: s.tanggal,
      juz: s.juz,
      surat: s.surat,
      ayat: s.ayat,
      lulus: s.lulus,
      penyimak: s.penyimak?.nama || "-",
      catatan: s.catatan,
    })),
    tasmi: p.tasmi
      ? {
          juzTeks: p.tasmi.juzTeks,
          predikat: p.tasmi.predikat,
          tanggal: p.tasmi.tanggal,
          penguji: p.tasmi.penguji?.nama || "-",
        }
      : null,
  }));

  return NextResponse.json(data);
}
