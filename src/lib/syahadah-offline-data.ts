// Data syahadah offline — SERVER ONLY (mengimpor prisma/app-data/qrcode).
// Dipakai halaman cetak admin (/cetak-offline/[id]) dan halaman unduh
// santri (/santri/syahadah-offline/[riwayatId]).

import prisma from "@/lib/prisma";
import { getCertificateData, getTemplateData } from "@/lib/app-data";
import { getBaseUrl } from "@/lib/base-url";
import { toArabDigits } from "@/lib/munaqosah-hufadz";
import {
  defaultFieldPositionsOffline,
  formatAngkaArab,
  formatTanggalLahirArab,
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
  // Jumlah slot nilai yang dirender (nilaiSlot1..slotCount) = jumlah mapel
  // tampil program itu.
  slotCount: number;
};

/** Ambil QR verifikasi sebagai data URL (gambar, bukan SVG — aman untuk
 *  tangkapan PNG html2canvas). Pola sama seperti syahadah Munaqosah. */
async function buildQrDataUrl(verifyUrl: string): Promise<string | null> {
  try {
    const mod: any = await import("qrcode");
    const toDataURL = mod.toDataURL || mod.default?.toDataURL;
    if (!toDataURL) return null;
    return await toDataURL(verifyUrl, {
      margin: 1,
      width: 400,
      errorCorrectionLevel: "H",
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

  // Tempat + tanggal lahir ("Wonosobo، ٠٥ – ١١ – ٢٠٠٠") — bila tanggal
  // lahir kosong/invalid, tempat saja.
  const tempat = (cert.masterSantri?.tempatLahir || "").trim();
  const tglLahirRaw = cert.masterSantri?.tanggalLahir;
  const tglLahir = tglLahirRaw ? new Date(tglLahirRaw) : null;
  const tglLahirStr =
    tglLahir && !Number.isNaN(tglLahir.getTime())
      ? formatTanggalLahirArab(tglLahir)
      : "";
  let tempatLahir = "-";
  if (tempat && tglLahirStr) tempatLahir = `${tempat}، ${tglLahirStr}`;
  else if (tempat) tempatLahir = tempat;
  else if (tglLahirStr) tempatLahir = tglLahirStr;

  // Nilai tabel DINAMIS: slot ke-i = mapel tampil ke-i dari nilaiRows
  // (sudah terfilter tampil_di_syahadah + urutan urutan di
  // getCertificateData) — tanpa pemetaan manual di template.
  const nilaiSlot: Record<string, string> = {};
  for (let i = 1; i <= 12; i++) {
    const skor = (cert.nilaiRows || [])[i - 1]?.skor ?? null;
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
    ...nilaiSlot,
  };

  const baseUrl = await getBaseUrl();
  const qrDataUrl = await buildQrDataUrl(`${baseUrl}/ijazah/${riwayatId}`);

  return {
    riwayatId,
    nama: cert.masterSantri?.nama || "-",
    programKey,
    programNamaArab: cert.program.nama_arab || programNamaIndo,
    texts,
    qrDataUrl,
    template: bentukTemplateOffline(template),
    slotCount: (cert.nilaiRows || []).length,
  };
}

/** Bentuk objek template offline dari baris TemplateCetak (boleh null):
 *  SELALU objek — bila baris belum ada, field tetap tampil di posisi seed
 *  default dan backgroundUrl null (pesan "belum memiliki background"
 *  tampil). Sebelum revisi ini template null membuat SEMUA field hilang
 *  dari panggung (renderField mengembalikan null bila cfg tidak ada). */
function bentukTemplateOffline(template: any) {
  return {
    backgroundUrl: template?.backgroundUrl ?? null,
    // Posisi default sebagai alas: template yang tersimpan sebelum revisi
    // slot dinamis belum punya kunci nilaiSlot1..12 — tanpa alas ini
    // nilainya tidak terender sampai admin buka + simpan ulang editor
    // (editor sendiri sudah menggabung seed saat load).
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
 *  garis تحريرا hanya berisi TAHUN (keputusan user 22 Nov 2026). */
function tahunCetakHariIni() {
  const hariIni = new Date();
  return {
    tglCetakHijriyah: toArabDigits(tahunHijriDari(hariIni)),
    tglCetakMiladiyah: toArabDigits(tahunMiladiDari(hariIni)),
  };
}

/**
 * Data DUMMY untuk cetak tes template offline — nama SELALU
 * "Ahmad Ibnu Alwan" di semua program (keputusan user 22 Nov 2026).
 * Dipakai route /cetak-offline/tes/[programKey] (admin). BUKAN data
 * santri asli: muaddal + semua nilai ٩٥ (seperti foto mockup), QR null
 * (kotak placeholder tampil di preview, tidak tercetak).
 * Periode + tahun diambil dari baris SyahadahTemplate yang sama dengan
 * jalur asli (bukan hardcode tanggal). null bila programKey tidak cocok
 * dengan program mana pun.
 */
export async function getDummyPrintData(
  programKey: string,
): Promise<OfflinePrintData | null> {
  const slug = programKey.replace(/^syahadah-offline-/, "");
  if (!slug) return null;

  const [programs, tplRow, template] = await Promise.all([
    prisma.program.findMany({
      select: {
        nama_indo: true,
        nama_arab: true,
        programMapels: {
          select: { mapel: { select: { tampil_di_syahadah: true } } },
        },
      },
    }),
    getTemplateData(),
    prisma.templateCetak.findUnique({ where: { programKey } }),
  ]);

  const program = programs.find(
    (p) => slugifyProgram(p.nama_indo || "") === slug,
  );
  if (!program) return null;

  const tampilCount = program.programMapels.filter(
    (pm) => pm.mapel.tampil_di_syahadah !== false,
  ).length;

  const { periode, tahunHijriyah, tahunMiladiyah } = periodeDanTahun(
    tplRow || {},
  );
  const { tglCetakHijriyah, tglCetakMiladiyah } = tahunCetakHariIni();

  const nilaiSlot: Record<string, string> = {};
  for (let i = 1; i <= 12; i++) {
    nilaiSlot[`nilaiSlot${i}`] = i <= tampilCount ? "٩٥" : "";
  }

  const texts: Record<string, string> = {
    nama: "Ahmad Ibnu Alwan",
    tempatLahir: "Wonosobo، ٠٥ – ١١ – ٢٠٠٠",
    program: program.nama_arab || program.nama_indo || "-",
    dufah: "٩٥",
    periode,
    tahunHijriyah,
    tahunMiladiyah,
    muaddal: "٩٥",
    taqdir: "ممتاز",
    tglCetakHijriyah,
    tglCetakMiladiyah,
    ...nilaiSlot,
  };

  return {
    riwayatId: `dummy-${programKey}`,
    nama: "Ahmad Ibnu Alwan",
    programKey,
    programNamaArab: program.nama_arab || program.nama_indo || "-",
    texts,
    qrDataUrl: null,
    template: bentukTemplateOffline(template),
    slotCount: tampilCount,
  };
}
