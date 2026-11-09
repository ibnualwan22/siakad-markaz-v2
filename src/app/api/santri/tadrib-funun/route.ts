import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { getActiveDufahName } from "@/lib/absensi";
import { resolveTadribFununMinHadir } from "@/lib/tadrib-funun";

export const dynamic = "force-dynamic";

// Riwayat Tadrib Funun milik santri yang login (semua dufah) +
// status pendaftaran dufah aktif + daftar jenis yang bisa dipilih.
export async function GET() {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dufahAktif = (await getActiveDufahName()) || "";
  const [periode, jenisList] = await Promise.all([
    dufahAktif
      ? prisma.tadribFununPeriode.findUnique({ where: { dufahNama: dufahAktif } })
      : null,
    prisma.tadribFununJenis.findMany({
      where: { isActive: true },
      select: { id: true, nama: true, deskripsi: true, minHadir: true },
      orderBy: { nama: "asc" },
    }),
  ]);

  const riwayat = await prisma.tadribFununPeserta.findMany({
    where: { santriId: session.santriId },
    include: {
      jenis: { select: { id: true, nama: true, minHadir: true } },
      hadir: {
        orderBy: { pertemuanKe: "asc" },
        include: { pencatat: { select: { nama: true } } },
      },
      penerbit: { select: { nama: true } },
    },
    orderBy: { dufahNama: "desc" },
  });

  const data = riwayat.map((p) => {
    const minHadir = resolveTadribFununMinHadir(p.jenis.minHadir);
    return {
      id: p.id,
      dufahNama: p.dufahNama,
      tanggalDaftar: p.tanggalDaftar,
      jenis: { id: p.jenis.id, nama: p.jenis.nama },
      kehadiran: p.hadir.length,
      minHadir,
      eligible: p.hadir.length >= minHadir,
      diterbitkan: !!p.syahadahDiterbitkanAt,
      diterbitkanAt: p.syahadahDiterbitkanAt,
      diterbitkanOleh: p.penerbit?.nama || null,
      hadir: p.hadir.map((h) => ({
        pertemuanKe: h.pertemuanKe,
        tanggal: h.tanggal,
        pencatat: h.pencatat?.nama || "-",
      })),
    };
  });

  return NextResponse.json({
    riwayat: data,
    dufahAktif,
    pendaftaranDibuka: periode?.dibuka ?? false,
    sudahDaftar: dufahAktif ? data.some((r) => r.dufahNama === dufahAktif) : false,
    jenisList,
  });
}

// POST { jenisId } — daftar mandiri ke satu jenis Tadrib Funun dufah aktif.
// Satu santri hanya boleh satu jenis per dufah; menutup hanya menghalangi
// pendaftar baru (peserta lama tidak terpengaruh).
export async function POST(request: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dufahAktif = (await getActiveDufahName()) || "";
  if (!dufahAktif) {
    return NextResponse.json({ error: "Dufah aktif tidak ditemukan" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const jenisId = body.jenisId as string | undefined;
  if (!jenisId) {
    return NextResponse.json({ error: "jenisId wajib diisi" }, { status: 400 });
  }

  const periode = await prisma.tadribFununPeriode.findUnique({
    where: { dufahNama: dufahAktif },
  });
  if (!periode?.dibuka) {
    return NextResponse.json(
      { error: `Pendaftaran Tadrib Funun ${dufahAktif} sudah ditutup. Silahkan tunggu pendaftaran di duf'ah berikutnya.` },
      { status: 403 }
    );
  }

  const jenis = await prisma.tadribFununJenis.findUnique({ where: { id: jenisId } });
  if (!jenis || !jenis.isActive) {
    return NextResponse.json({ error: "Jenis Tadrib Funun tidak ditemukan atau tidak aktif" }, { status: 400 });
  }

  const sudah = await prisma.tadribFununPeserta.findUnique({
    where: { santriId_dufahNama: { santriId: session.santriId, dufahNama: dufahAktif } },
    include: { jenis: { select: { nama: true } } },
  });
  if (sudah) {
    return NextResponse.json(
      { error: `Anda sudah terdaftar di ${sudah.jenis.nama} pada ${dufahAktif}. Satu santri hanya boleh mengikuti satu jenis per dufah.` },
      { status: 409 }
    );
  }

  const peserta = await prisma.tadribFununPeserta.create({
    data: { santriId: session.santriId, jenisId, dufahNama: dufahAktif },
  });

  return NextResponse.json({ ok: true, peserta });
}
