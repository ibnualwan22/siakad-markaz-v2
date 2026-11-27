// Data Syahadah Non-Kelas Terpadu (F4 Landscape 330 x 215 mm) — SERVER ONLY.
// Menangani 6 jenis syahadah non-kelas:
// 1. Nadi Hufadz
// 2. Lajnah
// 3. OSIM
// 4. Tadrib Funun (per jenis)
// 5. CAC
// 6. Martabah Ula (Markaz Arabiyah & Markaz Turats)

import prisma from "@/lib/prisma";
import {
  getCertificateData,
  getDashboardSantriRows,
  getTemplateData,
} from "@/lib/app-data";
import { getActiveDufahName } from "@/lib/absensi";
import { getBaseUrl } from "@/lib/base-url";
import { formatJuzTeks, formatPeriodeArab } from "@/lib/nadi-hufadz";
import {
  resolveTadribFununMinHadir,
  templateProgramKey as tadribProgramKey,
} from "@/lib/tadrib-funun";
import { getTanggalSyahadahOrganisasi } from "@/lib/syahadah-organisasi";
import { resolveMudirForLembaga } from "@/lib/syahadah-offline";
import {
  NON_KELAS_KEY_CAC,
  NON_KELAS_KEY_MARTABAH_ARABIYAH,
  NON_KELAS_KEY_MARTABAH_TURATS,
  defaultFallbackBackgroundForNonKelas,
  normalizeNonKelasPositions,
  type NonKelasFieldCfg,
} from "@/lib/syahadah-non-kelas";

export type NonKelasCatalogItem = {
  programKey: string;
  group: string;
  label: string;
  sublabel: string;
  bulkFilter: string;
  count: number;
};

export type NonKelasPrintItem = {
  id: string;
  programKey: string;
  jenisLabel: string;
  nama: string;
  subtitle?: string;
  texts: Record<string, string>;
  qrUrl?: string | null;
  signatureUrl?: string | null;
  stampUrl?: string | null;
  template: {
    backgroundUrl: string | null;
    fieldPositions: Record<string, NonKelasFieldCfg>;
    locked: boolean;
    offsetX: number;
    offsetY: number;
  };
};

export type BulkNonKelasPrintResult = {
  scopeLabel: string;
  jenisFilter: string;
  items: NonKelasPrintItem[];
  summary: Array<{
    programKey: string;
    label: string;
    count: number;
  }>;
};

function buildTemplatePayload(programKey: string, tpl: any) {
  return {
    backgroundUrl:
      tpl?.backgroundUrl ?? defaultFallbackBackgroundForNonKelas(programKey),
    fieldPositions: normalizeNonKelasPositions(
      programKey,
      (tpl?.fieldPositions as any) || null,
    ),
    locked: Boolean(tpl?.locked),
    offsetX: Number(tpl?.offsetX) || 0,
    offsetY: Number(tpl?.offsetY) || 0,
  };
}

/** Hitung pemenang Martabah Ula (1 santri terbaik per program di cohort aktif). */
async function getMartabahTopSantri() {
  const allRows = await getDashboardSantriRows();
  const completed = allRows.filter(
    (s: any) =>
      s.isAktif && s.canViewIjazah && s.statusKelulusan !== "TIDAK_LULUS",
  );
  const byProgram = new Map<string, any[]>();
  for (const s of completed) {
    const pid = s.programId ?? "unknown";
    if (!byProgram.has(pid)) byProgram.set(pid, []);
    byProgram.get(pid)!.push(s);
  }
  const tops: any[] = [];
  for (const list of byProgram.values()) {
    list.sort((a: any, b: any) => b.average - a.average);
    if (list.length > 0) tops.push(list[0]);
  }
  tops.sort((a: any, b: any) =>
    (a.programNama ?? "").localeCompare(b.programNama ?? "", "id"),
  );
  return tops;
}

/** Ambil atau buat nomor seri CAC secara idempotent & sekuensial per riwayatId. */
export async function ensureCacSerial(
  riwayatId: string,
  tglCetakIndo?: string | null,
): Promise<string> {
  const existing = await prisma.syahadahCacRecord.findUnique({
    where: { riwayatId },
  });
  if (existing) return existing.serialNumber;

  let tahunCetak = new Date().getFullYear();
  if (tglCetakIndo) {
    const m = tglCetakIndo.match(/\d{4}/);
    if (m) tahunCetak = parseInt(m[0], 10);
  }

  const created = await prisma.$transaction(async (tx) => {
    const check = await tx.syahadahCacRecord.findUnique({
      where: { riwayatId },
    });
    if (check) return check;
    const last = await tx.syahadahCacRecord.findFirst({
      where: { tahunCetak },
      orderBy: { urutan: "desc" },
    });
    const nextUrutan = last ? last.urutan + 1 : 1;
    const serialNumber = `No.:C.AC/MA/${tahunCetak}/${String(nextUrutan).padStart(4, "0")}`;
    return tx.syahadahCacRecord.create({
      data: { riwayatId, serialNumber, tahunCetak, urutan: nextUrutan },
    });
  });
  return created.serialNumber;
}

/** Katalog semua jenis Syahadah Non-Kelas beserta jumlah penerima siap cetak duf'ah aktif. */
export async function getNonKelasCatalog(): Promise<NonKelasCatalogItem[]> {
  const [
    activeDufah,
    tadribJenisList,
    nadiCount,
    lajnahCount,
    osimCount,
    tadribPesertaList,
    martabahTops,
  ] = await Promise.all([
    getActiveDufahName(),
    prisma.tadribFununJenis.findMany({
      where: { isActive: true },
      orderBy: { nama: "asc" },
    }),
    getActiveDufahName().then((dufah) =>
      prisma.nadiHufadzPeserta.count({
        where: {
          ...(dufah ? { dufahNama: dufah } : {}),
          tasmi: { isNot: null },
        },
      }),
    ),
    getActiveDufahName().then((dufah) =>
      prisma.anggotaLajnah.count({
        where: dufah ? { dufahNama: dufah } : undefined,
      }),
    ),
    getActiveDufahName().then((dufah) =>
      prisma.anggotaOsim.count({
        where: dufah ? { dufahNama: dufah } : undefined,
      }),
    ),
    getActiveDufahName().then((dufah) =>
      prisma.tadribFununPeserta.findMany({
        where: {
          ...(dufah ? { dufahNama: dufah } : {}),
          syahadahDiterbitkanAt: { not: null },
        },
        include: {
          jenis: { select: { id: true, minHadir: true } },
          _count: { select: { hadir: true } },
        },
      }),
    ),
    getMartabahTopSantri(),
  ]);

  const tadribCountByJenis = new Map<string, number>();
  for (const p of tadribPesertaList) {
    const min = resolveTadribFununMinHadir(p.jenis.minHadir);
    if (p._count.hadir >= min) {
      tadribCountByJenis.set(
        p.jenisId,
        (tadribCountByJenis.get(p.jenisId) ?? 0) + 1,
      );
    }
  }

  const martabahArabiyahCount = martabahTops.filter(
    (s: any) => s.programKategori !== "TURATS",
  ).length;
  const martabahTuratsCount = martabahTops.filter(
    (s: any) => s.programKategori === "TURATS",
  ).length;
  const cacCount = martabahTops.length;

  const dufahLabel = activeDufah || "Periode Aktif";

  const items: NonKelasCatalogItem[] = [
    {
      programKey: "nadi-hufadz",
      group: "Program Khusus",
      label: "Nadi Hufadz",
      sublabel: `Peserta lulus tasmi' (${dufahLabel})`,
      bulkFilter: "nadi-hufadz",
      count: nadiCount,
    },
    {
      programKey: "lajnah",
      group: "Organisasi",
      label: "Lajnah",
      sublabel: `Pengurus Lajnah (${dufahLabel})`,
      bulkFilter: "lajnah",
      count: lajnahCount,
    },
    {
      programKey: "osim",
      group: "Organisasi",
      label: "OSIM",
      sublabel: `Pengurus OSIM (${dufahLabel})`,
      bulkFilter: "osim",
      count: osimCount,
    },
    ...tadribJenisList.map((j) => ({
      programKey: tadribProgramKey(j.id),
      group: "Tadrib Funun",
      label: `Tadrib Funun — ${j.nama}`,
      sublabel: `Syahadah diterbitkan (${dufahLabel})`,
      bulkFilter: tadribProgramKey(j.id),
      count: tadribCountByJenis.get(j.id) ?? 0,
    })),
    {
      programKey: NON_KELAS_KEY_CAC,
      group: "Penghargaan",
      label: "Sertifikat CAC",
      sublabel: `Juara 1 tiap program (${dufahLabel})`,
      bulkFilter: "cac",
      count: cacCount,
    },
    {
      programKey: NON_KELAS_KEY_MARTABAH_ARABIYAH,
      group: "Penghargaan",
      label: "Martabah Ula — Markaz Arabiyah",
      sublabel: `Juara 1 program Arabiyah (${dufahLabel})`,
      bulkFilter: "martabah-arabiyah",
      count: martabahArabiyahCount,
    },
    {
      programKey: NON_KELAS_KEY_MARTABAH_TURATS,
      group: "Penghargaan",
      label: "Martabah Ula — Markaz Turats",
      sublabel: `Juara 1 program Turats (${dufahLabel})`,
      bulkFilter: "martabah-turats",
      count: martabahTuratsCount,
    },
  ];

  return items;
}

/** Data dummy untuk Editor & Cetak Tes tiap jenis Syahadah Non-Kelas. */
export async function getNonKelasDummyData(
  programKey: string,
): Promise<NonKelasPrintItem | null> {
  const [tpl, syahadahTpl, orgDates, baseUrl] = await Promise.all([
    prisma.templateCetak.findUnique({ where: { programKey } }),
    getTemplateData(),
    getTanggalSyahadahOrganisasi(),
    getBaseUrl(),
  ]);

  const mudirArab = resolveMudirForLembaga(syahadahTpl as any, "ARABIYAH");
  const mudirTurats = resolveMudirForLembaga(syahadahTpl as any, "TURATS");
  const template = buildTemplatePayload(programKey, tpl);

  if (programKey === "nadi-hufadz") {
    return {
      id: "dummy-nadi-hufadz",
      programKey,
      jenisLabel: "Nadi Hufadz",
      nama: "Ahmad Ibnu Alwan",
      texts: {
        nama: "Ahmad Ibnu Alwan",
        juz: "١-٣",
        predikat: "ممتاز",
        periode: "١١ أكتوبر إلى ٥ نوفمبر ٢٠٢٦",
      },
      template,
    };
  }

  if (programKey === "lajnah" || programKey === "osim") {
    return {
      id: `dummy-${programKey}`,
      programKey,
      jenisLabel: programKey === "lajnah" ? "Lajnah" : "OSIM",
      nama: "Ahmad Ibnu Alwan",
      texts: {
        nama: "Ahmad Ibnu Alwan",
        periode: orgDates.periode,
        tglCetak: orgDates.tglCetak,
      },
      template,
    };
  }

  if (programKey.startsWith("tadrib-funun-")) {
    const jenisId = programKey.replace("tadrib-funun-", "");
    const jenis = await prisma.tadribFununJenis.findUnique({
      where: { id: jenisId },
      select: { nama: true },
    });
    return {
      id: `dummy-${programKey}`,
      programKey,
      jenisLabel: jenis ? `Tadrib Funun — ${jenis.nama}` : "Tadrib Funun",
      nama: "Ahmad Ibnu Alwan",
      texts: {
        nama: "Ahmad Ibnu Alwan",
        periode: "١١ أكتوبر إلى ٥ نوفمبر ٢٠٢٦",
      },
      template,
    };
  }

  if (programKey === NON_KELAS_KEY_CAC) {
    return {
      id: "dummy-cac",
      programKey,
      jenisLabel: "Sertifikat CAC",
      nama: "Ahmad Ibnu Alwan",
      texts: {
        serialNumber: `No.:C.AC/MA/${new Date().getFullYear()}/0001`,
        nama: "AHMAD IBNU ALWAN\nC.AC.",
        tglCetak: `Issued in Pare\n${syahadahTpl.tgl_cetak_indo}`,
      },
      qrUrl: `${baseUrl}/cac/preview`,
      template,
    };
  }

  if (programKey === NON_KELAS_KEY_MARTABAH_ARABIYAH) {
    return {
      id: "dummy-martabah-arabiyah",
      programKey,
      jenisLabel: "Martabah Ula — Markaz Arabiyah",
      nama: "Ahmad Ibnu Alwan",
      texts: {
        pembuka: "يقدم مركز العربية الجائزة إلى الطالب/ة المتفوق/ة:",
        nama: "Ahmad Ibnu Alwan",
        keterangan:
          "لحصوله/ها على الامتياز مع مرتبة الشرف الأولى في برنامج إعداد أول\nيحصل على المنحة الدراسية للبرنامج التالي بقيمة ٤٢٥.٠٠٠ روبية\n(تجري لمدة ٦ أشهر من صدرها)",
        jabatanMudir: syahadahTpl.jabatan_mudir_arab || "مدير مركز العربية",
        namaMudir: mudirArab.namaArab,
        tglCetak: `${syahadahTpl.tgl_cetak_arab} م`,
      },
      signatureUrl: mudirArab.signatureUrl,
      stampUrl: "/images/stamp.png",
      template,
    };
  }

  if (programKey === NON_KELAS_KEY_MARTABAH_TURATS) {
    const namaMudirTuratsIndo =
      (syahadahTpl as any).nama_mudir_turats || "Ustadz Abdul Wahhab, M.Pd.";
    const jabatanMudirTurats =
      (syahadahTpl as any).jabatan_mudir_turats || "Direktur Markaz Turats";
    return {
      id: "dummy-martabah-turats",
      programKey,
      jenisLabel: "Martabah Ula — Markaz Turats",
      nama: "Ahmad Ibnu Alwan",
      texts: {
        pembuka:
          "Markaz Turats memberikan penghargaan kepada mahasiswa berprestasi:",
        nama: "Ahmad Ibnu Alwan",
        keterangan:
          "sebagai Peringkat Satu dengan Predikat Istimewa pada program Marhalah 1",
        beasiswa:
          "sehingga berhak menerima beasiswa untuk program selanjutnya senilai Rp.425.000\n(masa berlaku 6 bulan sejak sertifikat ini diterbitkan).",
        tglCetak: `Diterbitkan di Pare, ${syahadahTpl.tgl_cetak_indo}`,
        jabatanMudir: jabatanMudirTurats,
        namaMudir: namaMudirTuratsIndo,
      },
      signatureUrl: mudirTurats.signatureUrl,
      stampUrl: "/images/stempel-turats.png",
      template,
    };
  }

  return null;
}

/** Data cetak SATUAN untuk semua jenis Syahadah Non-Kelas. */
export async function getNonKelasSinglePrintData(
  programKey: string,
  id: string,
): Promise<NonKelasPrintItem | null> {
  const [tpl, syahadahTpl, baseUrl] = await Promise.all([
    prisma.templateCetak.findUnique({ where: { programKey } }),
    getTemplateData(),
    getBaseUrl(),
  ]);

  if (programKey === "lajnah" || programKey === "osim") {
    const anggota =
      programKey === "lajnah"
        ? await prisma.anggotaLajnah.findUnique({
            where: { id },
            include: { santri: { select: { nama: true } } },
          })
        : await prisma.anggotaOsim.findUnique({
            where: { id },
            include: { santri: { select: { nama: true } } },
          });
    if (!anggota) return null;
    const { periode, tglCetak } = await getTanggalSyahadahOrganisasi();
    return {
      id: anggota.id,
      programKey,
      jenisLabel: programKey === "lajnah" ? "Lajnah" : "OSIM",
      nama: anggota.santri.nama || "-",
      texts: {
        nama: anggota.santri.nama || "-",
        periode,
        tglCetak,
      },
      template: buildTemplatePayload(programKey, tpl),
    };
  }

  if (programKey === "nadi-hufadz") {
    const peserta = await prisma.nadiHufadzPeserta.findUnique({
      where: { id },
      include: {
        santri: { select: { nama: true } },
        setoran: { orderBy: { pertemuanKe: "asc" }, select: { tanggal: true } },
        tasmi: true,
      },
    });
    if (!peserta || !peserta.tasmi) return null;
    const tglDari = peserta.setoran.length
      ? peserta.setoran[0].tanggal.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const tglSampai = peserta.tasmi.tanggal.toISOString().slice(0, 10);
    return {
      id: peserta.id,
      programKey,
      jenisLabel: "Nadi Hufadz",
      nama: peserta.santri.nama || "-",
      texts: {
        nama: peserta.santri.nama || "-",
        juz: formatJuzTeks(peserta.tasmi.juzTeks),
        predikat: peserta.tasmi.predikat,
        periode: formatPeriodeArab(tglDari, tglSampai),
      },
      template: buildTemplatePayload(programKey, tpl),
    };
  }

  if (programKey.startsWith("tadrib-funun-")) {
    const peserta = await prisma.tadribFununPeserta.findUnique({
      where: { id },
      include: {
        santri: { select: { nama: true } },
        jenis: { select: { id: true, nama: true, minHadir: true } },
        hadir: { orderBy: { pertemuanKe: "asc" }, select: { tanggal: true } },
      },
    });
    if (!peserta) return null;
    if (tadribProgramKey(peserta.jenis.id) !== programKey) return null;
    if (peserta.hadir.length < resolveTadribFununMinHadir(peserta.jenis.minHadir)) {
      return null;
    }
    if (!peserta.syahadahDiterbitkanAt) return null;
    const tglDari = peserta.hadir.length
      ? peserta.hadir[0].tanggal.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const tglSampai = peserta.hadir.length
      ? peserta.hadir[peserta.hadir.length - 1].tanggal.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return {
      id: peserta.id,
      programKey,
      jenisLabel: `Tadrib Funun — ${peserta.jenis.nama}`,
      nama: peserta.santri.nama || "-",
      texts: {
        nama: peserta.santri.nama || "-",
        periode: formatPeriodeArab(tglDari, tglSampai),
      },
      template: buildTemplatePayload(programKey, tpl),
    };
  }

  if (
    programKey === NON_KELAS_KEY_CAC ||
    programKey === NON_KELAS_KEY_MARTABAH_ARABIYAH ||
    programKey === NON_KELAS_KEY_MARTABAH_TURATS
  ) {
    const cert: any = await getCertificateData(id);
    if (!cert || !cert.riwayatSantri || !cert.program) return null;

    if (programKey === NON_KELAS_KEY_CAC) {
      const serialNumber = await ensureCacSerial(
        cert.riwayatSantri.id,
        syahadahTpl.tgl_cetak_indo,
      );
      return {
        id: cert.riwayatSantri.id,
        programKey,
        jenisLabel: "Sertifikat CAC",
        nama: cert.masterSantri?.nama || "-",
        subtitle: cert.program.nama_indo,
        texts: {
          serialNumber,
          nama: `${(cert.masterSantri?.nama || "-").toUpperCase()}\nC.AC.`,
          tglCetak: `Issued in Pare\n${syahadahTpl.tgl_cetak_indo}`,
        },
        qrUrl: `${baseUrl}/cac/${cert.riwayatSantri.id}`,
        template: buildTemplatePayload(programKey, tpl),
      };
    }

    if (programKey === NON_KELAS_KEY_MARTABAH_TURATS) {
      const mudirTurats = resolveMudirForLembaga(syahadahTpl as any, "TURATS");
      const namaMudirTuratsIndo =
        (syahadahTpl as any).nama_mudir_turats || "Ustadz Abdul Wahhab, M.Pd.";
      const jabatanMudirTurats =
        (syahadahTpl as any).jabatan_mudir_turats || "Direktur Markaz Turats";
      return {
        id: cert.riwayatSantri.id,
        programKey,
        jenisLabel: "Martabah Ula — Markaz Turats",
        nama: cert.masterSantri?.nama || "-",
        subtitle: cert.program.nama_indo,
        texts: {
          pembuka:
            "Markaz Turats memberikan penghargaan kepada mahasiswa berprestasi:",
          nama: cert.masterSantri?.nama || "-",
          keterangan: `sebagai Peringkat Satu dengan Predikat Istimewa pada program ${cert.program.nama_indo}`,
          beasiswa:
            "sehingga berhak menerima beasiswa untuk program selanjutnya senilai Rp.425.000\n(masa berlaku 6 bulan sejak sertifikat ini diterbitkan).",
          tglCetak: `Diterbitkan di Pare, ${syahadahTpl.tgl_cetak_indo}`,
          jabatanMudir: jabatanMudirTurats,
          namaMudir: namaMudirTuratsIndo,
        },
        signatureUrl: mudirTurats.signatureUrl,
        stampUrl: "/images/stempel-turats.png",
        template: buildTemplatePayload(programKey, tpl),
      };
    }

    // Martabah Arabiyah
    const mudirArab = resolveMudirForLembaga(syahadahTpl as any, "ARABIYAH");
    return {
      id: cert.riwayatSantri.id,
      programKey,
      jenisLabel: "Martabah Ula — Markaz Arabiyah",
      nama: cert.masterSantri?.nama || "-",
      subtitle: cert.program.nama_indo,
      texts: {
        pembuka: "يقدم مركز العربية الجائزة إلى الطالب/ة المتفوق/ة:",
        nama: cert.masterSantri?.nama || "-",
        keterangan: `لحصوله/ها على الامتياز مع مرتبة الشرف الأولى في برنامج ${cert.program.nama_arab || cert.program.nama_indo}\nيحصل على المنحة الدراسية للبرنامج التالي بقيمة ٤٢٥.٠٠٠ روبية\n(تجري لمدة ٦ أشهر من صدرها)`,
        jabatanMudir: syahadahTpl.jabatan_mudir_arab || "مدير مركز العربية",
        namaMudir: mudirArab.namaArab,
        tglCetak: `${syahadahTpl.tgl_cetak_arab} م`,
      },
      signatureUrl: mudirArab.signatureUrl,
      stampUrl: "/images/stamp.png",
      template: buildTemplatePayload(programKey, tpl),
    };
  }

  return null;
}

/**
 * Cetak Bulk Syahadah Non-Kelas (F4 Landscape):
 * - jenisFilter = "ALL" / null -> Global SEMUA 6 jenis non-kelas sekaligus!
 * - jenisFilter = "nadi-hufadz" | "lajnah" | "osim" | "tadrib-funun" |
 *   "tadrib-funun-<jenisId>" | "cac" | "martabah-ula" |
 *   "martabah-arabiyah" | "martabah-turats" -> Bulk per jenis.
 */
export async function getNonKelasBulkPrintData(
  jenisFilter?: string | null,
): Promise<BulkNonKelasPrintResult> {
  const filter = (jenisFilter || "ALL").trim();
  const isAll = filter === "ALL" || filter === "";

  const [activeDufah, syahadahTpl, orgDates, templatesList, baseUrl] =
    await Promise.all([
      getActiveDufahName(),
      getTemplateData(),
      getTanggalSyahadahOrganisasi(),
      prisma.templateCetak.findMany(),
      getBaseUrl(),
    ]);

  const tplMap = new Map(templatesList.map((t) => [t.programKey, t]));
  const items: NonKelasPrintItem[] = [];

  const includeNadi = isAll || filter === "nadi-hufadz";
  const includeLajnah = isAll || filter === "lajnah";
  const includeOsim = isAll || filter === "osim";
  const includeTadrib =
    isAll || filter === "tadrib-funun" || filter.startsWith("tadrib-funun-");
  const includeCac = isAll || filter === "cac" || filter === NON_KELAS_KEY_CAC;
  const includeMartabahArab =
    isAll ||
    filter === "martabah-ula" ||
    filter === "martabah-arabiyah" ||
    filter === NON_KELAS_KEY_MARTABAH_ARABIYAH;
  const includeMartabahTurats =
    isAll ||
    filter === "martabah-ula" ||
    filter === "martabah-turats" ||
    filter === NON_KELAS_KEY_MARTABAH_TURATS;

  // 1. Nadi Hufadz
  if (includeNadi) {
    const list = await prisma.nadiHufadzPeserta.findMany({
      where: {
        ...(activeDufah ? { dufahNama: activeDufah } : {}),
        tasmi: { isNot: null },
      },
      include: {
        santri: { select: { nama: true } },
        setoran: { orderBy: { pertemuanKe: "asc" }, select: { tanggal: true } },
        tasmi: true,
      },
      orderBy: { santri: { nama: "asc" } },
    });
    const template = buildTemplatePayload("nadi-hufadz", tplMap.get("nadi-hufadz"));
    for (const p of list) {
      if (!p.tasmi) continue;
      const tglDari = p.setoran.length
        ? p.setoran[0].tanggal.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const tglSampai = p.tasmi.tanggal.toISOString().slice(0, 10);
      items.push({
        id: `nadi-${p.id}`,
        programKey: "nadi-hufadz",
        jenisLabel: "Nadi Hufadz",
        nama: p.santri.nama || "-",
        texts: {
          nama: p.santri.nama || "-",
          juz: formatJuzTeks(p.tasmi.juzTeks),
          predikat: p.tasmi.predikat,
          periode: formatPeriodeArab(tglDari, tglSampai),
        },
        template,
      });
    }
  }

  // 2. Lajnah
  if (includeLajnah) {
    const list = await prisma.anggotaLajnah.findMany({
      where: activeDufah ? { dufahNama: activeDufah } : undefined,
      include: { santri: { select: { nama: true } } },
      orderBy: { santri: { nama: "asc" } },
    });
    const template = buildTemplatePayload("lajnah", tplMap.get("lajnah"));
    for (const a of list) {
      items.push({
        id: `lajnah-${a.id}`,
        programKey: "lajnah",
        jenisLabel: "Lajnah",
        nama: a.santri.nama || "-",
        texts: {
          nama: a.santri.nama || "-",
          periode: orgDates.periode,
          tglCetak: orgDates.tglCetak,
        },
        template,
      });
    }
  }

  // 3. OSIM
  if (includeOsim) {
    const list = await prisma.anggotaOsim.findMany({
      where: activeDufah ? { dufahNama: activeDufah } : undefined,
      include: { santri: { select: { nama: true } } },
      orderBy: { santri: { nama: "asc" } },
    });
    const template = buildTemplatePayload("osim", tplMap.get("osim"));
    for (const a of list) {
      items.push({
        id: `osim-${a.id}`,
        programKey: "osim",
        jenisLabel: "OSIM",
        nama: a.santri.nama || "-",
        texts: {
          nama: a.santri.nama || "-",
          periode: orgDates.periode,
          tglCetak: orgDates.tglCetak,
        },
        template,
      });
    }
  }

  // 4. Tadrib Funun
  if (includeTadrib) {
    const specificJenisId = filter.startsWith("tadrib-funun-")
      ? filter.replace("tadrib-funun-", "")
      : null;
    const list = await prisma.tadribFununPeserta.findMany({
      where: {
        ...(activeDufah ? { dufahNama: activeDufah } : {}),
        ...(specificJenisId ? { jenisId: specificJenisId } : {}),
        syahadahDiterbitkanAt: { not: null },
      },
      include: {
        santri: { select: { nama: true } },
        jenis: { select: { id: true, nama: true, minHadir: true } },
        hadir: { orderBy: { pertemuanKe: "asc" }, select: { tanggal: true } },
      },
      orderBy: [{ jenis: { nama: "asc" } }, { santri: { nama: "asc" } }],
    });
    for (const p of list) {
      const min = resolveTadribFununMinHadir(p.jenis.minHadir);
      if (p.hadir.length < min) continue;
      const pKey = tadribProgramKey(p.jenis.id);
      const tglDari = p.hadir.length
        ? p.hadir[0].tanggal.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const tglSampai = p.hadir.length
        ? p.hadir[p.hadir.length - 1].tanggal.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      items.push({
        id: `tadrib-${p.id}`,
        programKey: pKey,
        jenisLabel: `Tadrib Funun — ${p.jenis.nama}`,
        nama: p.santri.nama || "-",
        texts: {
          nama: p.santri.nama || "-",
          periode: formatPeriodeArab(tglDari, tglSampai),
        },
        template: buildTemplatePayload(pKey, tplMap.get(pKey)),
      });
    }
  }

  // 5 & 6. CAC & Martabah Ula
  if (includeCac || includeMartabahArab || includeMartabahTurats) {
    const tops = await getMartabahTopSantri();
    const certs = (
      await Promise.all(
        tops.map(async (s) => {
          const cert: any = await getCertificateData(s.id);
          if (!cert || !cert.riwayatSantri || !cert.program) return null;
          return cert;
        }),
      )
    ).filter((c): c is NonNullable<typeof c> => c !== null);

    // 5. CAC (pra-assign serial sekuensial!)
    if (includeCac) {
      const template = buildTemplatePayload(
        NON_KELAS_KEY_CAC,
        tplMap.get(NON_KELAS_KEY_CAC),
      );
      for (const cert of certs) {
        const serialNumber = await ensureCacSerial(
          cert.riwayatSantri.id,
          syahadahTpl.tgl_cetak_indo,
        );
        items.push({
          id: `cac-${cert.riwayatSantri.id}`,
          programKey: NON_KELAS_KEY_CAC,
          jenisLabel: "Sertifikat CAC",
          nama: cert.masterSantri?.nama || "-",
          subtitle: cert.program.nama_indo,
          texts: {
            serialNumber,
            nama: `${(cert.masterSantri?.nama || "-").toUpperCase()}\nC.AC.`,
            tglCetak: `Issued in Pare\n${syahadahTpl.tgl_cetak_indo}`,
          },
          qrUrl: `${baseUrl}/cac/${cert.riwayatSantri.id}`,
          template,
        });
      }
    }

    // 6a. Martabah Ula — Arabiyah
    if (includeMartabahArab) {
      const template = buildTemplatePayload(
        NON_KELAS_KEY_MARTABAH_ARABIYAH,
        tplMap.get(NON_KELAS_KEY_MARTABAH_ARABIYAH),
      );
      const mudirArab = resolveMudirForLembaga(syahadahTpl as any, "ARABIYAH");
      for (const cert of certs) {
        if ((cert.program as any)?.kategori === "TURATS") continue;
        items.push({
          id: `martabah-arab-${cert.riwayatSantri.id}`,
          programKey: NON_KELAS_KEY_MARTABAH_ARABIYAH,
          jenisLabel: "Martabah Ula — Markaz Arabiyah",
          nama: cert.masterSantri?.nama || "-",
          subtitle: cert.program.nama_indo,
          texts: {
            pembuka: "يقدم مركز العربية الجائزة إلى الطالب/ة المتفوق/ة:",
            nama: cert.masterSantri?.nama || "-",
            keterangan: `لحصوله/ها على الامتياز مع مرتبة الشرف الأولى في برنامج ${cert.program.nama_arab || cert.program.nama_indo}\nيحصل على المنحة الدراسية للبرنامج التالي بقيمة ٤٢٥.٠٠٠ روبية\n(تجري لمدة ٦ أشهر من صدرها)`,
            jabatanMudir: syahadahTpl.jabatan_mudir_arab || "مدير مركز العربية",
            namaMudir: mudirArab.namaArab,
            tglCetak: `${syahadahTpl.tgl_cetak_arab} م`,
          },
          signatureUrl: mudirArab.signatureUrl,
          stampUrl: "/images/stamp.png",
          template,
        });
      }
    }

    // 6b. Martabah Ula — Turats
    if (includeMartabahTurats) {
      const template = buildTemplatePayload(
        NON_KELAS_KEY_MARTABAH_TURATS,
        tplMap.get(NON_KELAS_KEY_MARTABAH_TURATS),
      );
      const mudirTurats = resolveMudirForLembaga(syahadahTpl as any, "TURATS");
      const namaMudirTuratsIndo =
        (syahadahTpl as any).nama_mudir_turats || "Ustadz Abdul Wahhab, M.Pd.";
      const jabatanMudirTurats =
        (syahadahTpl as any).jabatan_mudir_turats || "Direktur Markaz Turats";
      for (const cert of certs) {
        if ((cert.program as any)?.kategori !== "TURATS") continue;
        items.push({
          id: `martabah-turats-${cert.riwayatSantri.id}`,
          programKey: NON_KELAS_KEY_MARTABAH_TURATS,
          jenisLabel: "Martabah Ula — Markaz Turats",
          nama: cert.masterSantri?.nama || "-",
          subtitle: cert.program.nama_indo,
          texts: {
            pembuka:
              "Markaz Turats memberikan penghargaan kepada mahasiswa berprestasi:",
            nama: cert.masterSantri?.nama || "-",
            keterangan: `sebagai Peringkat Satu dengan Predikat Istimewa pada program ${cert.program.nama_indo}`,
            beasiswa:
              "sehingga berhak menerima beasiswa untuk program selanjutnya senilai Rp.425.000\n(masa berlaku 6 bulan sejak sertifikat ini diterbitkan).",
            tglCetak: `Diterbitkan di Pare, ${syahadahTpl.tgl_cetak_indo}`,
            jabatanMudir: jabatanMudirTurats,
            namaMudir: namaMudirTuratsIndo,
          },
          signatureUrl: mudirTurats.signatureUrl,
          stampUrl: "/images/stempel-turats.png",
          template,
        });
      }
    }
  }

  // Ringkasan jumlah per jenis
  const summaryMap = new Map<
    string,
    { programKey: string; label: string; count: number }
  >();
  for (const it of items) {
    const cur = summaryMap.get(it.programKey);
    if (cur) cur.count++;
    else {
      summaryMap.set(it.programKey, {
        programKey: it.programKey,
        label: it.jenisLabel,
        count: 1,
      });
    }
  }

  let scopeLabel = "Global Semua Syahadah Non-Kelas";
  if (!isAll) {
    const first = [...summaryMap.values()][0];
    scopeLabel = first ? first.label : `Non-Kelas (${filter})`;
  }

  return {
    scopeLabel,
    jenisFilter: filter,
    items,
    summary: [...summaryMap.values()],
  };
}
