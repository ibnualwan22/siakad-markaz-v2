import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export const dynamic = "force-dynamic";

function validNilai(n: any): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 100;
}

// PUT — edit penilaian
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const hasPerm = await checkPermission("huffadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const b = await request.json();
    const { surahNo, surahNama, ayatDari, ayatSampai, juz, durasiMenit,
      jumlahSalah, nilaiTahfidz, nilaiTahsin, nilaiTartil, nilaiAdab, catatan, waktuSubmit } = b;

    const aDari = Number(ayatDari), aSampai = Number(ayatSampai);
    if (!Number.isInteger(aDari) || !Number.isInteger(aSampai) || aDari < 1 || aSampai < aDari) {
      return NextResponse.json({ error: "Rentang ayat tidak valid" }, { status: 400 });
    }
    const j = Number(juz);
    if (!Number.isInteger(j) || j < 1 || j > 30) {
      return NextResponse.json({ error: "Juz harus 1-30" }, { status: 400 });
    }
    for (const [k, v] of [["Tahfidz", nilaiTahfidz], ["Tahsin", nilaiTahsin], ["Tartil", nilaiTartil], ["Adab", nilaiAdab]] as const) {
      if (!validNilai(Number(v))) {
        return NextResponse.json({ error: `Nilai ${k} harus 0-100` }, { status: 400 });
      }
    }

    const data = await prisma.huffadzTasmi.update({
      where: { id },
      data: {
        surahNo: Number(surahNo),
        surahNama: String(surahNama).slice(0, 100),
        ayatDari: aDari,
        ayatSampai: aSampai,
        juz: j,
        durasiMenit: Math.max(0, Number(durasiMenit) || 0),
        jumlahSalah: Math.max(0, Number(jumlahSalah) || 0),
        nilaiTahfidz: Number(nilaiTahfidz),
        nilaiTahsin: Number(nilaiTahsin),
        nilaiTartil: Number(nilaiTartil),
        nilaiAdab: Number(nilaiAdab),
        catatan: catatan ? String(catatan).slice(0, 500) : null,
        ...(waktuSubmit ? { waktuSubmit: new Date(waktuSubmit) } : {}),
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
