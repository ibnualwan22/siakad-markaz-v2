import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { getActiveDufahName } from "@/lib/absensi";
import { NADI_HUFADZ_MIN_HADIR } from "@/lib/nadi-hufadz";

export const dynamic = "force-dynamic";

// Riwayat Nadi Hufadz milik santri yang login (semua dufah) +
// status pendaftaran dufah aktif (untuk tombol daftar / kotak tutup).
export async function GET() {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dufahAktif = (await getActiveDufahName()) || "";
  const periode = dufahAktif
    ? await prisma.nadiHufadzPeriode.findUnique({ where: { dufahNama: dufahAktif } })
    : null;

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

  return NextResponse.json({
    riwayat: data,
    dufahAktif,
    pendaftaranDibuka: periode?.dibuka ?? false,
    sudahDaftar: dufahAktif ? data.some((r) => r.dufahNama === dufahAktif) : false,
  });
}

// POST — daftar mandiri ke Nadi Hufadz dufah aktif.
// Menutup hanya menghalangi pendaftar baru; peserta lama tidak terpengaruh.
export async function POST() {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dufahAktif = (await getActiveDufahName()) || "";
  if (!dufahAktif) {
    return NextResponse.json({ error: "Dufah aktif tidak ditemukan" }, { status: 400 });
  }

  const periode = await prisma.nadiHufadzPeriode.findUnique({
    where: { dufahNama: dufahAktif },
  });
  if (!periode?.dibuka) {
    return NextResponse.json(
      { error: `Pendaftaran Nadi Hufadz ${dufahAktif} sudah ditutup. Silahkan tunggu pendaftaran di duf'ah berikutnya.` },
      { status: 403 }
    );
  }

  const peserta = await prisma.nadiHufadzPeserta.upsert({
    where: { santriId_dufahNama: { santriId: session.santriId, dufahNama: dufahAktif } },
    update: {},
    create: { santriId: session.santriId, dufahNama: dufahAktif },
  });

  return NextResponse.json({ ok: true, peserta });
}
