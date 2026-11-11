import { UbudiyahKegiatan, UbudiyahStatus } from "@prisma/client";
import { formatTanggalWa } from "./whatsapp";

/**
 * Ubudiyah — absensi kegiatan wajib berjamaah (Subuh/Maghrib/Isya/
 * Halaqoh) per sakan. Qism Ubudiyah yang ditunjuk admin mengisi absen
 * lewat portal santri; laporan harian masbuq + ghoib dikirim WA tiap
 * 06:00 ke penanggung jawab Ubudiyah.
 */

/** Urutan kegiatan dalam sehari; juga urutan daftar kegiatan di laporan. */
export const UBUDIYAH_KEGIATAN_ORDER: UbudiyahKegiatan[] = [
  UbudiyahKegiatan.SUBUH,
  UbudiyahKegiatan.MAGHRIB,
  UbudiyahKegiatan.ISYA,
  UbudiyahKegiatan.HALAQOH,
];

/** Label kegiatan untuk UI (dropdown / tabel). */
export const UBUDIYAH_KEGIATAN_LABEL: Record<UbudiyahKegiatan, string> = {
  [UbudiyahKegiatan.SUBUH]: "Subuh",
  [UbudiyahKegiatan.MAGHRIB]: "Maghrib",
  [UbudiyahKegiatan.ISYA]: "Isya",
  [UbudiyahKegiatan.HALAQOH]: "Halaqoh",
};

/** Label kegiatan untuk pesan laporan WA (huruf kecil). */
export const UBUDIYAH_KEGIATAN_LABEL_KECIL: Record<UbudiyahKegiatan, string> = {
  [UbudiyahKegiatan.SUBUH]: "subuh",
  [UbudiyahKegiatan.MAGHRIB]: "maghrib",
  [UbudiyahKegiatan.ISYA]: "isya",
  [UbudiyahKegiatan.HALAQOH]: "halaqoh",
};

/** Label status absen untuk UI. */
export const UBUDIYAH_STATUS_LABEL: Record<UbudiyahStatus, string> = {
  [UbudiyahStatus.TEPAT_WAKTU]: "Tepat waktu",
  [UbudiyahStatus.MASBUQ_1]: "Masbuq 1 rakaat",
  [UbudiyahStatus.MASBUQ_2]: "Masbuq 2 rakaat",
  [UbudiyahStatus.MASBUQ_3]: "Masbuq 3 rakaat",
  [UbudiyahStatus.MASBUQ_4]: "Masbuq 4 rakaat",
  [UbudiyahStatus.GHOIB]: "Ghoib",
  [UbudiyahStatus.HADIR]: "Hadir",
  [UbudiyahStatus.TIDAK_HADIR]: "Tidak hadir",
};

/**
 * Opsi status yang boleh dipilih per kegiatan. Jumlah rakaat masbuq
 * dibatasi jumlah rakaat shalatnya: Subuh maks 2, Maghrib maks 3,
 * Isya maks 4. Halaqoh hanya hadir / tidak hadir.
 */
export const UBUDIYAH_STATUS_OPTIONS: Record<UbudiyahKegiatan, UbudiyahStatus[]> = {
  [UbudiyahKegiatan.SUBUH]: [
    UbudiyahStatus.TEPAT_WAKTU,
    UbudiyahStatus.MASBUQ_1,
    UbudiyahStatus.MASBUQ_2,
    UbudiyahStatus.GHOIB,
  ],
  [UbudiyahKegiatan.MAGHRIB]: [
    UbudiyahStatus.TEPAT_WAKTU,
    UbudiyahStatus.MASBUQ_1,
    UbudiyahStatus.MASBUQ_2,
    UbudiyahStatus.MASBUQ_3,
    UbudiyahStatus.GHOIB,
  ],
  [UbudiyahKegiatan.ISYA]: [
    UbudiyahStatus.TEPAT_WAKTU,
    UbudiyahStatus.MASBUQ_1,
    UbudiyahStatus.MASBUQ_2,
    UbudiyahStatus.MASBUQ_3,
    UbudiyahStatus.MASBUQ_4,
    UbudiyahStatus.GHOIB,
  ],
  [UbudiyahKegiatan.HALAQOH]: [UbudiyahStatus.HADIR, UbudiyahStatus.TIDAK_HADIR],
};

/** Apakah status ini pilihan yang sah untuk kegiatan tersebut? */
export function isValidUbudiyahStatus(
  kegiatan: UbudiyahKegiatan,
  status: UbudiyahStatus
): boolean {
  return UBUDIYAH_STATUS_OPTIONS[kegiatan]?.includes(status) ?? false;
}

/**
 * Apakah status ini wajib disertai keterangan? Wajib bila bukan tepat
 * waktu / hadir (masbuq, ghoib, tidak hadir).
 */
export function isUbudiyahKeteranganRequired(status: UbudiyahStatus): boolean {
  return status !== UbudiyahStatus.TEPAT_WAKTU && status !== UbudiyahStatus.HADIR;
}

/** Apakah status ini salah satu masbuq (MASBUQ_1..4)? */
export function isUbudiyahMasbuq(status: UbudiyahStatus): boolean {
  return getUbudiyahMasbuqLevel(status) !== null;
}

/** Level masbuq (1..4 rakaat) dari status, atau null bila bukan masbuq. */
export function getUbudiyahMasbuqLevel(status: UbudiyahStatus): 1 | 2 | 3 | 4 | null {
  switch (status) {
    case UbudiyahStatus.MASBUQ_1:
      return 1;
    case UbudiyahStatus.MASBUQ_2:
      return 2;
    case UbudiyahStatus.MASBUQ_3:
      return 3;
    case UbudiyahStatus.MASBUQ_4:
      return 4;
    default:
      return null;
  }
}

/** Satu baris seksi Masbuq di laporan harian. */
export type UbudiyahReportMasbuqRow = {
  nama: string;
  sakan: string;
  level: 1 | 2 | 3 | 4;
  kegiatan: UbudiyahKegiatan[];
};

/** Satu baris seksi Ghoib di laporan harian. */
export type UbudiyahReportGhoibRow = {
  nama: string;
  sakan: string;
  kegiatan: UbudiyahKegiatan[];
};

/** Urutan baris laporan: sakan ASC lalu nama ASC (locale Indonesia). */
function compareUbudiyahReportRows(
  a: { sakan: string; nama: string },
  b: { sakan: string; nama: string }
): number {
  return (
    a.sakan.localeCompare(b.sakan, "id") || a.nama.localeCompare(b.nama, "id")
  );
}

/** Daftar kegiatan satu baris, diurutkan ikut UBUDIYAH_KEGIATAN_ORDER. */
function formatUbudiyahKegiatanList(kegiatan: UbudiyahKegiatan[]): string {
  return [...kegiatan]
    .sort(
      (a, b) =>
        UBUDIYAH_KEGIATAN_ORDER.indexOf(a) - UBUDIYAH_KEGIATAN_ORDER.indexOf(b)
    )
    .map((k) => UBUDIYAH_KEGIATAN_LABEL_KECIL[k])
    .join(", ");
}

/** Date -> "YYYY-MM-DD" lokal (tanpa geser zona waktu), untuk formatTanggalWa. */
function toTanggalWaString(tanggal: Date): string {
  const y = tanggal.getFullYear();
  const m = String(tanggal.getMonth() + 1).padStart(2, "0");
  const d = String(tanggal.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format laporan harian Ubudiyah menjadi pesan WhatsApp.
 *
 * Isi laporan = Subuh hari ini + Maghrib, Isya, Halaqoh tadi malam
 * (Subuh kemarin sudah masuk rekap kemarin). Halaqoh yang tidak hadir
 * masuk seksi Ghoib; di laporan Ghoib cukup tampil jenis kegiatan.
 * TIDAK ADA keterangan di pesan.
 *
 * Contoh output:
 * ```
 * 📿 *Rabu, 11 November 2026*
 * Subuh hari ini + Maghrib, Isya, Halaqoh tadi malam
 *
 * `Masbuq` (2)
 * Ahmad_Sunan Ampel_masbuq 2 raka'at (subuh, maghrib)
 * Budi_Sunan Muria_masbuq 1 raka'at (isya)
 *
 * `Ghoib` (1)
 * Candra_Sunan Ampel_GHOIB (subuh, halaqoh)
 * ```
 *
 * Bila masbuq dan ghoib keduanya kosong (nihil = libur):
 * ```
 * 📿 *Rabu, 11 November 2026*
 *
 * Libur — tidak ada santri masbuq/ghoib.
 * ```
 */
export function formatUbudiyahReport(
  tanggal: Date,
  masbuq: UbudiyahReportMasbuqRow[],
  ghoib: UbudiyahReportGhoibRow[]
): string {
  const header = `📿 ${formatTanggalWa(toTanggalWaString(tanggal))}`;

  if (masbuq.length === 0 && ghoib.length === 0) {
    return `${header}\n\nLibur — tidak ada santri masbuq/ghoib.`;
  }

  const lines: string[] = [
    header,
    "Subuh hari ini + Maghrib, Isya, Halaqoh tadi malam",
    "",
  ];

  if (masbuq.length > 0) {
    lines.push(`\`Masbuq\` (${masbuq.length})`);
    for (const row of [...masbuq].sort(compareUbudiyahReportRows)) {
      lines.push(
        `${row.nama}_${row.sakan}_masbuq ${row.level} raka'at (${formatUbudiyahKegiatanList(row.kegiatan)})`
      );
    }
    lines.push("");
  }

  if (ghoib.length > 0) {
    lines.push(`\`Ghoib\` (${ghoib.length})`);
    for (const row of [...ghoib].sort(compareUbudiyahReportRows)) {
      lines.push(
        `${row.nama}_${row.sakan}_GHOIB (${formatUbudiyahKegiatanList(row.kegiatan)})`
      );
    }
  }

  // Hapus baris kosong di akhir bila seksi Ghoib tidak ada.
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}
