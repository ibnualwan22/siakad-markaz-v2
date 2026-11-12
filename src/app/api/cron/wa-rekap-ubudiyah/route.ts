import { NextRequest, NextResponse } from "next/server";
import { UbudiyahKegiatan, UbudiyahStatus } from "@prisma/client";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import prisma from "@/lib/prisma";
import {
  UBUDIYAH_KEGIATAN_ORDER,
  formatUbudiyahReport,
  getUbudiyahMasbuqLevel,
  type UbudiyahReportGhoibRow,
  type UbudiyahReportMasbuqRow,
} from "@/lib/ubudiyah";

export const dynamic = "force-dynamic";

// Cron laporan harian Ubudiyah — dipanggil tiap 06:00 dari VPS.
// Auth sama seperti cron lain (kirim-notifikasi): Bearer CRON_SECRET
// atau ?secret=CRON_SECRET. Tanpa secret yang benar -> 401
// (kecuali development).
// Isi laporan = Subuh hari ini + Maghrib, Isya, Halaqoh tadi malam
// (Subuh kemarin sudah masuk rekap kemarin). Dikirim ke penanggung
// jawab Ubudiyah. Bila nihil (tidak ada masbuq/ghoib) tetap dikirim
// sebagai pesan libur. ?dryRun=1 -> bangun pesan saja, tanpa kirim WA.
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

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  try {
    // Hari ini (WIB = waktu lokal server).
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayStr = formatter.format(new Date());
    const [y, m, d] = todayStr.split("-").map(Number);
    const todayLocal = new Date(y, m - 1, d);
    const yesterdayLocal = new Date(todayLocal);
    yesterdayLocal.setDate(yesterdayLocal.getDate() - 1);
    const yesterdayStr = [
      yesterdayLocal.getFullYear(),
      String(yesterdayLocal.getMonth() + 1).padStart(2, "0"),
      String(yesterdayLocal.getDate()).padStart(2, "0"),
    ].join("-");

    // @db.Date dari string YYYY-MM-DD (pola yang sama dipakai
    // route absensi lain): tengah malam UTC agar tanggalnya utuh.
    const todayDate = new Date(`${todayStr}T00:00:00Z`);
    const yesterdayDate = new Date(`${yesterdayStr}T00:00:00Z`);

    const records = await prisma.ubudiyahHadir.findMany({
      where: {
        OR: [
          { tanggal: todayDate, kegiatan: UbudiyahKegiatan.SUBUH },
          {
            tanggal: yesterdayDate,
            kegiatan: {
              in: [
                UbudiyahKegiatan.MAGHRIB,
                UbudiyahKegiatan.ISYA,
                UbudiyahKegiatan.HALAQOH,
              ],
            },
          },
        ],
      },
    });

    // Join: UbudiyahHadir.riwayatId -> RiwayatSantri -> SantriInternal.
    const riwayatIds = Array.from(new Set(records.map((r) => r.riwayatId)));
    const riwayats =
      riwayatIds.length > 0
        ? await prisma.riwayatSantri.findMany({
            where: { id: { in: riwayatIds } },
            select: { id: true, santriId: true },
          })
        : [];
    const riwayatById = new Map(riwayats.map((r) => [r.id, r.santriId]));
    const santriIds = Array.from(new Set(riwayats.map((r) => r.santriId)));
    const santris =
      santriIds.length > 0
        ? await prisma.santriInternal.findMany({
            where: { id: { in: santriIds } },
            select: { id: true, nama: true, sakan: true, kategori: true },
          })
        : [];
    const santriById = new Map(santris.map((s) => [s.id, s]));

    // Masbuq digabung per (santri, level); Ghoib digabung per santri.
    // Halaqoh TIDAK_HADIR tampil sebagai GHOIB dengan kegiatan halaqoh.
    // TEPAT_WAKTU dan HADIR tidak masuk pesan.
    const masbuqByKey = new Map<string, UbudiyahReportMasbuqRow>();
    const ghoibByKey = new Map<string, UbudiyahReportGhoibRow>();

    for (const r of records) {
      const santriId = riwayatById.get(r.riwayatId);
      if (!santriId) continue;
      const santri = santriById.get(santriId);
      if (!santri || !santri.nama) continue;
      // KSU hanya tampil di rekap web, tidak di pesan WA.
      if (santri.kategori === "KSU") continue;

      const sakan = santri.sakan ?? "";
      const level = getUbudiyahMasbuqLevel(r.status);
      if (level !== null) {
        const key = `${r.riwayatId}|${level}`;
        const existing = masbuqByKey.get(key);
        if (existing) {
          if (!existing.kegiatan.includes(r.kegiatan)) {
            existing.kegiatan.push(r.kegiatan);
          }
        } else {
          masbuqByKey.set(key, {
            nama: santri.nama,
            sakan,
            level,
            kegiatan: [r.kegiatan],
          });
        }
        continue;
      }

      if (
        r.status === UbudiyahStatus.GHOIB ||
        r.status === UbudiyahStatus.TIDAK_HADIR
      ) {
        const existing = ghoibByKey.get(r.riwayatId);
        if (existing) {
          if (!existing.kegiatan.includes(r.kegiatan)) {
            existing.kegiatan.push(r.kegiatan);
          }
        } else {
          ghoibByKey.set(r.riwayatId, {
            nama: santri.nama,
            sakan,
            kegiatan: [r.kegiatan],
          });
        }
      }
      // TEPAT_WAKTU / HADIR: bukan masbuq maupun ghoib, lewati.
    }

    const sortKegiatan = (k: UbudiyahKegiatan[]) =>
      [...k].sort(
        (a, b) =>
          UBUDIYAH_KEGIATAN_ORDER.indexOf(a) -
          UBUDIYAH_KEGIATAN_ORDER.indexOf(b)
      );
    const masbuq: UbudiyahReportMasbuqRow[] = Array.from(
      masbuqByKey.values()
    ).map((row) => ({ ...row, kegiatan: sortKegiatan(row.kegiatan) }));
    const ghoib: UbudiyahReportGhoibRow[] = Array.from(
      ghoibByKey.values()
    ).map((row) => ({ ...row, kegiatan: sortKegiatan(row.kegiatan) }));

    const message = formatUbudiyahReport(todayLocal, masbuq, ghoib);

    let terkirim = false;
    if (!dryRun) {
      const result = await sendWhatsAppMessage("6282338545762", message);
      terkirim = result.success;
      if (!terkirim) {
        console.error("Cron wa-rekap-ubudiyah gagal kirim WA:", result.detail);
      }
    }

    return NextResponse.json({
      ok: true,
      tanggal: todayStr,
      masbuq: masbuq.length,
      ghoib: ghoib.length,
      terkirim,
      ...(dryRun ? { dryRun: true, message } : {}),
    });
  } catch (error: any) {
    console.error("Error wa-rekap-ubudiyah:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
