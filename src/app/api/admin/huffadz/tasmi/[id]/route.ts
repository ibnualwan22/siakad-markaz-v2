import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export const dynamic = "force-dynamic";

function validNilai(n: any): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 100;
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

// PUT — edit penilaian (waktuSubmit tidak diubah)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const hasPerm = await checkPermission("huffadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const b = await request.json();

    const err = validasiRentang(b);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const data = await prisma.huffadzTasmi.update({
      where: { id },
      data: {
        surahNo: Number(b.surahNo),
        surahNama: String(b.surahNama).slice(0, 100),
        ayatDari: Number(b.ayatDari),
        surahSampaiNo: Number(b.surahSampaiNo),
        surahSampaiNama: String(b.surahSampaiNama || b.surahNama).slice(0, 100),
        ayatSampai: Number(b.ayatSampai),
        juz: Number(b.juz),
        durasiMenit: Math.max(0, Number(b.durasiMenit) || 0),
        nilaiTahfidz: Number(b.nilaiTahfidz),
        nilaiTahsin: Number(b.nilaiTahsin),
        nilaiTartil: Number(b.nilaiTartil),
        nilaiAdab: Number(b.nilaiAdab),
        catatan: b.catatan ? String(b.catatan).slice(0, 500) : null,
      },
      include: { santri: { select: { nama: true } } },
    });
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal menyimpan" }, { status: 500 });
  }
}

// DELETE — hapus penilaian
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const hasPerm = await checkPermission("huffadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await prisma.huffadzTasmi.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal menghapus" }, { status: 500 });
  }
}
