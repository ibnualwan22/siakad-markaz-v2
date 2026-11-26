// Data syahadah offline — SERVER ONLY (mengimpor prisma/app-data/qrcode).
// Dipakai halaman cetak admin (/cetak-offline/[id]), cetak tes
// (/cetak-offline/tes/[programKey]), dan halaman unduh santri
// (/santri/syahadah-offline/[riwayatId]).

import prisma from "@/lib/prisma";
import { getCertificateData, getTemplateData } from "@/lib/app-data";
import { getBaseUrl } from "@/lib/base-url";
import { toArabDigits } from "@/lib/munaqosah-hufadz";
import {
  defaultFieldPositionsOffline,
  formatAngkaArab,
  formatTanggalLahirIndo,
  offlineProgramKey,
  parseTanggalIndo,
  slugifyProgram,
  tahunHijriDari,
  tahunMiladiDari,
  tanpaTahunAkhir,
} from "@/lib/syahadah-offline";

export type OfflinePrintData = {
  riwayatId: string;
  nama: string;
  programKey: string;
  programNamaArab: string;
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
  // mapel tampil program itu.
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
  const programNamaIndo: string = cert.program.nama_indo || "";
  const programKey = offlineProgramKey(programNamaIndo);

  const template = await prisma.templateCetak.findUnique({
    where: { programKey },
  });

  const tpl = cert.template || {};
  const { periode, tahunHijriyah, tahunMiladiyah } = periodeDanTahun(tpl);
  const { tglCetakHijriyah, tglCetakMiladiyah } = tahunCetakHariIni();

  // Duf'ah sebagai angka ("Duf'ah 95" -> "٩٥").
  const dufahMatch = String(cert.riwayatSantri.dufahNama || "").match(/\d+/);
  const dufah = dufahMatch ? toArabDigits(dufahMatch[0]) : "";

  // Tempat + tanggal lahir format Indonesia: "Wonosobo, 05 - 11 - 2000" —
  // bila tanggal lahir kosong/invalid, tempat saja.
  const tempat = (cert.masterSantri?.tempatLahir || "").trim();
  const tglLahirRaw = cert.masterSantri?.tanggalLahir;
  const tglLahir = tglLahirRaw ? new Date(tglLahirRaw) : null;
  const tglLahirStr =
    tglLahir && !Number.isNaN(tglLahir.getTime())
      ? formatTanggalLahirIndo(tglLahir)
      : "";
  let tempatLahir = "-";
  if (tempat && tglLahirStr) tempatLahir = `${tempat}, ${tglLahirStr}`;
  else if (tempat) tempatLahir = tempat;
  else if (tglLahirStr) tempatLahir = tglLahirStr;

  // Mapel & Nilai tabel DINAMIS: slot ke-i = mapel tampil ke-i dari
  // nilaiRows (sudah terfilter tampil_di_syahadah + urutan di
  // getCertificateData) — menampilkan nama mapel Arab & nilai Arab.
  const mapelSlot: Record<string, string> = {};
  const nilaiSlot: Record<string, string> = {};
  for (let i = 1; i <= 12; i++) {
    const row = (cert.nilaiRows || [])[i - 1];
    mapelSlot[`mapelSlot${i}`] = row
      ? row.nama_arab || row.nama_indo || ""
      : "";
    const skor = row?.skor ?? null;
    nilaiSlot[`nilaiSlot${i}`] =
      skor === null || skor === undefined ? "" : formatAngkaArab(skor);
  }

  const texts: Record<string, string> = {
    nama: cert.masterSantri?.nama || "-",
    tempatLahir,
    program: cert.program.nama_arab || programNamaIndo,
    dufah,
    periode,
    tahunHijriyah,
    tahunMiladiyah,
    muaddal: formatAngkaArab(cert.average),
    taqdir: cert.averagePredikat?.arab || "",
    tglCetakHijriyah,
    tglCetakMiladiyah,
    ...mapelSlot,
    ...nilaiSlot,
  };

  const baseUrl = await getBaseUrl();
  const qrUrl = `${baseUrl}/ijazah/${riwayatId}`;
  const qrDataUrl = await buildQrDataUrl(qrUrl);

  return {
    riwayatId,
    nama: cert.masterSantri?.nama || "-",
    programKey,
    programNamaArab: cert.program.nama_arab || programNamaIndo,
    texts,
    qrDataUrl,
    qrUrl,
    template: bentukTemplateOffline(template),
    slotCount: (cert.nilaiRows || []).length,
  };
}

/** Bentuk objek template offline dari baris TemplateCetak (boleh null):
 *  SELALU objek — bila baris belum ada, field tetap tampil di posisi seed
 *  default dan backgroundUrl null (pesan "belum memiliki background"
 *  tampil). Posisi default dipakai sebagai alas agar kunci baru seperti
 *  mapelSlot1..12 langsung memiliki posisi awal pada template lama. */
function bentukTemplateOffline(template: any) {
  return {
    backgroundUrl: template?.backgroundUrl ?? null,
    fieldPositions: {
      ...defaultFieldPositionsOffline(),
      ...((template?.fieldPositions as any) || {}),
    },
    locked: (template as any)?.locked ?? false,
    offsetX: (template as any)?.offsetX ?? 0,
    offsetY: (template as any)?.offsetY ?? 0,
  };
}

type TemplateSyahadahMini = {
  tgl_mulai_arab?: string | null;
  tgl_selesai_arab?: string | null;
  tgl_mulai_indo?: string | null;
  tgl_selesai_indo?: string | null;
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
 * Data DUMMY untuk editor & cetak tes template offline — nama SELALU
 * "Ahmad Ibnu Alwan" di semua program, tempat & tanggal lahir format
 * Indonesia "Wonosobo, 05 - 11 - 2000", nama mapel asli program yang
 * tampil di syahadah + nilai ٩٥, dan QR verifikasi contoh agar tampilan
 * editor dan cetak tes identik 100% dengan cetak santri asli.
 */
export async function getDummyPrintData(
  programKey: string,
): Promise<OfflinePrintData | null> {
  const slug = programKey.replace(/^syahadah-offline-/, "");
  if (!slug) return null;

  const [programs, tplRow, template, baseUrl] = await Promise.all([
    prisma.program.findMany({
      select: {
        nama_indo: true,
        nama_arab: true,
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
    getBaseUrl(),
  ]);

  const program = programs.find(
    (p) => slugifyProgram(p.nama_indo || "") === slug,
  );
  if (!program) return null;

  const tampilMapels = program.programMapels.filter(
    (pm) => pm.mapel.tampil_di_syahadah !== false,
  );
  const tampilCount = tampilMapels.length;

  const { periode, tahunHijriyah, tahunMiladiyah } = periodeDanTahun(
    tplRow || {},
  );
  const { tglCetakHijriyah, tglCetakMiladiyah } = tahunCetakHariIni();

  const mapelSlot: Record<string, string> = {};
  const nilaiSlot: Record<string, string> = {};
  for (let i = 1; i <= 12; i++) {
    const pm = tampilMapels[i - 1];
    mapelSlot[`mapelSlot${i}`] = pm
      ? pm.mapel.nama_arab || pm.mapel.nama_indo || ""
      : "";
    nilaiSlot[`nilaiSlot${i}`] = i <= tampilCount ? "٩٥" : "";
  }

  const texts: Record<string, string> = {
    nama: "Ahmad Ibnu Alwan",
    tempatLahir: "Wonosobo, 05 - 11 - 2000",
    program: program.nama_arab || program.nama_indo || "-",
    dufah: "٩٥",
    periode,
    tahunHijriyah,
    tahunMiladiyah,
    muaddal: "٩٥",
    taqdir: "ممتاز",
    tglCetakHijriyah,
    tglCetakMiladiyah,
    ...mapelSlot,
    ...nilaiSlot,
  };

  const qrUrl = `${baseUrl}/preview`;
  const qrDataUrl = await buildQrDataUrl(qrUrl);

  return {
    riwayatId: `dummy-${programKey}`,
    nama: "Ahmad Ibnu Alwan",
    programKey,
    programNamaArab: program.nama_arab || program.nama_indo || "-",
    texts,
    qrDataUrl,
    qrUrl,
    template: bentukTemplateOffline(template),
    slotCount: tampilCount,
  };
}
