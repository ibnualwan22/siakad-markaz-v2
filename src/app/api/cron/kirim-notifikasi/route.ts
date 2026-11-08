import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  isJadwalDue,
  kirimPengumuman,
  nowWib,
} from "@/lib/notifikasi-kirim";
import { normalisasiTargetLembaga } from "@/lib/notifikasi-target";

export const dynamic = "force-dynamic";

// Cron pengiriman pengumuman terjadwal — dipanggil tiap menit dari VPS.
// Auth sama seperti cron lain (cleanup-cloudinary): Bearer CRON_SECRET
// atau ?secret=. Tanpa secret yang benar → 401 (kecuali development).
// Untuk tiap jadwal aktif yang jatuh tempo (harian/mingguan/tanggal):
// buat Pengumuman, kirim FCM (aplikasi; dilewati bila service account
// belum ada) + Web Push VAPID (portal), tulis NotifikasiLog.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  let isValidCron = false;
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    isValidCron = true;
  }
  if (request.nextUrl.searchParams.get("secret") === process.env.CRON_SECRET) {
    isValidCron = true;
  }
  if (!isValidCron && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jadwals = await prisma.notifikasiJadwal.findMany({
      where: { isActive: true },
      include: { template: { select: { label: true } } },
      orderBy: { waktu: "asc" },
    });
    const now = nowWib();
    const terkirim: unknown[] = [];
    let dilewati = 0;
    for (const j of jadwals) {
      if (!isJadwalDue(j, now)) {
        dilewati++;
        continue;
      }
      try {
        const hasil = await kirimPengumuman({
          jadwalId: j.id,
          templateLabel: j.template.label,
          judul: j.judul,
          isi: j.isi,
          tautan: j.tautan,
          targetLembaga: normalisasiTargetLembaga(j.targetLembaga),
        });
        terkirim.push({ jadwalId: j.id, judul: j.judul, ...hasil });
      } catch (e) {
        console.error(`Cron notifikasi gagal untuk jadwal ${j.id}:`, e);
        terkirim.push({
          jadwalId: j.id,
          judul: j.judul,
          error: (e as Error)?.message ?? "unknown",
        });
      }
    }
    return NextResponse.json({
      success: true,
      diperiksa: jadwals.length,
      dilewati,
      terkirim,
    });
  } catch (error) {
    console.error("Error cron kirim-notifikasi:", error);
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Terjadi kesalahan sistem" },
      { status: 500 }
    );
  }
}
