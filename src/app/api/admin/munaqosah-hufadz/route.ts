import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getActiveDufahName } from "@/lib/absensi";
import {
  hitungNilaiAkhir,
  predikatIndo,
  isLulus,
  isMusyarokah,
} from "@/lib/munaqosah-hufadz";

export const dynamic = "force-dynamic";

// GET ?dufahNama=... — daftar santri Hufadz dufah tersebut + record
// munaqosah-nya (bila sudah dinilai) + nilai akhir/predikat terhitung.
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dufahNama = searchParams.get("dufahNama") || (await getActiveDufahName()) || "";

  const [riwayat, records] = await Promise.all([
    prisma.riwayatSantri.findMany({
      where: {
        dufahNama,
        program: { kategori: "HUFADZ" },
        santri: { isAktif: true },
      },
      include: { santri: { select: { id: true, nama: true } } },
      orderBy: { santri: { nama: "asc" } },
    }),
    dufahNama
      ? prisma.munaqosahHufadz.findMany({
          where: { dufahNama },
          include: { penguji: { select: { nama: true } } },
        })
      : [],
  ]);

  const bySantri = new Map(records.map((r) => [r.santriId, r]));
  const data = riwayat.map((r) => {
    const rec: any = bySantri.get(r.santriId) || null;
    let nilaiAkhir: number | null = null;
    let predikat: string | null = null;
    let status: string | null = null;
    if (rec) {
      nilaiAkhir = hitungNilaiAkhir(rec);
      predikat = predikatIndo(nilaiAkhir);
      status = isMusyarokah(nilaiAkhir)
        ? "MUSYAROKAH"
        : isLulus(nilaiAkhir)
          ? "LULUS"
          : "TIDAK_LULUS";
    }
    return {
      santriId: r.santriId,
      nama: r.santri.nama,
      record: rec
        ? {
            id: rec.id,
            nilaiHafalan: rec.nilaiHafalan,
            nilaiKelancaran: rec.nilaiKelancaran,
            nilaiTajwid: rec.nilaiTajwid,
            nilaiMakhorijulHuruf: rec.nilaiMakhorijulHuruf,
            nilaiAdab: rec.nilaiAdab,
            juzTeks: rec.juzTeks,
            tanggal: rec.tanggal,
            catatan: rec.catatan,
            pengujiNama: rec.penguji?.nama ?? null,
            verifyToken: rec.verifyToken,
          }
        : null,
      nilaiAkhir,
      predikat,
      status,
    };
  });

  return NextResponse.json({ dufahNama, data });
}

// POST { santriId, dufahNama?, nilaiHafalan, nilaiKelancaran, nilaiTajwid,
//   nilaiMakhorijulHuruf, nilaiAdab, juzTeks, tanggal?, catatan? } —
// simpan / perbarui nilai munaqosah (upsert per santri per dufah).
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const dufahNama = body.dufahNama || (await getActiveDufahName()) || "";
  if (!body.santriId || !dufahNama) {
    return NextResponse.json({ error: "santriId dan dufahNama wajib diisi" }, { status: 400 });
  }
  const nilaiKeys = [
    "nilaiHafalan",
    "nilaiKelancaran",
    "nilaiTajwid",
    "nilaiMakhorijulHuruf",
    "nilaiAdab",
  ] as const;
  for (const k of nilaiKeys) {
    const v = Number(body[k]);
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      return NextResponse.json({ error: `Nilai ${k} harus bilangan bulat 0–100` }, { status: 400 });
    }
  }
  if (!body.juzTeks || !String(body.juzTeks).trim()) {
    return NextResponse.json({ error: "Juz yang diselesaikan wajib diisi" }, { status: 400 });
  }

  const rec = await prisma.munaqosahHufadz.upsert({
    where: {
      santriId_dufahNama: { santriId: body.santriId, dufahNama },
    },
    update: {
      nilaiHafalan: Number(body.nilaiHafalan),
      nilaiKelancaran: Number(body.nilaiKelancaran),
      nilaiTajwid: Number(body.nilaiTajwid),
      nilaiMakhorijulHuruf: Number(body.nilaiMakhorijulHuruf),
      nilaiAdab: Number(body.nilaiAdab),
      juzTeks: String(body.juzTeks).trim(),
      tanggal: body.tanggal ? new Date(body.tanggal) : new Date(),
      catatan: body.catatan || null,
      pengujiId: session.userId,
    },
    create: {
      santriId: body.santriId,
      dufahNama,
      nilaiHafalan: Number(body.nilaiHafalan),
      nilaiKelancaran: Number(body.nilaiKelancaran),
      nilaiTajwid: Number(body.nilaiTajwid),
      nilaiMakhorijulHuruf: Number(body.nilaiMakhorijulHuruf),
      nilaiAdab: Number(body.nilaiAdab),
      juzTeks: String(body.juzTeks).trim(),
      tanggal: body.tanggal ? new Date(body.tanggal) : new Date(),
      catatan: body.catatan || null,
      pengujiId: session.userId,
    },
  });

  return NextResponse.json(rec);
}
