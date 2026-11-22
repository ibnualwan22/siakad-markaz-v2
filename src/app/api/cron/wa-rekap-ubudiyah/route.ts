import { NextRequest, NextResponse } from "next/server";
import { UbudiyahKegiatan, UbudiyahStatus } from "@prisma/client";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import prisma from "@/lib/prisma";
import { getActiveDufahName } from "@/lib/absensi";
import {
  UBUDIYAH_KEGIATAN_HARI_INI_1530,
  UBUDIYAH_KEGIATAN_KEMARIN,
  UBUDIYAH_KEGIATAN_KEMARIN_1530,
  UBUDIYAH_KEGIATAN_ORDER,
  formatUbudiyahReport,
  formatUbudiyahReportLainnya,
  getUbudiyahMasbuqLevel,
  type UbudiyahReportBelumAbsenRow,
  type UbudiyahReportGhoibRow,
  type UbudiyahReportLainnyaRow,
  type UbudiyahReportMasbuqRow,
} from "@/lib/ubudiyah";
import { lembagaFromProgramKategori } from "@/lib/lembaga";

export const dynamic = "force-dynamic";

// Cron laporan harian Ubudiyah — dipanggil dari VPS, DUA jadwal:
// 06:00 (?scope=arabiyah) dan 15:30 (?scope=turats). Tanpa scope:
// kedua kelompok dengan jendela lama (untuk back-compat / testing).
// Auth sama seperti cron lain (kirim-notifikasi): Bearer CRON_SECRET
// atau ?secret=CRON_SECRET. Tanpa secret yang benar -> 401
// (kecuali development).
// Isi laporan Arabiyah (06:00) = Subuh hari ini + Dzuhur, Ashar,
// Maghrib, Isya, Halaqoh tadi malam. Isi laporan Turats + Hufadz
// (15:30) = Subuh, Dzuhur, Ashar hari ini + Maghrib, Isya, Halaqoh
// tadi malam (Subuh kemarin sudah masuk rekap kemarin). Laporan
// dipisah per lembaga: Arabiyah -> penanggung jawab Ubudiyah
// (6282338545762), Turats + Hufadz (gabungan, SATU pesan) ->
// 6285856262057. Judul tanggal mengikuti harinya: kegiatan kemarin
// pakai tanggal kemarin, kegiatan hari ini pakai judul baru dengan
// tanggal hari ini — SATU pesan dengan dua judul. Bila nihil (tidak
// ada masbuq/ghoib) tetap dikirim sebagai pesan libur. Pesan KEDUA
// (khusus "Lainnya", dengan keterangan) dikirim ke nomor yang sama
// HANYA bila ada entrinya; bila kosong dilewati. Tambahan: santri
// yang sudah checkout tidak tampil di laporan; Qism aktif yang
// santrinya sudah checkout DINONAKTIFKAN dan sakannya masuk seksi
// peringatan "Qism perlu segera diganti" — penonaktifan + peringatan
// ini ikut scope (06:00 menangani Arabiyah, 15:30 menangani
// Turats+Hufadz); sakan yang tidak mengisi absen sama sekali pada
// suatu kegiatan masuk seksi peringatan "Belum absen" (Arabiyah
// TIDAK diharapkan mengisi Dzuhur/Ashar karena memang tidak ada
// jamaah di waktu tersebut). Libur HANYA bila tidak ada satu pun
// baris absen untuk lembaga itu di seluruh jendela.
// ?dryRun=1 -> bangun pesan saja, tanpa kirim WA dan tanpa
// menonaktifkan Qism (pesan tetap menampilkan peringatan yang AKAN
// terjadi).
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

  // Scope laporan: "arabiyah" (06:00) atau "turats" (15:30); tanpa
  // scope kedua kelompok jalan dengan jendela lama. Jendela baru
  // (Dzuhur/Ashar hari ini) hanya berlaku untuk scope turats.
  const scopeParam = request.nextUrl.searchParams.get("scope");
  const scope: "arabiyah" | "turats" | "semua" =
    scopeParam === "arabiyah"
      ? "arabiyah"
      : scopeParam === "turats"
        ? "turats"
        : "semua";
  const jalanArabiyah = scope !== "turats";
  const jalanTurats = scope !== "arabiyah";
  const turatsJendelaBaru = scope === "turats";

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

    // Jendela records ikut scope: arabiyah = Subuh hari ini + Dzuhur/
    // Ashar/Maghrib/Isya/Halaqoh kemarin; turats (15:30) = Subuh/
    // Dzuhur/Ashar hari ini + Maghrib/Isya/Halaqoh kemarin.
    const kegiatanHariIniQuery =
      scope === "turats"
        ? UBUDIYAH_KEGIATAN_HARI_INI_1530
        : [UbudiyahKegiatan.SUBUH];
    const kegiatanKemarinQuery =
      scope === "turats"
        ? UBUDIYAH_KEGIATAN_KEMARIN_1530
        : UBUDIYAH_KEGIATAN_KEMARIN;
    const records = await prisma.ubudiyahHadir.findMany({
      where: {
        OR: [
          { tanggal: todayDate, kegiatan: { in: kegiatanHariIniQuery } },
          {
            tanggal: yesterdayDate,
            kegiatan: {
              in: kegiatanKemarinQuery,
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
            select: { id: true, nama: true, sakan: true, kategori: true, isCheckedOut: true },
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
    let adaBarisArabiyah = false;
    let adaBarisTuratsHufadz = false;
    for (const r of records) {
      const riwayat = riwayatById.get(r.riwayatId);
      if (!riwayat) continue;
      const santri = santriById.get(riwayat.santriId);
      if (!santri || !santri.nama) continue;
      // KSU hanya tampil di rekap web, tidak di pesan WA.
      if (santri.kategori === "KSU") continue;
      // Santri yang sudah checkout tidak tampil di laporan.
      if (santri.isCheckedOut) continue;
      const lembaga = lembagaFromProgramKategori(
        riwayat.programId
          ? (kategoriByProgramId.get(riwayat.programId) ?? null)
          : null
      );
      // Scope: lewati santri kelompok yang tidak dijalankan.
      if (lembaga === "ARABIYAH" && !jalanArabiyah) continue;
      if (lembaga !== "ARABIYAH" && !jalanTurats) continue;
      const acc = lembaga === "ARABIYAH" ? accArabiyah : accTuratsHufadz;
      if (lembaga === "ARABIYAH") adaBarisArabiyah = true;
      else adaBarisTuratsHufadz = true;

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

    // --- Peringatan: Qism checkout + sakan yang tidak mengisi absen ---
    const dufahAktif = (await getActiveDufahName()) || "";
    const qismDigantiArabiyah: string[] = [];
    const qismDigantiTuratsHufadz: string[] = [];
    const belumAbsenArabiyah: UbudiyahReportBelumAbsenRow[] = [];
    const belumAbsenTuratsHufadz: UbudiyahReportBelumAbsenRow[] = [];
    if (dufahAktif) {
      // Qism aktif yang santrinya sudah checkout -> nonaktifkan (kecuali
      // dryRun) dan catat sakannya untuk peringatan di laporan. Lembaga
      // sakan peringatan dibaca dari program Qism itu sendiri.
      const qismAktif = await prisma.ubudiyahQism.findMany({
        where: { dufahNama: dufahAktif, isActive: true },
        select: { id: true, santriId: true, sakan: true },
      });
      const qismSantriIds = [...new Set(qismAktif.map((q) => q.santriId))];
      const qismSantris =
        qismSantriIds.length > 0
          ? await prisma.santriInternal.findMany({
              where: { id: { in: qismSantriIds } },
              select: { id: true, isCheckedOut: true },
            })
          : [];
      const qismSantriById = new Map(qismSantris.map((s) => [s.id, s]));
      const qismRiwayats =
        qismSantriIds.length > 0
          ? await prisma.riwayatSantri.findMany({
              where: { santriId: { in: qismSantriIds }, dufahNama: dufahAktif },
              select: { santriId: true, programId: true },
            })
          : [];
      const qismRiwayatBySantriId = new Map(
        qismRiwayats.map((r) => [r.santriId, r])
      );
      const qismProgramIds = Array.from(
        new Set(
          qismRiwayats.map((r) => r.programId).filter((x): x is string => !!x)
        )
      );
      const qismPrograms =
        qismProgramIds.length > 0
          ? await prisma.program.findMany({
              where: { id: { in: qismProgramIds } },
              select: { id: true, kategori: true },
            })
          : [];
      const qismKategoriByProgramId = new Map(
        qismPrograms.map((p) => [p.id, p.kategori])
      );
      const qismCheckoutIds: string[] = [];
      for (const q of qismAktif) {
        if (!qismSantriById.get(q.santriId)?.isCheckedOut) continue;
        const riwayat = qismRiwayatBySantriId.get(q.santriId);
        const programId = riwayat?.programId ?? null;
        const lembaga = lembagaFromProgramKategori(
          programId
            ? (qismKategoriByProgramId.get(programId) ?? null)
            : null
        );
        // Scope: Qism kelompok lain ditangani jadwalnya sendiri
        // (tidak dinonaktifkan di sini, tidak masuk peringatan).
        if (lembaga === "ARABIYAH" && !jalanArabiyah) continue;
        if (lembaga !== "ARABIYAH" && !jalanTurats) continue;
        qismCheckoutIds.push(q.id);
        (lembaga === "ARABIYAH"
          ? qismDigantiArabiyah
          : qismDigantiTuratsHufadz
        ).push(q.sakan);
      }
      if (qismCheckoutIds.length > 0 && !dryRun) {
        await prisma.ubudiyahQism.updateMany({
          where: { id: { in: qismCheckoutIds } },
          data: { isActive: false },
        });
      }

      // Sakan yang diharapkan mengisi absen: sakan berisi santri aktif
      // non-KSU dufah berjalan. Lembaga sakan ditentukan dari program
      // santri di dalamnya (ada satu santri Turats/Hufadz -> sakan ikut
      // kelompok Turats+Hufadz). Arabiyah hanya diharapkan mengisi
      // Subuh, Maghrib, Isya, Halaqoh — Dzuhur & Ashar TIDAK diharapkan
      // karena memang tidak ada jamaah di waktu tersebut.
      const santriMaster = await prisma.santriInternal.findMany({
        where: {
          isAktif: true,
          dufahNama: dufahAktif,
          sakan: { not: "-" },
          kategori: { not: "KSU" },
        },
        select: { id: true, sakan: true },
      });
      const masterIds = santriMaster.map((s) => s.id);
      const riwayatMaster =
        masterIds.length > 0
          ? await prisma.riwayatSantri.findMany({
              where: { santriId: { in: masterIds }, dufahNama: dufahAktif },
              select: { santriId: true, programId: true },
            })
          : [];
      const riwayatMasterBySantriId = new Map(
        riwayatMaster.map((r) => [r.santriId, r])
      );
      const masterProgramIds = Array.from(
        new Set(
          riwayatMaster.map((r) => r.programId).filter((x): x is string => !!x)
        )
      );
      const masterPrograms =
        masterProgramIds.length > 0
          ? await prisma.program.findMany({
              where: { id: { in: masterProgramIds } },
              select: { id: true, kategori: true },
            })
          : [];
      const masterKategoriByProgramId = new Map(
        masterPrograms.map((p) => [p.id, p.kategori])
      );
      const lembagaBySakan = new Map<string, "ARABIYAH" | "TURATS_HUFADZ">();
      for (const s of santriMaster) {
        const sakan = s.sakan;
        if (!sakan) continue;
        const r = riwayatMasterBySantriId.get(s.id);
        const programId = r?.programId ?? null;
        const lembaga = lembagaFromProgramKategori(
          programId
            ? (masterKategoriByProgramId.get(programId) ?? null)
            : null
        );
        if (lembaga !== "ARABIYAH") lembagaBySakan.set(sakan, "TURATS_HUFADZ");
        else if (!lembagaBySakan.has(sakan))
          lembagaBySakan.set(sakan, "ARABIYAH");
      }
      // Pasangan (sakan, tanggal, kegiatan) yang terisi: ada baris
      // UbudiyahHadir apa pun — yang diukur adalah Qism sudah mengisi
      // formulir atau belum, jadi baris KSU/checkout tetap dihitung.
      // Tanggal diambil dari barisnya sendiri (@db.Date -> Date
      // tengah malam UTC), bukan ditebak dari kegiatan: di jendela
      // 15:30 Dzuhur/Ashar itu hari ini, di jendela lama kemarin.
      const terisi = new Set<string>();
      for (const r of records) {
        const riwayat = riwayatById.get(r.riwayatId);
        if (!riwayat) continue;
        const santri = santriById.get(riwayat.santriId);
        if (!santri?.sakan) continue;
        const tanggalStr = r.tanggal.toISOString().slice(0, 10);
        terisi.add(`${santri.sakan}|${tanggalStr}|${r.kegiatan}`);
      }
      const kegiatanArabiyah = [
        UbudiyahKegiatan.SUBUH,
        UbudiyahKegiatan.MAGHRIB,
        UbudiyahKegiatan.ISYA,
        UbudiyahKegiatan.HALAQOH,
      ];
      // Tanggal yang diharapkan per kegiatan ikut jendela kelompok itu:
      // jendela 15:30 Turats+Hufadz = Subuh/Dzuhur/Ashar hari ini,
      // Maghrib/Isya/Halaqoh kemarin; jendela lama = hanya Subuh hari
      // ini, sisanya kemarin.
      const tanggalUntukKegiatan = (
        lembaga: "ARABIYAH" | "TURATS_HUFADZ",
        k: UbudiyahKegiatan
      ): string => {
        if (lembaga === "TURATS_HUFADZ" && turatsJendelaBaru) {
          return k === UbudiyahKegiatan.SUBUH ||
            k === UbudiyahKegiatan.DZUHUR ||
            k === UbudiyahKegiatan.ASHAR
            ? todayStr
            : yesterdayStr;
        }
        return k === UbudiyahKegiatan.SUBUH ? todayStr : yesterdayStr;
      };
      for (const [sakan, lembaga] of [...lembagaBySakan.entries()].sort(
        (a, b) => a[0].localeCompare(b[0], "id")
      )) {
        // Scope: sakan kelompok lain diperiksa jadwalnya sendiri.
        if (lembaga === "ARABIYAH" && !jalanArabiyah) continue;
        if (lembaga === "TURATS_HUFADZ" && !jalanTurats) continue;
        const kegiatanDiharapkan =
          lembaga === "ARABIYAH"
            ? kegiatanArabiyah
            : UBUDIYAH_KEGIATAN_ORDER;
        const hilang: UbudiyahKegiatan[] = [];
        for (const k of kegiatanDiharapkan) {
          const tanggalStr = tanggalUntukKegiatan(lembaga, k);
          if (!terisi.has(`${sakan}|${tanggalStr}|${k}`)) hilang.push(k);
        }
        if (hilang.length > 0) {
          (lembaga === "ARABIYAH"
            ? belumAbsenArabiyah
            : belumAbsenTuratsHufadz
          ).push({ sakan, kegiatan: hilang });
        }
      }
    }

    // Judul tanggal mengikuti harinya: kegiatan kemarin pakai tanggal
    // kemarin, kegiatan hari ini pakai judul baru tanggal hari ini
    // (satu pesan). Arabiyah tidak punya Dzuhur/Ashar, jadi subjudul
    // kemarinnya hanya Maghrib, Isya, Halaqoh. Turats 15:30: kemarin
    // hanya Maghrib/Isya/Halaqoh, Dzuhur/Ashar pindah ke hari ini.
    // Pesan kelompok yang tidak dijalankan = null (tidak dikirim).
    const kegiatanKemarinArabiyah = [
      UbudiyahKegiatan.MAGHRIB,
      UbudiyahKegiatan.ISYA,
      UbudiyahKegiatan.HALAQOH,
    ];
    const kegiatanKemarinTurats = turatsJendelaBaru
      ? UBUDIYAH_KEGIATAN_KEMARIN_1530
      : UBUDIYAH_KEGIATAN_KEMARIN;
    const messageArabiyah = jalanArabiyah
      ? formatUbudiyahReport(
          yesterdayLocal,
          todayLocal,
          lapArabiyah.masbuq,
          lapArabiyah.ghoib,
          kegiatanKemarinArabiyah,
          {
            adaAbsen: adaBarisArabiyah,
            belumAbsen: belumAbsenArabiyah,
            qismDiganti: qismDigantiArabiyah,
          }
        )
      : null;
    const messageTuratsHufadz = jalanTurats
      ? formatUbudiyahReport(
          yesterdayLocal,
          todayLocal,
          lapTuratsHufadz.masbuq,
          lapTuratsHufadz.ghoib,
          kegiatanKemarinTurats,
          {
            adaAbsen: adaBarisTuratsHufadz,
            belumAbsen: belumAbsenTuratsHufadz,
            qismDiganti: qismDigantiTuratsHufadz,
          }
        )
      : null;
    const messageLainnyaArabiyah =
      jalanArabiyah && lapArabiyah.lainnya.length > 0
        ? formatUbudiyahReportLainnya(
            yesterdayLocal,
            todayLocal,
            lapArabiyah.lainnya,
            kegiatanKemarinArabiyah
          )
        : null;
    const messageLainnyaTuratsHufadz =
      jalanTurats && lapTuratsHufadz.lainnya.length > 0
        ? formatUbudiyahReportLainnya(
            yesterdayLocal,
            todayLocal,
            lapTuratsHufadz.lainnya,
            kegiatanKemarinTurats
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
      if (messageArabiyah) {
        terkirimArabiyah = await kirim("6282338545762", messageArabiyah);
      }
      if (messageTuratsHufadz) {
        terkirimTuratsHufadz = await kirim("6285856262057", messageTuratsHufadz);
      }
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
      scope,
      tanggal: yesterdayStr,
      masbuq: lapArabiyah.masbuq.length,
      ghoib: lapArabiyah.ghoib.length,
      lainnya: lapArabiyah.lainnya.length,
      belumAbsen: belumAbsenArabiyah.length,
      qismDiganti: qismDigantiArabiyah,
      dilewatiArabiyah: !jalanArabiyah,
      terkirim: terkirimArabiyah,
      pesanLainnya: pesanLainnyaArabiyah,
      turatsHufadz: {
        masbuq: lapTuratsHufadz.masbuq.length,
        ghoib: lapTuratsHufadz.ghoib.length,
        lainnya: lapTuratsHufadz.lainnya.length,
        belumAbsen: belumAbsenTuratsHufadz.length,
        qismDiganti: qismDigantiTuratsHufadz,
        dilewati: !jalanTurats,
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
