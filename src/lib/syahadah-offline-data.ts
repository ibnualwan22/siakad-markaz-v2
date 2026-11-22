// Data syahadah offline — SERVER ONLY (mengimpor prisma/app-data/qrcode).
// Dipakai halaman cetak admin (/cetak-offline/[id]) dan halaman unduh
// santri (/santri/syahadah-offline/[riwayatId]).

import prisma from "@/lib/prisma";
import { getCertificateData } from "@/lib/app-data";
import { getBaseUrl } from "@/lib/base-url";
import { toArabDigits } from "@/lib/munaqosah-hufadz";
import {
  defaultFieldPositionsOffline,
  formatAngkaArab,
  formatTanggalLahirArab,
  offlineProgramKey,
  parseTanggalIndo,
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
  template: {
    backgroundUrl: string | null;
    fieldPositions: Record<string, any>;
    locked: boolean;
    offsetX: number;
    offsetY: number;
  } | null;
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
  // Periode: tahun hanya ditulis sekali di tanggal selesai
  // ("١١ أكتوبر إلى ٥ نوفمبر ٢٠٢٦") — seperti contoh Canva.
  const periode =
    tpl.tgl_mulai_arab && tpl.tgl_selesai_arab
      ? `${tanpaTahunAkhir(tpl.tgl_mulai_arab)} إلى ${tpl.tgl_selesai_arab}`
      : "........";

  // Tahun pembelajaran: dari tanggal mulai periode (Masehi + Hijri).
  const tglMulai =
    parseTanggalIndo(tpl.tgl_mulai_indo) ||
    parseTanggalIndo(tpl.tgl_selesai_indo) ||
    new Date();
  const tahunMiladiyah = toArabDigits(tglMulai.getFullYear());
  const tahunHijriyah = toArabDigits(tahunHijriDari(tglMulai));

  // Tanggal cetak = HARI CETAK (bukan tgl_cetak tersimpan), zona WIB —
  // garis تحريرا hanya berisi TAHUN (keputusan user 22 Nov 2026).
  const hariIni = new Date();
  const tglCetakHijriyah = toArabDigits(tahunHijriDari(hariIni));
  const tglCetakMiladiyah = toArabDigits(tahunMiladiDari(hariIni));

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
    template: template
      ? {
          backgroundUrl: template.backgroundUrl,
          // Posisi default sebagai alas: template yang tersimpan sebelum
          // revisi slot dinamis belum punya kunci nilaiSlot1..12 — tanpa
          // alas ini nilainya tidak terender sampai admin buka + simpan
          // ulang editor (editor sendiri sudah menggabung seed saat load).
          fieldPositions: {
            ...defaultFieldPositionsOffline(),
            ...((template.fieldPositions as any) || {}),
          },
          locked: (template as any).locked ?? false,
          offsetX: (template as any).offsetX ?? 0,
          offsetY: (template as any).offsetY ?? 0,
        }
      : null,
  };
}
