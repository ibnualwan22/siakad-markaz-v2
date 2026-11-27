// Data syahadah offline — SERVER ONLY (mengimpor prisma/app-data/qrcode).
// Dipakai halaman cetak admin (/cetak-offline/[id]), cetak bulk (/cetak-offline/bulk),
// cetak tes (/cetak-offline/tes/[programKey]), cetak munaqosah hufadz
// (/cetak-template/munaqosah-hufadz/[id]), dan halaman unduh santri
// (/santri/syahadah-offline/[riwayatId]).

import prisma from "@/lib/prisma";
import {
  getCertificateData,
  getDashboardSantriRows,
  getTemplateData,
} from "@/lib/app-data";
import { getMasterSantriList } from "@/lib/santri-api";
import { getBaseUrl } from "@/lib/base-url";
import { getPredikat, getPredikatTurats } from "@/lib/formatters";
import {
  applyNilaiTambahan,
  calcAkbarnasMapelAverage,
  calcAkumulatif,
  calcMapelNilaiAkhir,
  calcMapelNilaiAkhirUsbuain2,
} from "@/lib/grade-calculator";
import {
  lembagaFromProgramKategori,
  type LembagaId,
} from "@/lib/lembaga";
import {
  MUNAQOSAH_NILAI_FIELDS,
  hitungNilaiAkhir as hitungNilaiAkhirHufadz,
  isMusyarokah as isMusyarokahHufadz,
  predikatArab as predikatArabHufadz,
  toArabDigits,
} from "@/lib/munaqosah-hufadz";
import {
  baseSlugFromOfflineKey,
  defaultFieldPositionsOffline,
  formatAngkaArab,
  formatTanggalLahirIndo,
  isLembagaGlobalKey,
  isMusyarokahProgramKey,
  lembagaFromGlobalKey,
  offlineLembagaKey,
  offlineMusyarokahProgramKey,
  offlineProgramKey,
  parseTanggalIndo,
  resolveMudirForLembaga,
  slugifyProgram,
  sortSyahadahSantri,
  tahunHijriDari,
  tahunMiladiDari,
  tanpaTahunAkhir,
} from "@/lib/syahadah-offline";
import { lembagaLabel } from "@/lib/lembaga";

export type OfflinePrintData = {
  riwayatId: string;
  nama: string;
  programKey: string;
  programNamaArab: string;
  programNamaIndo: string;
  kelasNama: string;
  gender: string;
  nilaiAkumulatif: number;
  lembaga: LembagaId;
  isMusyarokah: boolean;
  isHufadz: boolean;
  signatureUrl: string;
  texts: Record<string, string>;
  qrDataUrl: string | null;
  qrUrl: string;
  // SELALU objek (tidak pernah null): bila baris TemplateCetak belum ada,
  // fieldPositions diisi posisi seed default + backgroundUrl null — field
  // tetap tampil, pesan "belum memiliki background" tetap tampil.
  template: {
    backgroundUrl: string | null;
    fieldPositions: Record<string, any>;
    locked: boolean;
    offsetX: number;
    offsetY: number;
  };
  // Jumlah slot mapel & nilai yang dirender (slot 1..slotCount) = jumlah
  // mapel tampil program itu (atau 4 kriteria untuk Munaqosah Hufadz).
  slotCount: number;
};

/** Ambil QR verifikasi sebagai data URL (gambar PNG, aman untuk print dan
 *  tangkapan PNG html2canvas). Tanpa logo di tengah. */
async function buildQrDataUrl(verifyUrl: string): Promise<string | null> {
  try {
    const mod: any = await import("qrcode");
    const toDataURL = mod.toDataURL || mod.default?.toDataURL;
    if (!toDataURL) return null;
    return await toDataURL(verifyUrl, {
      margin: 1,
      width: 400,
      errorCorrectionLevel: "M",
    });
  } catch {
    return null;
  }
}

/** Bentuk objek template offline dari baris TemplateCetak (boleh null).
 *  - Background: utamakan background global lembaga (1 upload per lembaga per varian),
 *    fallback ke background program jika sudah pernah diupload sebelumnya.
 *  - Posisi & offset: utamakan posisi khusus program, fallback ke layout global lembaga,
 *    lalu fallbackTemplate (Lulus), lalu posisi default. */
function bentukTemplateOffline(
  template: any,
  fallbackTemplate?: any,
  lembagaTemplate?: any,
) {
  const hasPos = (t: any) =>
    Boolean(t?.fieldPositions && Object.keys(t.fieldPositions).length > 0);
  const posSource = hasPos(template)
    ? template.fieldPositions
    : hasPos(lembagaTemplate)
      ? lembagaTemplate.fieldPositions
      : hasPos(fallbackTemplate)
        ? fallbackTemplate.fieldPositions
        : {};
  const offsetSource = hasPos(template)
    ? template
    : hasPos(lembagaTemplate)
      ? lembagaTemplate
      : fallbackTemplate;
  return {
    backgroundUrl:
      lembagaTemplate?.backgroundUrl ?? template?.backgroundUrl ?? null,
    fieldPositions: {
      ...defaultFieldPositionsOffline(),
      ...posSource,
    },
    locked: (template as any)?.locked ?? false,
    offsetX: Number(offsetSource?.offsetX) || 0,
    offsetY: Number(offsetSource?.offsetY) || 0,
  };
}

function formatTempatTanggalLahir(
  tempatRaw?: string | null,
  tglLahirRaw?: string | Date | null,
): string {
  const tempat = (tempatRaw || "").trim();
  const tglLahir = tglLahirRaw ? new Date(tglLahirRaw) : null;
  const tglLahirStr =
    tglLahir && !Number.isNaN(tglLahir.getTime())
      ? formatTanggalLahirIndo(tglLahir)
      : "";
  if (tempat && tglLahirStr) return `${tempat}, ${tglLahirStr}`;
  if (tempat) return tempat;
  if (tglLahirStr) return tglLahirStr;
  return "-";
}

function clearMusyarokahScoreFields(texts: Record<string, string>) {
  texts.muaddal = "";
  texts.taqdir = "";
  for (let i = 1; i <= 12; i++) {
    texts[`mapelSlot${i}`] = "";
    texts[`nilaiSlot${i}`] = "";
  }
}

/** Konversi angka Arab (٠-٩) ke digit Latin (0-9) untuk parsing. */
function arabicToLatinDigits(s: string): string {
  const map = "٠١٢٣٤٥٦٧٨٩";
  return s.replace(/[٠-٩]/g, (ch) => String(map.indexOf(ch)));
}

/**
 * Format field `dufah` syahadah F4 offline:
 * - Program non-Akbarnas: 1 angka duf'ah ("Duf'ah 95" -> "٩٥").
 * - Program Akbarnas (2 bulan): 2 duf'ah dipisah garis "-" tanpa "إلى" (mis. "٩٤ - ٩٥").
 *   Prioritas: kolom `teks_dufah_akbarnas_arab` di Pengaturan Syahadah;
 *   jika kosong, otomatis ambil rentang duf'ah dari histori riwayat Akbarnas santri
 *   (atau fallback [dufah - 1, dufah]).
 */
function formatDufahField(params: {
  isAkbarnas: boolean;
  dufahNama?: string | null;
  teksDufahAkbarnasArab?: string | null;
  akbarnasDufahNames?: string[];
}): string {
  const { isAkbarnas, dufahNama, teksDufahAkbarnasArab, akbarnasDufahNames } = params;

  if (!isAkbarnas) {
    const m = String(dufahNama || "").match(/\d+/);
    return m ? toArabDigits(m[0]) : "";
  }

  // 1. Cek pengaturan `teks_dufah_akbarnas_arab`
  const custom = (teksDufahAkbarnasArab || "").trim();
  if (custom) {
    const latin = arabicToLatinDigits(custom);
    const nums = latin.match(/\d+/g);
    if (nums && nums.length >= 2) {
      return `${toArabDigits(nums[0])} - ${toArabDigits(nums[nums.length - 1])}`;
    }
    // Jika admin mengisi teks bebas tanpa 2 angka, tetap ganti "إلى"/"الى" menjadi "-"
    const cleaned = custom
      .replace(/^الدفعة\s*/u, "")
      .replace(/\s*(إلى|الى)\s*/gu, " - ")
      .trim();
    return toArabDigits(cleaned);
  }

  // 2. Fallback dari histori riwayat Akbarnas santri (2 bulan)
  if (akbarnasDufahNames && akbarnasDufahNames.length > 0) {
    const nums = [
      ...new Set(
        akbarnasDufahNames
          .map((n) => {
            const m = String(n || "").match(/\d+/);
            return m ? parseInt(m[0], 10) : NaN;
          })
          .filter((x) => !Number.isNaN(x)),
      ),
    ].sort((a, b) => a - b);
    if (nums.length >= 2) {
      return `${toArabDigits(nums[0])} - ${toArabDigits(nums[nums.length - 1])}`;
    }
    if (nums.length === 1) {
      return `${toArabDigits(Math.max(1, nums[0] - 1))} - ${toArabDigits(nums[0])}`;
    }
  }

  // 3. Fallback akhir dari dufahNama saat ini
  const curMatch = String(dufahNama || "").match(/\d+/);
  if (curMatch) {
    const curNum = parseInt(curMatch[0], 10);
    if (!Number.isNaN(curNum) && curNum > 1) {
      return `${toArabDigits(curNum - 1)} - ${toArabDigits(curNum)}`;
    }
    return toArabDigits(curMatch[0]);
  }
  return "٩٤ - ٩٥";
}

/**
 * Susun semua isi field syahadah offline untuk satu riwayat.
 * `id` boleh riwayatId atau santriId (getCertificateData menyelesaikan
 * keduanya seperti halaman cetak lama). null bila data tidak ditemukan.
 */
export async function getOfflinePrintData(
  id: string,
): Promise<OfflinePrintData | null> {
  const cert: any = await getCertificateData(id);
  if (!cert || !cert.riwayatSantri || !cert.program) return null;

  const riwayatId: string = cert.riwayatSantri.id;
  const santriId: string = cert.riwayatSantri.santriId;
  const programNamaIndo: string = cert.program.nama_indo || "";
  const lembaga: LembagaId = lembagaFromProgramKategori(cert.program.kategori);
  const isHufadz = lembaga === "HUFADZ";

  let isMusyarokah = cert.status === "MUSYAROKAH";
  let slotCount = (cert.nilaiRows || []).length;
  let muaddal = formatAngkaArab(cert.average);
  let taqdir = cert.averagePredikat?.arab || "";
  let juzText = "";
  let nilaiAkumulatif = Number(cert.average) || 0;

  const mapelSlot: Record<string, string> = {};
  const nilaiSlot: Record<string, string> = {};

  if (isHufadz) {
    // Ambil nilai dari MunaqosahHufadz (prioritas duf'ah riwayat, fallback terbaru)
    const munaqosahList = await prisma.munaqosahHufadz.findMany({
      where: { santriId },
      orderBy: { createdAt: "desc" },
    });
    const munaqosah =
      munaqosahList.find((m) => m.dufahNama === cert.riwayatSantri.dufahNama) ??
      munaqosahList[0] ??
      null;

    slotCount = MUNAQOSAH_NILAI_FIELDS.length;
    if (munaqosah) {
      const nilaiAkhir = hitungNilaiAkhirHufadz(munaqosah);
      isMusyarokah = isMusyarokahHufadz(nilaiAkhir);
      muaddal = formatAngkaArab(nilaiAkhir);
      taqdir = predikatArabHufadz(nilaiAkhir) || "";
      juzText = toArabDigits(munaqosah.juzTeks || "");
      nilaiAkumulatif = nilaiAkhir;
      MUNAQOSAH_NILAI_FIELDS.forEach((f, idx) => {
        mapelSlot[`mapelSlot${idx + 1}`] = f.arab;
        nilaiSlot[`nilaiSlot${idx + 1}`] = formatAngkaArab(munaqosah[f.key]);
      });
    } else {
      MUNAQOSAH_NILAI_FIELDS.forEach((f, idx) => {
        mapelSlot[`mapelSlot${idx + 1}`] = f.arab;
        nilaiSlot[`nilaiSlot${idx + 1}`] = "";
      });
      muaddal = "";
      taqdir = "";
    }
    for (let i = MUNAQOSAH_NILAI_FIELDS.length + 1; i <= 12; i++) {
      mapelSlot[`mapelSlot${i}`] = "";
      nilaiSlot[`nilaiSlot${i}`] = "";
    }
  } else {
    for (let i = 1; i <= 12; i++) {
      const row = (cert.nilaiRows || [])[i - 1];
      mapelSlot[`mapelSlot${i}`] = row
        ? row.nama_arab || row.nama_indo || ""
        : "";
      const skor = row?.skor ?? null;
      nilaiSlot[`nilaiSlot${i}`] =
        skor === null || skor === undefined ? "" : formatAngkaArab(skor);
    }
  }

  const baseProgramKey = offlineProgramKey(programNamaIndo);
  const programKey = isMusyarokah
    ? offlineMusyarokahProgramKey(programNamaIndo)
    : baseProgramKey;
  const lembagaKey = offlineLembagaKey(lembaga, isMusyarokah);

  const [template, fallbackTemplate, lembagaTemplate] = await Promise.all([
    prisma.templateCetak.findUnique({ where: { programKey } }),
    isMusyarokah
      ? prisma.templateCetak.findUnique({ where: { programKey: baseProgramKey } })
      : Promise.resolve(null),
    prisma.templateCetak.findUnique({ where: { programKey: lembagaKey } }),
  ]);

  const tpl = cert.template || {};
  const { periode, tahunHijriyah, tahunMiladiyah } = periodeDanTahun(tpl);
  const { tglCetakHijriyah, tglCetakMiladiyah } = tahunCetakHariIni();
  const { namaArab: namaMudirArab, signatureUrl } = resolveMudirForLembaga(
    tpl,
    lembaga,
  );

  // Duf'ah: program reguler = 1 angka ("٩٥"); khusus Akbarnas = 2 duf'ah dipisah garis ("٩٤ - ٩٥")
  const isAkbarnas = programNamaIndo.toLowerCase().includes("akbarnas");
  let akbarnasDufahNames: string[] = [];
  if (isAkbarnas && !(tpl?.teks_dufah_akbarnas_arab || "").trim()) {
    const hist = await prisma.riwayatSantri.findMany({
      where: {
        santriId,
        program: { nama_indo: { contains: "akbarnas", mode: "insensitive" } },
      },
      select: { dufahNama: true },
    });
    akbarnasDufahNames = hist.map((h) => h.dufahNama);
  }
  const dufah = formatDufahField({
    isAkbarnas,
    dufahNama: cert.riwayatSantri.dufahNama,
    teksDufahAkbarnasArab: tpl?.teks_dufah_akbarnas_arab,
    akbarnasDufahNames,
  });

  const tempatLahir = formatTempatTanggalLahir(
    cert.masterSantri?.tempatLahir,
    cert.masterSantri?.tanggalLahir,
  );

  const texts: Record<string, string> = {
    nama: cert.masterSantri?.nama || "-",
    tempatLahir,
    program: cert.program.nama_arab || programNamaIndo,
    dufah,
    periode,
    tahunHijriyah,
    tahunMiladiyah,
    juz: juzText,
    muaddal,
    taqdir,
    tglCetakHijriyah,
    tglCetakMiladiyah,
    namaMudir: namaMudirArab,
    ...mapelSlot,
    ...nilaiSlot,
  };

  if (isMusyarokah) {
    clearMusyarokahScoreFields(texts);
  }

  const baseUrl = await getBaseUrl();
  const qrUrl = `${baseUrl}/ijazah/${riwayatId}`;
  const qrDataUrl = await buildQrDataUrl(qrUrl);

  return {
    riwayatId,
    nama: cert.masterSantri?.nama || "-",
    programKey,
    programNamaArab: cert.program.nama_arab || programNamaIndo,
    programNamaIndo,
    kelasNama: cert.riwayatSantri.kelas?.nama || "-",
    gender: cert.masterSantri?.gender || "-",
    nilaiAkumulatif,
    lembaga,
    isMusyarokah,
    isHufadz,
    signatureUrl,
    texts,
    qrDataUrl,
    qrUrl,
    template: bentukTemplateOffline(template, fallbackTemplate, lembagaTemplate),
    slotCount,
  };
}

type TemplateSyahadahMini = {
  tgl_mulai_arab?: string | null;
  tgl_selesai_arab?: string | null;
  tgl_mulai_indo?: string | null;
  tgl_selesai_indo?: string | null;
  nama_mudir_arab?: string | null;
};

/** Periode + tahun pembelajaran dari baris SyahadahTemplate.
 *  Periode: tahun hanya ditulis sekali di tanggal selesai
 *  ("١١ أكتوبر إلى ٥ نوفمبر ٢٠٢٦") — seperti contoh Canva. */
function periodeDanTahun(tpl: TemplateSyahadahMini) {
  const periode =
    tpl.tgl_mulai_arab && tpl.tgl_selesai_arab
      ? `${tanpaTahunAkhir(tpl.tgl_mulai_arab)} إلى ${tpl.tgl_selesai_arab}`
      : "........";
  // Tahun pembelajaran: dari tanggal mulai periode (Masehi + Hijri).
  const tglMulai =
    parseTanggalIndo(tpl.tgl_mulai_indo) ||
    parseTanggalIndo(tpl.tgl_selesai_indo) ||
    new Date();
  return {
    periode,
    tahunMiladiyah: toArabDigits(tglMulai.getFullYear()),
    tahunHijriyah: toArabDigits(tahunHijriDari(tglMulai)),
  };
}

/** Tanggal cetak = HARI CETAK (bukan tgl_cetak tersimpan), zona WIB —
 *  garis تحريرا hanya berisi TAHUN. */
function tahunCetakHariIni() {
  const hariIni = new Date();
  return {
    tglCetakHijriyah: toArabDigits(tahunHijriDari(hariIni)),
    tglCetakMiladiyah: toArabDigits(tahunMiladiDari(hariIni)),
  };
}

/**
 * Data DUMMY untuk editor & cetak tes template offline — mendukung
 * desain Lulus maupun Musyarokah (`...-musyarokah`), serta Markaz Arabiyah,
 * Turats, dan Hufadz (4 kriteria Munaqosah + field `juz` + TTD/Mudir lembaga).
 */
export async function getDummyPrintData(
  programKey: string,
): Promise<OfflinePrintData | null> {
  const isMusyarokah = isMusyarokahProgramKey(programKey);

  // Mode Global Lembaga: `syahadah-offline-lembaga-<arabiyah|turats|hufadz>[-musyarokah]`
  if (isLembagaGlobalKey(programKey)) {
    const lembaga = lembagaFromGlobalKey(programKey);
    if (!lembaga) return null;
    const isHufadz = lembaga === "HUFADZ";
    const baseLembagaKey = offlineLembagaKey(lembaga, false);

    const [programs, tplRow, template, fallbackTemplate, baseUrl] =
      await Promise.all([
        prisma.program.findMany({
          select: {
            nama_indo: true,
            nama_arab: true,
            kategori: true,
            programMapels: {
              orderBy: { urutan: "asc" },
              select: {
                urutan: true,
                mapel: {
                  select: {
                    nama_indo: true,
                    nama_arab: true,
                    tampil_di_syahadah: true,
                  },
                },
              },
            },
          },
          orderBy: { nama_indo: "asc" },
        }),
        getTemplateData(),
        prisma.templateCetak.findUnique({ where: { programKey } }),
        isMusyarokah
          ? prisma.templateCetak.findUnique({ where: { programKey: baseLembagaKey } })
          : Promise.resolve(null),
        getBaseUrl(),
      ]);

    // Pilih program perwakilan dari lembaga ini (yang mapel tampilnya paling banyak agar semua slot terlihat saat kalibrasi global)
    const lembagaPrograms = programs.filter(
      (p) => lembagaFromProgramKategori(p.kategori) === lembaga,
    );
    const sampleProgram = [...lembagaPrograms].sort((a, b) => {
      const ca = a.programMapels.filter((pm) => pm.mapel.tampil_di_syahadah !== false).length;
      const cb = b.programMapels.filter((pm) => pm.mapel.tampil_di_syahadah !== false).length;
      return cb - ca;
    })[0];

    const { periode, tahunHijriyah, tahunMiladiyah } = periodeDanTahun(tplRow || {});
    const { tglCetakHijriyah, tglCetakMiladiyah } = tahunCetakHariIni();
    const { namaArab: namaMudirArab, signatureUrl } = resolveMudirForLembaga(
      tplRow as any,
      lembaga,
    );

    const mapelSlot: Record<string, string> = {};
    const nilaiSlot: Record<string, string> = {};
    let tampilCount = 0;

    if (isHufadz) {
      tampilCount = MUNAQOSAH_NILAI_FIELDS.length;
      MUNAQOSAH_NILAI_FIELDS.forEach((f, idx) => {
        mapelSlot[`mapelSlot${idx + 1}`] = f.arab;
        nilaiSlot[`nilaiSlot${idx + 1}`] = "٩٥";
      });
      for (let i = MUNAQOSAH_NILAI_FIELDS.length + 1; i <= 12; i++) {
        mapelSlot[`mapelSlot${i}`] = "";
        nilaiSlot[`nilaiSlot${i}`] = "";
      }
    } else if (sampleProgram) {
      const tampilMapels = sampleProgram.programMapels.filter(
        (pm) => pm.mapel.tampil_di_syahadah !== false,
      );
      tampilCount = tampilMapels.length;
      for (let i = 1; i <= 12; i++) {
        const pm = tampilMapels[i - 1];
        mapelSlot[`mapelSlot${i}`] = pm
          ? pm.mapel.nama_arab || pm.mapel.nama_indo || ""
          : "";
        nilaiSlot[`nilaiSlot${i}`] = i <= tampilCount ? "٩٥" : "";
      }
    } else {
      tampilCount = 8;
      for (let i = 1; i <= 12; i++) {
        mapelSlot[`mapelSlot${i}`] = i <= 8 ? `المادة ${toArabDigits(i)}` : "";
        nilaiSlot[`nilaiSlot${i}`] = i <= 8 ? "٩٥" : "";
      }
    }

    const texts: Record<string, string> = {
      nama: "Ahmad Ibnu Alwan",
      tempatLahir: "Wonosobo, 05 - 11 - 2000",
      program: sampleProgram?.nama_arab || sampleProgram?.nama_indo || lembagaLabel(lembaga),
      dufah: "٩٥",
      periode,
      tahunHijriyah,
      tahunMiladiyah,
      juz: isHufadz ? "٣٠، ٢٩، ١" : "",
      muaddal: "٩٥",
      taqdir: "ممتاز",
      tglCetakHijriyah,
      tglCetakMiladiyah,
      namaMudir: namaMudirArab,
      ...mapelSlot,
      ...nilaiSlot,
    };

    if (isMusyarokah) {
      clearMusyarokahScoreFields(texts);
    }

    const qrUrl = `${baseUrl}/preview`;
    const qrDataUrl = await buildQrDataUrl(qrUrl);

    return {
      riwayatId: `dummy-${programKey}`,
      nama: "Ahmad Ibnu Alwan",
      programKey,
      programNamaArab: sampleProgram?.nama_arab || lembagaLabel(lembaga),
      programNamaIndo: `Global ${lembagaLabel(lembaga)}`,
      kelasNama: "Preview Global",
      gender: "BANIN",
      nilaiAkumulatif: 95,
      lembaga,
      isMusyarokah,
      isHufadz,
      signatureUrl,
      texts,
      qrDataUrl,
      qrUrl,
      template: bentukTemplateOffline(template, fallbackTemplate, template),
      slotCount: tampilCount,
    };
  }

  const slug = baseSlugFromOfflineKey(programKey);
  if (!slug) return null;

  const baseProgramKey = `syahadah-offline-${slug}`;

  const [programs, tplRow, template, fallbackTemplate, baseUrl] =
    await Promise.all([
      prisma.program.findMany({
        select: {
          nama_indo: true,
          nama_arab: true,
          kategori: true,
          programMapels: {
            orderBy: { urutan: "asc" },
            select: {
              urutan: true,
              mapel: {
                select: {
                  nama_indo: true,
                  nama_arab: true,
                  tampil_di_syahadah: true,
                },
              },
            },
          },
        },
      }),
      getTemplateData(),
      prisma.templateCetak.findUnique({ where: { programKey } }),
      isMusyarokah
        ? prisma.templateCetak.findUnique({ where: { programKey: baseProgramKey } })
        : Promise.resolve(null),
      getBaseUrl(),
    ]);

  const program = programs.find(
    (p) => slugifyProgram(p.nama_indo || "") === slug,
  );
  if (!program) return null;

  const lembaga: LembagaId = lembagaFromProgramKategori(program.kategori);
  const isHufadz = lembaga === "HUFADZ";
  const lembagaTemplate = await prisma.templateCetak.findUnique({
    where: { programKey: offlineLembagaKey(lembaga, isMusyarokah) },
  });

  const { periode, tahunHijriyah, tahunMiladiyah } = periodeDanTahun(
    tplRow || {},
  );
  const { tglCetakHijriyah, tglCetakMiladiyah } = tahunCetakHariIni();
  const { namaArab: namaMudirArab, signatureUrl } = resolveMudirForLembaga(
    tplRow as any,
    lembaga,
  );

  const mapelSlot: Record<string, string> = {};
  const nilaiSlot: Record<string, string> = {};
  let tampilCount = 0;

  if (isHufadz) {
    tampilCount = MUNAQOSAH_NILAI_FIELDS.length;
    MUNAQOSAH_NILAI_FIELDS.forEach((f, idx) => {
      mapelSlot[`mapelSlot${idx + 1}`] = f.arab;
      nilaiSlot[`nilaiSlot${idx + 1}`] = "٩٥";
    });
    for (let i = MUNAQOSAH_NILAI_FIELDS.length + 1; i <= 12; i++) {
      mapelSlot[`mapelSlot${i}`] = "";
      nilaiSlot[`nilaiSlot${i}`] = "";
    }
  } else {
    const tampilMapels = program.programMapels.filter(
      (pm) => pm.mapel.tampil_di_syahadah !== false,
    );
    tampilCount = tampilMapels.length;
    for (let i = 1; i <= 12; i++) {
      const pm = tampilMapels[i - 1];
      mapelSlot[`mapelSlot${i}`] = pm
        ? pm.mapel.nama_arab || pm.mapel.nama_indo || ""
        : "";
      nilaiSlot[`nilaiSlot${i}`] = i <= tampilCount ? "٩٥" : "";
    }
  }

  const isAkbarnasDummy = (program.nama_indo || "").toLowerCase().includes("akbarnas");
  const dummyDufah = isAkbarnasDummy
    ? formatDufahField({
        isAkbarnas: true,
        dufahNama: "Duf'ah 95",
        teksDufahAkbarnasArab: (tplRow as any)?.teks_dufah_akbarnas_arab,
      })
    : "٩٥";

  const texts: Record<string, string> = {
    nama: "Ahmad Ibnu Alwan",
    tempatLahir: "Wonosobo, 05 - 11 - 2000",
    program: program.nama_arab || program.nama_indo || "-",
    dufah: dummyDufah,
    periode,
    tahunHijriyah,
    tahunMiladiyah,
    juz: isHufadz ? "٣٠، ٢٩، ١" : "",
    muaddal: "٩٥",
    taqdir: "ممتاز",
    tglCetakHijriyah,
    tglCetakMiladiyah,
    namaMudir: namaMudirArab,
    ...mapelSlot,
    ...nilaiSlot,
  };

  if (isMusyarokah) {
    clearMusyarokahScoreFields(texts);
  }

  const qrUrl = `${baseUrl}/preview`;
  const qrDataUrl = await buildQrDataUrl(qrUrl);

  return {
    riwayatId: `dummy-${programKey}`,
    nama: "Ahmad Ibnu Alwan",
    programKey,
    programNamaArab: program.nama_arab || program.nama_indo || "-",
    programNamaIndo: program.nama_indo || "-",
    kelasNama: "Preview",
    gender: "BANIN",
    nilaiAkumulatif: 95,
    lembaga,
    isMusyarokah,
    isHufadz,
    signatureUrl,
    texts,
    qrDataUrl,
    qrUrl,
    template: bentukTemplateOffline(template, fallbackTemplate, lembagaTemplate),
    slotCount: tampilCount,
  };
}

export type BulkOfflinePrintResult = {
  mode: "lulus" | "musyarokah";
  scopeLabel: string;
  items: OfflinePrintData[];
  classSummary: Array<{
    kelasKey: string;
    kelasNama: string;
    programNama: string;
    lembaga: LembagaId;
    count: number;
  }>;
};

/**
 * Susun data cetak bulk F4 Portrait (2 Fase: Lulus vs Musyarokah),
 * mendukung baik per-kelas (`kelasId`) maupun global seluruh kelas
 * (dengan filter lembaga opsional).
 * Di dalam setiap kelas, diurutkan: Banin (nilai tertinggi -> terendah)
 * lalu Banat (nilai tertinggi -> terendah).
 */
export async function getBulkOfflinePrintData(params: {
  mode: "lulus" | "musyarokah";
  kelasId?: string | null;
  lembaga?: LembagaId | null;
}): Promise<BulkOfflinePrintResult> {
  const { mode, kelasId, lembaga } = params;

  const [
    allRows,
    masterSantriList,
    tplRow,
    templateList,
    munaqosahList,
    baseUrl,
  ] = await Promise.all([
    getDashboardSantriRows(),
    getMasterSantriList(),
    getTemplateData(),
    prisma.templateCetak.findMany({
      where: { programKey: { startsWith: "syahadah-offline-" } },
    }),
    prisma.munaqosahHufadz.findMany({ orderBy: { createdAt: "desc" } }),
    getBaseUrl(),
  ]);

  const activeRows = allRows.filter((r: any) => r.isAktif);

  // Filter berdasarkan kelas / lembaga / fase (Lulus vs Musyarokah)
  const filteredRows = activeRows.filter((row: any) => {
    if (kelasId) {
      if (kelasId.startsWith("PROGRAM_")) {
        const pid = kelasId.replace("PROGRAM_", "");
        if (row.programId !== pid) return false;
      } else {
        if (row.kelasId !== kelasId) return false;
      }
    }
    if (lembaga) {
      const rowLembaga = lembagaFromProgramKategori(row.programKategori);
      if (rowLembaga !== lembaga) return false;
    }
    if (mode === "lulus") {
      // Akbarnas bulan 1 disatukan ke kelompok Lulus (sesuai kesepakatan)
      return (
        (row.canPrintSyahadah && row.statusKelulusan === "LULUS") ||
        Boolean(row.canPrintMcSyahadah)
      );
    }
    return row.canPrintSyahadah && row.statusKelulusan === "MUSYAROKAH";
  });

  // Kelompokkan per kelas, urutkan kelas Arabiyah -> Turats -> Hufadz lalu nama kelas
  const lembagaOrder = (l: LembagaId) =>
    l === "ARABIYAH" ? 0 : l === "TURATS" ? 1 : 2;

  const groupMap = new Map<
    string,
    {
      kelasKey: string;
      kelasNama: string;
      programNama: string;
      lembaga: LembagaId;
      rows: any[];
    }
  >();

  for (const row of filteredRows) {
    const kKey =
      row.kelasId ||
      (row.programId ? `PROGRAM_${row.programId}` : "UNASSIGNED");
    const kNama = row.kelasId ? row.kelasNama : row.programNama;
    const rowLembaga = lembagaFromProgramKategori(row.programKategori);
    if (!groupMap.has(kKey)) {
      groupMap.set(kKey, {
        kelasKey: kKey,
        kelasNama: kNama,
        programNama: row.programNama,
        lembaga: rowLembaga,
        rows: [],
      });
    }
    groupMap.get(kKey)!.rows.push(row);
  }

  const orderedGroups = [...groupMap.values()].sort(
    (a, b) =>
      lembagaOrder(a.lembaga) - lembagaOrder(b.lembaga) ||
      a.kelasNama.localeCompare(b.kelasNama, "id"),
  );

  // Urutkan santri dalam setiap kelas: Banin tertinggi -> Banat tertinggi
  const orderedRows: any[] = [];
  for (const g of orderedGroups) {
    g.rows = sortSyahadahSantri(g.rows);
    orderedRows.push(...g.rows);
  }

  // Ambil seluruh RiwayatSantri yang dibutuhkan dalam 1 query + histori Akbarnas dalam 1 query
  const riwayatIds = orderedRows
    .map((r) => r.riwayatId)
    .filter((id): id is string => Boolean(id));

  const riwayatRecords =
    riwayatIds.length > 0
      ? await prisma.riwayatSantri.findMany({
          where: { id: { in: riwayatIds } },
          include: {
            kelas: true,
            santri: true,
            program: {
              include: {
                programMapels: {
                  include: { mapel: true },
                  orderBy: { urutan: "asc" },
                },
              },
            },
            nilaiList: {
              include: { mapel: true },
            },
          },
        })
      : [];

  const riwayatById = new Map(riwayatRecords.map((r) => [r.id, r]));

  // Histori Akbarnas untuk santri Akbarnas yang terpilih
  const akbarnasSantriIds = [
    ...new Set(
      riwayatRecords
        .filter((r) =>
          (r.program?.nama_indo || "").toLowerCase().includes("akbarnas"),
        )
        .map((r) => r.santriId),
    ),
  ];

  const akbarnasHistBySantri = new Map<string, any[]>();
  if (akbarnasSantriIds.length > 0) {
    const akbarnasHist = await prisma.riwayatSantri.findMany({
      where: {
        santriId: { in: akbarnasSantriIds },
        program: { nama_indo: { contains: "akbarnas", mode: "insensitive" } },
      },
      include: { nilaiList: { include: { mapel: true } } },
      orderBy: { dufahNama: "asc" },
    });
    for (const h of akbarnasHist) {
      if (!akbarnasHistBySantri.has(h.santriId)) {
        akbarnasHistBySantri.set(h.santriId, []);
      }
      akbarnasHistBySantri.get(h.santriId)!.push(h);
    }
  }

  // Hitung pemenang Martabah Ula (peringkat #1 LULUS per program di cohort aktif)
  const martabahWinnerByProgram = new Map<string, string>();
  const lulusByProgram = new Map<string, any[]>();
  for (const r of activeRows) {
    if (
      r.statusKelulusan === "LULUS" &&
      r.canPrintSyahadah &&
      r.programId &&
      r.programKategori !== "HUFADZ" &&
      r.nilaiAkumulatif > 0
    ) {
      const key = r.programId;
      if (!lulusByProgram.has(key)) lulusByProgram.set(key, []);
      lulusByProgram.get(key)!.push(r);
    }
  }
  for (const [progKey, list] of lulusByProgram.entries()) {
    list.sort((a, b) => b.nilaiAkumulatif - a.nilaiAkumulatif);
    if (list[0]?.riwayatId) {
      martabahWinnerByProgram.set(progKey, list[0].riwayatId);
    }
  }

  const masterById = new Map(masterSantriList.map((m) => [m.id, m]));
  const templateByKey = new Map(templateList.map((t) => [t.programKey, t]));
  const munaqosahByKey = new Map<string, (typeof munaqosahList)[0]>();
  const munaqosahLatestBySantri = new Map<string, (typeof munaqosahList)[0]>();
  for (const m of munaqosahList) {
    const k = `${m.santriId}_${m.dufahNama}`;
    if (!munaqosahByKey.has(k)) munaqosahByKey.set(k, m);
    if (!munaqosahLatestBySantri.has(m.santriId)) {
      munaqosahLatestBySantri.set(m.santriId, m);
    }
  }

  const { periode, tahunHijriyah, tahunMiladiyah } = periodeDanTahun(
    tplRow || {},
  );
  const { tglCetakHijriyah, tglCetakMiladiyah } = tahunCetakHariIni();
  const isMusyarokahMode = mode === "musyarokah";

  const items: OfflinePrintData[] = [];

  for (const row of orderedRows) {
    if (!row.riwayatId) continue;
    const riwayat = riwayatById.get(row.riwayatId);
    if (!riwayat || !riwayat.program) continue;

    const master = masterById.get(row.id);
    const program = riwayat.program;
    const programNamaIndo = program.nama_indo || "";
    const rowLembaga = lembagaFromProgramKategori(program.kategori);
    const isHufadz = rowLembaga === "HUFADZ";
    const isTurats = rowLembaga === "TURATS";
    const isAkbarnas = programNamaIndo.toLowerCase().includes("akbarnas");

    const mapelSlot: Record<string, string> = {};
    const nilaiSlot: Record<string, string> = {};
    let slotCount = 0;
    let muaddal = "";
    let taqdir = "";
    let juzText = "";

    if (isHufadz) {
      const munaqosah =
        munaqosahByKey.get(`${row.id}_${riwayat.dufahNama}`) ??
        munaqosahLatestBySantri.get(row.id) ??
        null;
      slotCount = MUNAQOSAH_NILAI_FIELDS.length;
      if (munaqosah) {
        const nilaiAkhir = hitungNilaiAkhirHufadz(munaqosah);
        muaddal = formatAngkaArab(nilaiAkhir);
        taqdir = predikatArabHufadz(nilaiAkhir) || "";
        juzText = toArabDigits(munaqosah.juzTeks || "");
        MUNAQOSAH_NILAI_FIELDS.forEach((f, idx) => {
          mapelSlot[`mapelSlot${idx + 1}`] = f.arab;
          nilaiSlot[`nilaiSlot${idx + 1}`] = formatAngkaArab(munaqosah[f.key]);
        });
      }
      for (let i = MUNAQOSAH_NILAI_FIELDS.length + 1; i <= 12; i++) {
        mapelSlot[`mapelSlot${i}`] = "";
        nilaiSlot[`nilaiSlot${i}`] = "";
      }
    } else {
      const allProgramMapels = program.programMapels.filter(
        (pm) => pm.mapel.tampil_di_syahadah !== false,
      );
      slotCount = allProgramMapels.length;

      let allNilaiList: any[] = [...riwayat.nilaiList];
      let akbarnasBaseRiwayatId: string | null = null;
      if (isAkbarnas) {
        const hist = akbarnasHistBySantri.get(riwayat.santriId) ?? [];
        allNilaiList = hist.flatMap((h) => h.nilaiList);
        const lastHist = hist[hist.length - 1];
        akbarnasBaseRiwayatId = lastHist?.id ?? riwayat.id;
      }

      const nilaiGroups = new Map<string, any[]>();
      for (const n of allNilaiList) {
        if (!nilaiGroups.has(n.mapelId)) nilaiGroups.set(n.mapelId, []);
        nilaiGroups.get(n.mapelId)!.push(n);
      }

      const nilaiMap = new Map<string, any>();
      for (const [mapelId, list] of nilaiGroups.entries()) {
        if (isAkbarnas) {
          const grandNilaiAkhir = calcAkbarnasMapelAverage(list);
          const baseNilai =
            list.find((n: any) => n.riwayatId === akbarnasBaseRiwayatId) ??
            list[list.length - 1];
          nilaiMap.set(mapelId, {
            ...baseNilai,
            nilaiAkhir: grandNilaiAkhir,
          });
        } else {
          let selected = list[list.length - 1];
          for (const n of list) {
            if (n.nilaiAkhir !== null) selected = n;
          }
          if (
            selected &&
            selected.nilaiAkhir === null &&
            (selected.nilaiUsbu1 !== null ||
              selected.nilaiUsbu2 !== null ||
              selected.nilaiNihai !== null)
          ) {
            const effectiveUsbuainMode =
              riwayat.jumlah_kolom_usbu ?? riwayat.kelas?.jumlah_kolom_usbu ?? 0;
            const m = program.programMapels.find(
              (pm) => pm.mapelId === selected.mapelId,
            )?.mapel;
            let calc: number | null = null;
            if (m?.jumlah_tes === 3 && effectiveUsbuainMode === 2) {
              calc = calcMapelNilaiAkhirUsbuain2({
                u1: selected.nilaiUsbu1,
                u2: selected.nilaiUsbu2,
              });
            } else if (m?.jumlah_tes === 3 && effectiveUsbuainMode === 1) {
              calc = selected.nilaiNihai;
            } else {
              calc = calcMapelNilaiAkhir(
                {
                  u1: selected.nilaiUsbu1,
                  u2: selected.nilaiUsbu2,
                  n: selected.nilaiNihai,
                },
                false,
              );
            }
            selected = { ...selected, nilaiAkhir: calc };
          }
          nilaiMap.set(mapelId, selected);
        }
      }

      const nilaiRows = allProgramMapels.map((pm) => {
        const nilai = nilaiMap.get(pm.mapel.id);
        const baseScore = nilai?.nilaiAkhir ?? null;
        const tambahan = nilai?.nilaiTambahan ?? 0;
        const skor =
          baseScore !== null ? applyNilaiTambahan(baseScore, tambahan) : null;
        return {
          nama_arab: pm.mapel.nama_arab,
          nama_indo: pm.mapel.nama_indo,
          skor,
          masuk_akumulasi: pm.mapel.masuk_akumulasi ?? true,
          bobot: pm.mapel.bobot ?? 1,
        };
      });

      for (let i = 1; i <= 12; i++) {
        const nr = nilaiRows[i - 1];
        mapelSlot[`mapelSlot${i}`] = nr ? nr.nama_arab || nr.nama_indo || "" : "";
        nilaiSlot[`nilaiSlot${i}`] =
          nr && nr.skor !== null && nr.skor !== undefined
            ? formatAngkaArab(nr.skor)
            : "";
      }

      const accRows = nilaiRows.filter(
        (n) => typeof n.skor === "number" && n.masuk_akumulasi,
      );
      const average = calcAkumulatif(
        accRows.map((n) => ({ score: Number(n.skor), bobot: n.bobot })),
      );
      muaddal = formatAngkaArab(average);
      const basePredikat = isTurats
        ? getPredikatTurats(Math.round(average))
        : getPredikat(Math.round(average));
      const isMartabah =
        !isMusyarokahMode &&
        row.programId &&
        martabahWinnerByProgram.get(row.programId) === riwayat.id;
      taqdir = isMartabah
        ? "الامتياز مع مرتبة الشرف الأولى"
        : basePredikat.arab;
    }

    const baseProgramKey = offlineProgramKey(programNamaIndo);
    const programKey = isMusyarokahMode
      ? offlineMusyarokahProgramKey(programNamaIndo)
      : baseProgramKey;
    const lembagaKey = offlineLembagaKey(rowLembaga, isMusyarokahMode);

    const tplMain = templateByKey.get(programKey) ?? null;
    const tplFallback = isMusyarokahMode
      ? templateByKey.get(baseProgramKey) ?? null
      : null;
    const tplLembaga = templateByKey.get(lembagaKey) ?? null;

    const { namaArab: namaMudirArab, signatureUrl } = resolveMudirForLembaga(
      tplRow as any,
      rowLembaga,
    );

    const dufah = formatDufahField({
      isAkbarnas,
      dufahNama: riwayat.dufahNama,
      teksDufahAkbarnasArab: (tplRow as any)?.teks_dufah_akbarnas_arab,
      akbarnasDufahNames: isAkbarnas
        ? (akbarnasHistBySantri.get(riwayat.santriId) ?? []).map((h) => h.dufahNama)
        : undefined,
    });
    const tempatLahir = formatTempatTanggalLahir(
      master?.tempatLahir ?? riwayat.santri?.tempat_lahir,
      master?.tanggalLahir ?? riwayat.santri?.tanggal_lahir,
    );

    const texts: Record<string, string> = {
      nama: master?.nama || row.nama || "-",
      tempatLahir,
      program: program.nama_arab || programNamaIndo,
      dufah,
      periode,
      tahunHijriyah,
      tahunMiladiyah,
      juz: juzText,
      muaddal,
      taqdir,
      tglCetakHijriyah,
      tglCetakMiladiyah,
      namaMudir: namaMudirArab,
      ...mapelSlot,
      ...nilaiSlot,
    };

    if (isMusyarokahMode) {
      clearMusyarokahScoreFields(texts);
    }

    const qrUrl = `${baseUrl}/ijazah/${riwayat.id}`;

    items.push({
      riwayatId: riwayat.id,
      nama: master?.nama || row.nama || "-",
      programKey,
      programNamaArab: program.nama_arab || programNamaIndo,
      programNamaIndo,
      kelasNama: riwayat.kelas?.nama || row.kelasNama || "-",
      gender: row.gender || "-",
      nilaiAkumulatif: Number(row.nilaiAkumulatif) || 0,
      lembaga: rowLembaga,
      isMusyarokah: isMusyarokahMode,
      isHufadz,
      signatureUrl,
      texts,
      // Di bulk print gunakan SVG ringan via qrUrl agar 200+ lembar cepat dimuat
      qrDataUrl: null,
      qrUrl,
      template: bentukTemplateOffline(tplMain, tplFallback, tplLembaga),
      slotCount,
    });
  }

  let scopeLabel = "Global Semua Kelas";
  if (kelasId && orderedGroups[0]) {
    scopeLabel = `Kelas ${orderedGroups[0].kelasNama}`;
  } else if (kelasId) {
    scopeLabel = "Kelas Terpilih";
  } else if (lembaga) {
    scopeLabel =
      lembaga === "ARABIYAH"
        ? "Global Markaz Arabiyah"
        : lembaga === "TURATS"
          ? "Global Markaz Turats"
          : "Global Markaz Hufadz";
  }

  return {
    mode,
    scopeLabel,
    items,
    classSummary: orderedGroups.map((g) => ({
      kelasKey: g.kelasKey,
      kelasNama: g.kelasNama,
      programNama: g.programNama,
      lembaga: g.lembaga,
      count: g.rows.length,
    })),
  };
}
