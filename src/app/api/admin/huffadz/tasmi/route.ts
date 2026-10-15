import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getActiveDufahName } from "@/lib/absensi";

export const dynamic = "force-dynamic";

function validNilai(n: any): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 100;
}

// GET ?tanggal=YYYY-MM-DD&q=nama — list penilaian
// GET ?santri=1 — daftar santri program Hufadz (dufah aktif) untuk dropdown
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("huffadz");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // Daftar santri Huffadz
  if (searchParams.get("santri") === "1") {
    const dufahNama = await getActiveDufahName();
    if (!dufahNama) return NextResponse.json({ error: "Dufah aktif belum diatur" }, { status: 400 });
    const riwayat = await prisma.riwayatSantri.findMany({
      where: {
        dufahNama,
        program: { nama_indo: "Hufadz" },
      },
      include: { santri: { select: { id: true, nama: true } } },
      orderBy: { santri: { nama: "asc" } },
    });
    return NextResponse.json(riwayat.map((r: any) => ({ id: r.santri.id, nama: r.santri.nama })));
  }

  // List penilaian
  const tanggal = searchParams.get("tanggal"); // YYYY-MM-DD
  const q = searchParams.get("q") || "";
  const where: any = {};
  if (tanggal) {
    const start = new Date(tanggal + "T00:00:00+07:00");
    const end = new Date(tanggal + "T00:00:00+07:00");
    end.setDate(end.getDate() + 1);
    where.waktuSubmit = { gte: start, lt: end };
  }
  if (q) {
    where.santri = { nama: { contains: q, mode: "insensitive" } };
  }

  const list = await prisma.huffadzTasmi.findMany({
    where,
    include: {
      santri: { select: { nama: true } },
      penilai: { select: { nama: true } },
    },
    orderBy: { waktuSubmit: "desc" },
    take: 200,
  });
  return NextResponse.json(list);
}

function validasiRentang(b: any): string | null {
  const sDari = Number(b.surahNo), sSampai = Number(b.surahSampaiNo);
  const aDari = Number(b.ayatDari), aSampai = Number(b.ayatSampai);
  if (!Number.isInteger(sDari) || sDari < 1 || sDari > 114) return "Surat awal tidak valid";
  if (!Number.isInteger(sSampai) || sSampai < 1 || sSampai > 114) return "Surat akhir tidak valid";
  if (sSampai < sDari) return "Surat akhir tidak boleh sebelum surat awal";
  if (!Number.isInteger(aDari) || aDari < 1) return "Ayat awal tidak valid";
  if (!Number.isInteger(aSampai) || aSampai < 1) return "Ayat akhir tidak valid";
  if (sSampai === sDari && aSampai < aDari) return "Ayat akhir harus ≥ ayat awal";
  const j = Number(b.juz);
  if (!Number.isInteger(j) || j < 1 || j > 30) return "Juz harus 1-30";
  for (const [k, v] of [["Tahfidz", b.nilaiTahfidz], ["Tahsin", b.nilaiTahsin], ["Tartil", b.nilaiTartil], ["Adab", b.nilaiAdab]] as const) {
    if (!validNilai(Number(v))) return `Nilai ${k} harus 0-100`;
  }
  return null;
}

// POST — input penilaian baru (waktuSubmit otomatis = waktu server)
export async function POST(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("huffadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const b = await request.json();
    const { santriId, surahNo, surahNama, ayatDari } = b;

    if (!santriId || !surahNo || !surahNama) {
      return NextResponse.json({ error: "Santri dan surat wajib diisi" }, { status: 400 });
    }
    const err = validasiRentang(b);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    // Pastikan santri terdaftar di program Hufadz (dufah aktif)
    const dufahNama = await getActiveDufahName();
    if (dufahNama) {
      const ok = await prisma.riwayatSantri.findFirst({
        where: { santriId, dufahNama, program: { nama_indo: "Hufadz" } },
        select: { id: true },
      });
      if (!ok) {
        return NextResponse.json({ error: "Santri tidak terdaftar di program Hufadz" }, { status: 400 });
      }
    }

    const data = await prisma.huffadzTasmi.create({
      data: {
        santriId,
        surahNo: Number(surahNo),
        surahNama: String(surahNama).slice(0, 100),
        ayatDari: Number(ayatDari),
        surahSampaiNo: Number(b.surahSampaiNo),
        surahSampaiNama: String(b.surahSampaiNama || surahNama).slice(0, 100),
        ayatSampai: Number(b.ayatSampai),
        juz: Number(b.juz),
        durasiMenit: Math.max(0, Number(b.durasiMenit) || 0),
        nilaiTahfidz: Number(b.nilaiTahfidz),
        nilaiTahsin: Number(b.nilaiTahsin),
        nilaiTartil: Number(b.nilaiTartil),
        nilaiAdab: Number(b.nilaiAdab),
        catatan: b.catatan ? String(b.catatan).slice(0, 500) : null,
        penilaiId: (session as any).userId || null,
      },
      include: { santri: { select: { nama: true } } },
    });
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal menyimpan" }, { status: 500 });
  }
}
