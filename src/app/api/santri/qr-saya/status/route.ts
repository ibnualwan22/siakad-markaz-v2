import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";

// Status scan kegiatan untuk santri yang sedang membuka QR Saya: baris HADIR
// hari ini (tanggal server, sama seperti penanda tanggal di API scan petugas).
// Dipakai polling Mode Scan: klien membandingkan hasil ini dengan snapshot saat
// masuk Mode Scan, sehingga hanya rekaman BARU yang memicu modal berhasil.
export async function GET() {
  const session = await getSantriSession();
  if (!session || !session.isAktif) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = await prisma.absenKegiatan.findMany({
      where: {
        status: "HADIR",
        tanggal: today,
        riwayat: { santriId: session.santriId },
      },
      include: { kategori: { select: { nama: true } } },
    });
    return NextResponse.json({
      success: true,
      hadir: rows.map((r) => ({ kategoriId: r.kategoriId, kategoriNama: r.kategori.nama })),
    });
  } catch {
    return NextResponse.json({ error: "Gagal membaca status" }, { status: 500 });
  }
}
