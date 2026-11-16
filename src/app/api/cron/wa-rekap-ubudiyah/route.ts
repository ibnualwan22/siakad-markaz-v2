import { NextRequest, NextResponse } from "next/server";
import { UbudiyahKegiatan, UbudiyahStatus } from "@prisma/client";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import prisma from "@/lib/prisma";
import {
  UBUDIYAH_KEGIATAN_KEMARIN,
  UBUDIYAH_KEGIATAN_ORDER,
  formatUbudiyahReport,
  formatUbudiyahReportLainnya,
  getUbudiyahMasbuqLevel,
  type UbudiyahReportGhoibRow,
  type UbudiyahReportLainnyaRow,
  type UbudiyahReportMasbuqRow,
} from "@/lib/ubudiyah";
import { lembagaFromProgramKategori } from "@/lib/lembaga";

export const dynamic = "force-dynamic";

// Cron laporan harian Ubudiyah — dipanggil tiap 06:00 dari VPS.
// Auth sama seperti cron lain (kirim-notifikasi): Bearer CRON_SECRET
// atau ?secret=CRON_SECRET. Tanpa secret yang benar -> 401
// (kecuali development).
// Isi laporan = Subuh hari ini + Dzuhur, Ashar, Maghrib, Isya, Halaqoh
// tadi malam (Subuh kemarin sudah masuk rekap kemarin). Laporan
// dipisah per lembaga: Arabiyah -> penanggung jawab Ubudiyah
// (6282338545762), Turats + Hufadz (gabungan, SATU pesan) ->
// 6285856262057. Judul tanggal mengikuti harinya: kegiatan kemarin
// pakai tanggal kemarin, Subuh pakai judul baru dengan tanggal hari
// ini — SATU pesan dengan dua judul. Bila nihil (tidak ada
// masbuq/ghoib) tetap dikirim sebagai pesan libur. Pesan KEDUA (khusus
// "Lainnya", dengan keterangan) dikirim ke nomor yang sama HANYA bila
// ada entrinya; bila kosong dilewati. ?dryRun=1 -> bangun pesan saja,
// tanpa kirim WA.
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
              in: UBUDIYAH_KEGIATAN_KEMARIN,
            },
          },
        ],
      },
    });

    // Join: UbudiyahHadir.riwayatId -> RiwayatSantri (+ program) ->
    // SantriInternal. Lembaga santri dibaca dari Program.kategori
    // riwayatnya (TURATS/HUFADZ, selain itu Arabiyah).
    const riwayatIds = Array.from(new Set(records.map((r) => r.riwayatId)));
    const riwayats =
      riwayatIds.length > 0
        ? await prisma.riwayatSantri.findMany({
            where: { id: { in: riwayatIds } },
            select: { id: true, santriId: true, programId: true },
          })
        : [];
    const riwayatById = new Map(riwayats.map((r) => [r.id, r]));
    const programIds = Array.from(
      new Set(
        riwayats.map((r) => r.programId).filter((x): x is string => !!x)
      )
    );
    const programs =
      programIds.length > 0
        ? await prisma.program.findMany({
            where: { id: { in: programIds } },
            select: { id: true, kategori: true },
          })
        : [];
    const kategoriByProgramId = new Map(
      programs.map((p) => [p.id, p.kategori])
    );
    const santriIds = Array.from(new Set(riwayats.map((r) => r.santriId)));
    const santris =
      santriIds.length > 0
        ? await prisma.santriInternal.findMany({
            where: { id: { in: santriIds } },
            select: { id: true, nama: true, sakan: true, kategori: true },
          })
        : [];
    const santriById = new Map(santris.map((s) => [s.id, s]));

    // Akumulator laporan per kelompok: Arabiyah, dan Turats+Hufadz gabungan.
    type Acc = {
      masbuqByKey: Map<string, UbudiyahReportMasbuqRow>;
      ghoibByKey: Map<string, UbudiyahReportGhoibRow>;
      // Lainnya: satu baris per (santri, kegiatan) karena keterangannya
      // bisa beda tiap kegiatan; tidak digabung dengan masbuq/ghoib.
      lainnya: UbudiyahReportLainnyaRow[];
    };
    const newAcc = (): Acc => ({
      masbuqByKey: new Map(),
      ghoibByKey: new Map(),
      lainnya: [],
    });
    const accArabiyah = newAcc();
    const accTuratsHufadz = newAcc();

    // Masbuq digabung per (santri, level); Ghoib digabung per santri.
    // Halaqoh TIDAK_HADIR tampil sebagai GHOIB dengan kegiatan halaqoh.
    // TEPAT_WAKTU dan HADIR tidak masuk pesan.
    for (const r of records) {
      const riwayat = riwayatById.get(r.riwayatId);
      if (!riwayat) continue;
      const santri = santriById.get(riwayat.santriId);
      if (!santri || !santri.nama) continue;
      // KSU hanya tampil di rekap web, tidak di pesan WA.
      if (santri.kategori === "KSU") continue;
      const lembaga = lembagaFromProgramKategori(
        riwayat.programId
          ? (kategoriByProgramId.get(riwayat.programId) ?? null)
          : null
      );
      const acc = lembaga === "ARABIYAH" ? accArabiyah : accTuratsHufadz;

      const sakan = santri.sakan ?? "";
      const level = getUbudiyahMasbuqLevel(r.status);
      if (level !== null) {
        const key = `${r.riwayatId}|${level}`;
        const existing = acc.masbuqByKey.get(key);
        if (existing) {
          if (!existing.kegiatan.includes(r.kegiatan)) {
            existing.kegiatan.push(r.kegiatan);
          }
        } else {
          acc.masbuqByKey.set(key, {
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
        const existing = acc.ghoibByKey.get(r.riwayatId);
        if (existing) {
          if (!existing.kegiatan.includes(r.kegiatan)) {
            existing.kegiatan.push(r.kegiatan);
          }
        } else {
          acc.ghoibByKey.set(r.riwayatId, {
            nama: santri.nama,
            sakan,
            kegiatan: [r.kegiatan],
          });
        }
      }

      if (r.status === UbudiyahStatus.LAINNYA) {
        acc.lainnya.push({
          nama: santri.nama,
          sakan,
          kegiatan: r.kegiatan,
          keterangan: r.keterangan?.trim() || "-",
        });
      }
      // TEPAT_WAKTU / HADIR: bukan masbuq, ghoib, maupun lainnya, lewati.
    }

    const sortKegiatan = (k: UbudiyahKegiatan[]) =>
      [...k].sort(
        (a, b) =>
          UBUDIYAH_KEGIATAN_ORDER.indexOf(a) -
          UBUDIYAH_KEGIATAN_ORDER.indexOf(b)
      );
    const bangun = (acc: Acc) => ({
      masbuq: Array.from(acc.masbuqByKey.values()).map((row) => ({
        ...row,
        kegiatan: sortKegiatan(row.kegiatan),
      })),
      ghoib: Array.from(acc.ghoibByKey.values()).map((row) => ({
        ...row,
        kegiatan: sortKegiatan(row.kegiatan),
      })),
      lainnya: acc.lainnya,
    });
    const lapArabiyah = bangun(accArabiyah);
    const lapTuratsHufadz = bangun(accTuratsHufadz);

    // Judul tanggal mengikuti harinya: kegiatan kemarin pakai tanggal
    // kemarin, Subuh pakai judul baru tanggal hari ini (satu pesan).
    // Arabiyah tidak punya Dzuhur/Ashar, jadi subjudul kemarinnya
    // hanya Maghrib, Isya, Halaqoh.
    const kegiatanKemarinArabiyah = [
      UbudiyahKegiatan.MAGHRIB,
      UbudiyahKegiatan.ISYA,
      UbudiyahKegiatan.HALAQOH,
    ];
    const messageArabiyah = formatUbudiyahReport(
      yesterdayLocal,
      todayLocal,
      lapArabiyah.masbuq,
      lapArabiyah.ghoib,
      kegiatanKemarinArabiyah
    );
    const messageTuratsHufadz = formatUbudiyahReport(
      yesterdayLocal,
      todayLocal,
      lapTuratsHufadz.masbuq,
      lapTuratsHufadz.ghoib,
      UBUDIYAH_KEGIATAN_KEMARIN
    );
    const messageLainnyaArabiyah =
      lapArabiyah.lainnya.length > 0
        ? formatUbudiyahReportLainnya(
            yesterdayLocal,
            todayLocal,
            lapArabiyah.lainnya,
            kegiatanKemarinArabiyah
          )
        : null;
    const messageLainnyaTuratsHufadz =
      lapTuratsHufadz.lainnya.length > 0
        ? formatUbudiyahReportLainnya(
            yesterdayLocal,
            todayLocal,
            lapTuratsHufadz.lainnya,
            UBUDIYAH_KEGIATAN_KEMARIN
          )
        : null;

    const kirim = async (nomor: string, pesan: string) => {
      const result = await sendWhatsAppMessage(nomor, pesan);
      if (!result.success) {
        console.error("Cron wa-rekap-ubudiyah gagal kirim WA:", result.detail);
      }
      return result.success;
    };

    let terkirimArabiyah = false;
    let terkirimTuratsHufadz = false;
    if (!dryRun) {
      terkirimArabiyah = await kirim("6282338545762", messageArabiyah);
      terkirimTuratsHufadz = await kirim("6285856262057", messageTuratsHufadz);
    }

    // Pesan kedua (Lainnya) hanya bila ada entrinya; bila kosong dilewati.
    let pesanLainnyaArabiyah: "dikirim" | "dilewati" | "gagal" = "dilewati";
    let pesanLainnyaTuratsHufadz: "dikirim" | "dilewati" | "gagal" =
      "dilewati";
    if (messageLainnyaArabiyah && !dryRun) {
      pesanLainnyaArabiyah = (await kirim(
        "6282338545762",
        messageLainnyaArabiyah
      ))
        ? "dikirim"
        : "gagal";
    }
    if (messageLainnyaTuratsHufadz && !dryRun) {
      pesanLainnyaTuratsHufadz = (await kirim(
        "6285856262057",
        messageLainnyaTuratsHufadz
      ))
        ? "dikirim"
        : "gagal";
    }

    return NextResponse.json({
      ok: true,
      tanggal: yesterdayStr,
      masbuq: lapArabiyah.masbuq.length,
      ghoib: lapArabiyah.ghoib.length,
      lainnya: lapArabiyah.lainnya.length,
      terkirim: terkirimArabiyah,
      pesanLainnya: pesanLainnyaArabiyah,
      turatsHufadz: {
        masbuq: lapTuratsHufadz.masbuq.length,
        ghoib: lapTuratsHufadz.ghoib.length,
        lainnya: lapTuratsHufadz.lainnya.length,
        terkirim: terkirimTuratsHufadz,
        pesanLainnya: pesanLainnyaTuratsHufadz,
      },
      ...(dryRun
        ? {
            dryRun: true,
            message: messageArabiyah,
            messageLainnya: messageLainnyaArabiyah,
            turatsHufadzMessage: messageTuratsHufadz,
            turatsHufadzMessageLainnya: messageLainnyaTuratsHufadz,
          }
        : {}),
    });
  } catch (error: any) {
    console.error("Error wa-rekap-ubudiyah:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
