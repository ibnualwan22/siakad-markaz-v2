// Data syahadah offline — SERVER ONLY (mengimpor prisma/app-data/qrcode).
// Dipakai halaman cetak admin (/cetak-offline/[id]) dan halaman unduh
// santri (/santri/syahadah-offline/[riwayatId]).

import prisma from "@/lib/prisma";
import { getCertificateData } from "@/lib/app-data";
import { getBaseUrl } from "@/lib/base-url";
import { toArabDigits } from "@/lib/munaqosah-hufadz";
import {
  formatAngkaArab,
  formatTanggalHijriArab,
  formatTanggalMasehiArab,
  offlineProgramKey,
  parseTanggalIndo,
  tahunHijriDari,
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
  const periode =
    tpl.tgl_mulai_arab && tpl.tgl_selesai_arab
      ? `${tpl.tgl_mulai_arab} – ${tpl.tgl_selesai_arab}`
      : "........";

  // Tahun pembelajaran: dari tanggal mulai periode (Masehi + Hijri).
  const tglMulai =
    parseTanggalIndo(tpl.tgl_mulai_indo) ||
    parseTanggalIndo(tpl.tgl_selesai_indo) ||
    new Date();
  const tahunMiladiyah = toArabDigits(tglMulai.getFullYear());
  const tahunHijriyah = toArabDigits(tahunHijriDari(tglMulai));

  // Tanggal cetak = HARI CETAK (bukan tgl_cetak tersimpan), zona WIB.
  const hariIni = new Date();

  // Duf'ah sebagai angka ("Duf'ah 95" -> "٩٥").
  const dufahMatch = String(cert.riwayatSantri.dufahNama || "").match(/\d+/);
  const dufah = dufahMatch ? toArabDigits(dufahMatch[0]) : "";

  // Nilai tabel: baris 1/2/3 = mapel yang dipetakan di template.
  const tabelMapel = (template?.fieldPositions as any)?.tabelMapel || {};
  const nilaiPerMapel = new Map<string, number | null>();
  for (const row of cert.nilaiRows || []) {
    nilaiPerMapel.set(row.mapelId, row.skor ?? null);
  }
  const nilaiBaris = (key: string) => {
    const mapelId = tabelMapel[key];
    if (!mapelId) return "";
    const skor = nilaiPerMapel.get(mapelId);
    return skor === null || skor === undefined ? "" : formatAngkaArab(skor);
  };

  const texts: Record<string, string> = {
    nama: cert.masterSantri?.nama || "-",
    tempatLahir: (cert.masterSantri?.tempatLahir || "").trim() || "-",
    program: cert.program.nama_arab || programNamaIndo,
    dufah,
    periode,
    tahunHijriyah,
    tahunMiladiyah,
    muaddal: formatAngkaArab(cert.average),
    taqdir: cert.averagePredikat?.arab || "",
    tglCetakHijriyah: formatTanggalHijriArab(hariIni),
    tglCetakMiladiyah: formatTanggalMasehiArab(hariIni),
    nilaiBaris1: nilaiBaris("baris1"),
    nilaiBaris2: nilaiBaris("baris2"),
    nilaiBaris3: nilaiBaris("baris3"),
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
          fieldPositions: (template.fieldPositions as any) || {},
          locked: (template as any).locked ?? false,
          offsetX: (template as any).offsetX ?? 0,
          offsetY: (template as any).offsetY ?? 0,
        }
      : null,
  };
}
