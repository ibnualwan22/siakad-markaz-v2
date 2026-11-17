import { UbudiyahKegiatan, UbudiyahStatus } from "@prisma/client";
import { formatTanggalWa } from "./whatsapp";
import type { LembagaId } from "./lembaga";

/**
 * Ubudiyah — absensi kegiatan wajib berjamaah per sakan. Qism Ubudiyah
 * yang ditunjuk admin mengisi absen lewat portal santri; laporan harian
 * masbuq + ghoib dikirim WA tiap 06:00 ke penanggung jawab Ubudiyah,
 * plus pesan kedua khusus "Lainnya" (bila ada) ke nomor yang sama.
 *
 * Kegiatan: Subuh, Maghrib, Isya, Halaqoh untuk semua lembaga, DITAMBAH
 * Dzuhur & Ashar khusus Turats dan Hufadz (sama-sama 4 rakaat, opsi
 * dropdownnya sama seperti Isya). Laporan dipisah per lembaga: Arabiyah
 * ke nomor penanggung jawab Arabiyah, Turats + Hufadz (gabungan) ke
 * nomor penanggung jawab Turats/Hufadz.
 */

/** Urutan kegiatan dalam sehari; juga urutan daftar kegiatan di laporan. */
export const UBUDIYAH_KEGIATAN_ORDER: UbudiyahKegiatan[] = [
  UbudiyahKegiatan.SUBUH,
  UbudiyahKegiatan.DZUHUR,
  UbudiyahKegiatan.ASHAR,
  UbudiyahKegiatan.MAGHRIB,
  UbudiyahKegiatan.ISYA,
  UbudiyahKegiatan.HALAQOH,
];

/** Kegiatan yang masuk jendela "kemarin" di laporan (selain Subuh). */
export const UBUDIYAH_KEGIATAN_KEMARIN: UbudiyahKegiatan[] = [
  UbudiyahKegiatan.DZUHUR,
  UbudiyahKegiatan.ASHAR,
  UbudiyahKegiatan.MAGHRIB,
  UbudiyahKegiatan.ISYA,
  UbudiyahKegiatan.HALAQOH,
];

/**
 * Kegiatan yang tampil di portal per lembaga: Dzuhur & Ashar hanya
 * untuk Turats dan Hufadz; Arabiyah tetap Subuh, Maghrib, Isya, Halaqoh.
 */
export function ubudiyahKegiatanUntukLembaga(lembaga: LembagaId): UbudiyahKegiatan[] {
  if (lembaga === "ARABIYAH") {
    return [
      UbudiyahKegiatan.SUBUH,
      UbudiyahKegiatan.MAGHRIB,
      UbudiyahKegiatan.ISYA,
      UbudiyahKegiatan.HALAQOH,
    ];
  }
  return UBUDIYAH_KEGIATAN_ORDER;
}

/** Label kegiatan untuk UI (dropdown / tabel). */
export const UBUDIYAH_KEGIATAN_LABEL: Record<UbudiyahKegiatan, string> = {
  [UbudiyahKegiatan.SUBUH]: "Subuh",
  [UbudiyahKegiatan.DZUHUR]: "Dzuhur",
  [UbudiyahKegiatan.ASHAR]: "Ashar",
  [UbudiyahKegiatan.MAGHRIB]: "Maghrib",
  [UbudiyahKegiatan.ISYA]: "Isya",
  [UbudiyahKegiatan.HALAQOH]: "Halaqoh",
};

/** Label kegiatan untuk pesan laporan WA (huruf kecil). */
export const UBUDIYAH_KEGIATAN_LABEL_KECIL: Record<UbudiyahKegiatan, string> = {
  [UbudiyahKegiatan.SUBUH]: "subuh",
  [UbudiyahKegiatan.DZUHUR]: "dzuhur",
  [UbudiyahKegiatan.ASHAR]: "ashar",
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
  [UbudiyahStatus.LAINNYA]: "Lainnya",
};

/**
 * Opsi status yang boleh dipilih per kegiatan. Jumlah rakaat masbuq
 * dibatasi jumlah rakaat shalatnya: Subuh maks 2, Maghrib maks 3,
 * Isya/Dzuhur/Ashar maks 4. Halaqoh hanya hadir / tidak hadir.
 */
export const UBUDIYAH_STATUS_OPTIONS: Record<UbudiyahKegiatan, UbudiyahStatus[]> = {
  [UbudiyahKegiatan.SUBUH]: [
    UbudiyahStatus.TEPAT_WAKTU,
    UbudiyahStatus.MASBUQ_1,
    UbudiyahStatus.MASBUQ_2,
    UbudiyahStatus.GHOIB,
    UbudiyahStatus.LAINNYA,
  ],
  [UbudiyahKegiatan.DZUHUR]: [
    UbudiyahStatus.TEPAT_WAKTU,
    UbudiyahStatus.MASBUQ_1,
    UbudiyahStatus.MASBUQ_2,
    UbudiyahStatus.MASBUQ_3,
    UbudiyahStatus.MASBUQ_4,
    UbudiyahStatus.GHOIB,
    UbudiyahStatus.LAINNYA,
  ],
  [UbudiyahKegiatan.ASHAR]: [
    UbudiyahStatus.TEPAT_WAKTU,
    UbudiyahStatus.MASBUQ_1,
    UbudiyahStatus.MASBUQ_2,
    UbudiyahStatus.MASBUQ_3,
    UbudiyahStatus.MASBUQ_4,
    UbudiyahStatus.GHOIB,
    UbudiyahStatus.LAINNYA,
  ],
  [UbudiyahKegiatan.MAGHRIB]: [
    UbudiyahStatus.TEPAT_WAKTU,
    UbudiyahStatus.MASBUQ_1,
    UbudiyahStatus.MASBUQ_2,
    UbudiyahStatus.MASBUQ_3,
    UbudiyahStatus.GHOIB,
    UbudiyahStatus.LAINNYA,
  ],
  [UbudiyahKegiatan.ISYA]: [
    UbudiyahStatus.TEPAT_WAKTU,
    UbudiyahStatus.MASBUQ_1,
    UbudiyahStatus.MASBUQ_2,
    UbudiyahStatus.MASBUQ_3,
    UbudiyahStatus.MASBUQ_4,
    UbudiyahStatus.GHOIB,
    UbudiyahStatus.LAINNYA,
  ],
  [UbudiyahKegiatan.HALAQOH]: [
    UbudiyahStatus.HADIR,
    UbudiyahStatus.TIDAK_HADIR,
    UbudiyahStatus.LAINNYA,
  ],
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

/** Satu baris seksi Belum Absen di laporan harian: sakan + kegiatan
 * yang tidak diisi sama sekali (tidak ada baris UbudiyahHadir). */
export type UbudiyahReportBelumAbsenRow = {
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

/** Bagi satu baris laporan (masbuq/ghoib) ke jendela kemarin vs hari ini:
 * Subuh masuk jendela hari ini, kegiatan lain masuk jendela kemarin.
 * Satu baris bisa terbelah dua (mis. masbuq subuh + maghrib). */
function bagiBarisPerJendela<T extends { kegiatan: UbudiyahKegiatan[] }>(
  row: T
): { kemarin: T | null; hariIni: T | null } {
  const kegKemarin = row.kegiatan.filter((k) => k !== UbudiyahKegiatan.SUBUH);
  const kegHariIni = row.kegiatan.filter((k) => k === UbudiyahKegiatan.SUBUH);
  return {
    kemarin: kegKemarin.length > 0 ? { ...row, kegiatan: kegKemarin } : null,
    hariIni: kegHariIni.length > 0 ? { ...row, kegiatan: kegHariIni } : null,
  };
}

/** Satu seksi (satu tanggal) laporan: header + subjudul + blok Masbuq/Ghoib
 * + blok Belum Absen. Bila `adaAbsen` true tapi seksi ini kosong (semua
 * tepat waktu/hadir dan semua sakan mengisi), tampil baris nihil agar
 * pesannya tidak disangka libur. */
function formatSeksiLaporan(
  header: string,
  subtitle: string,
  masbuq: UbudiyahReportMasbuqRow[],
  ghoib: UbudiyahReportGhoibRow[],
  belumAbsen: UbudiyahReportBelumAbsenRow[] = [],
  adaAbsen = false
): string {
  const lines: string[] = [header, subtitle, ""];
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
  if (belumAbsen.length > 0) {
    if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
    lines.push(`⚠️ Belum absen (${belumAbsen.length})`);
    for (const row of [...belumAbsen].sort((a, b) =>
      a.sakan.localeCompare(b.sakan, "id")
    )) {
      lines.push(
        `${row.sakan} — tidak mengisi absen (${formatUbudiyahKegiatanList(row.kegiatan)})`
      );
    }
  }
  if (
    masbuq.length === 0 &&
    ghoib.length === 0 &&
    belumAbsen.length === 0 &&
    adaAbsen
  ) {
    lines.push("Tidak ada santri masbuq/ghoib.");
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.join("\n");
}

/**
 * Format laporan harian Ubudiyah menjadi SATU pesan WhatsApp dengan DUA
 * judul tanggal: kegiatan kemarin (Dzuhur, Ashar, Maghrib, Isya,
 * Halaqoh) memakai tanggal kemarin, Subuh memakai judul baru dengan
 * tanggal hari ini. Kedua jendela selalu ditampilkan bila bukan libur;
 * jendela yang kosong berisi baris "Tidak ada santri masbuq/ghoib."
 *
 * `opts.adaAbsen` = ada baris absen sama sekali di jendela laporan.
 * Libur HANYA bila tidak ada satu pun baris absen (tidak ada sakan
 * yang mengisi absen sama sekali) — bukan lagi bila masbuq/ghoib
 * kosong. `opts.belumAbsen` = sakan yang tidak mengisi absen (tampil
 * sebagai seksi peringatan per jendela); `opts.qismDiganti` = sakan
 * yang Qism-nya perlu segera diganti (tampil sebagai seksi peringatan
 * di akhir pesan).
 *
 * Isi laporan = Subuh hari ini + kegiatan kemarin (Subuh kemarin sudah
 * masuk rekap kemarin). Halaqoh yang tidak hadir masuk seksi Ghoib;
 * di laporan Ghoib cukup tampil jenis kegiatan. TIDAK ADA keterangan
 * di pesan. `kegiatanKemarin` = daftar kegiatan jendela kemarin untuk
 * laporan ini (Arabiyah: Maghrib, Isya, Halaqoh; Turats+Hufadz:
 * Dzuhur, Ashar, Maghrib, Isya, Halaqoh) — dipakai untuk subjudul.
 *
 * Contoh output:
 * ```
 * 📿 *Sabtu, 14 November 2026*
 * Dzuhur, Ashar, Maghrib, Isya, Halaqoh tadi malam
 *
 * `Masbuq` (2)
 * Ahmad_Sunan Ampel_masbuq 2 raka'at (maghrib, isya)
 * Budi_Sunan Muria_masbuq 1 raka'at (dzuhur)
 *
 * `Ghoib` (1)
 * Candra_Sunan Ampel_GHOIB (halaqoh)
 *
 * 📿 *Minggu, 15 November 2026*
 * Subuh hari ini
 *
 * `Masbuq` (1)
 * Ahmad_Sunan Ampel_masbuq 2 raka'at (subuh)
 * ```
 *
 * Bila tidak ada satu pun baris absen di seluruh jendela (libur):
 * ```
 * 📿 *Sabtu, 14 November 2026*
 * 📿 *Minggu, 15 November 2026*
 *
 * Libur — tidak ada santri masbuq/ghoib.
 * ```
 */
export function formatUbudiyahReport(
  tanggalKemarin: Date,
  tanggalHariIni: Date,
  masbuq: UbudiyahReportMasbuqRow[],
  ghoib: UbudiyahReportGhoibRow[],
  kegiatanKemarin: UbudiyahKegiatan[],
  opts: {
    /** Ada baris absen sama sekali di jendela laporan (kemarin + Subuh
     * hari ini). Bila false -> libur. Bila tidak diisi, libur mengikuti
     * aturan lama: masbuq/ghoib/belumAbsen/qismDiganti semuanya kosong. */
    adaAbsen?: boolean;
    /** Sakan yang tidak mengisi absen (per sakan + kegiatan). */
    belumAbsen?: UbudiyahReportBelumAbsenRow[];
    /** Sakan yang Qism-nya perlu segera diganti (Qism sudah checkout). */
    qismDiganti?: string[];
  } = {}
): string {
  const headerKemarin = `📿 ${formatTanggalWa(toTanggalWaString(tanggalKemarin))}`;
  const headerHariIni = `📿 ${formatTanggalWa(toTanggalWaString(tanggalHariIni))}`;
  const belumAbsen = opts.belumAbsen ?? [];
  const qismDiganti = [...(opts.qismDiganti ?? [])].sort((a, b) =>
    a.localeCompare(b, "id")
  );
  const adaAbsen =
    opts.adaAbsen ??
    (masbuq.length > 0 ||
      ghoib.length > 0 ||
      belumAbsen.length > 0 ||
      qismDiganti.length > 0);

  const mKemarin: UbudiyahReportMasbuqRow[] = [];
  const mHariIni: UbudiyahReportMasbuqRow[] = [];
  const gKemarin: UbudiyahReportGhoibRow[] = [];
  const gHariIni: UbudiyahReportGhoibRow[] = [];
  const bKemarin: UbudiyahReportBelumAbsenRow[] = [];
  const bHariIni: UbudiyahReportBelumAbsenRow[] = [];
  for (const row of masbuq) {
    const { kemarin, hariIni } = bagiBarisPerJendela(row);
    if (kemarin) mKemarin.push(kemarin);
    if (hariIni) mHariIni.push(hariIni);
  }
  for (const row of ghoib) {
    const { kemarin, hariIni } = bagiBarisPerJendela(row);
    if (kemarin) gKemarin.push(kemarin);
    if (hariIni) gHariIni.push(hariIni);
  }
  for (const row of belumAbsen) {
    const { kemarin, hariIni } = bagiBarisPerJendela(row);
    if (kemarin) bKemarin.push(kemarin);
    if (hariIni) bHariIni.push(hariIni);
  }

  // Libur HANYA bila tidak ada satu pun baris absen di seluruh jendela
  // (tidak ada sakan yang mengisi absen sama sekali).
  if (!adaAbsen) {
    return `${headerKemarin}\n${headerHariIni}\n\nLibur — tidak ada santri masbuq/ghoib.`;
  }

  const subtitleKemarin = `${[...kegiatanKemarin]
    .sort(
      (a, b) =>
        UBUDIYAH_KEGIATAN_ORDER.indexOf(a) - UBUDIYAH_KEGIATAN_ORDER.indexOf(b)
    )
    .map((k) => UBUDIYAH_KEGIATAN_LABEL_KECIL[k])
    .join(", ")} tadi malam`;

  const sections: string[] = [];
  sections.push(
    formatSeksiLaporan(
      headerKemarin,
      subtitleKemarin,
      mKemarin,
      gKemarin,
      bKemarin,
      true
    )
  );
  sections.push(
    formatSeksiLaporan(
      headerHariIni,
      "Subuh hari ini",
      mHariIni,
      gHariIni,
      bHariIni,
      true
    )
  );
  if (qismDiganti.length > 0) {
    sections.push(
      [
        `⚠️ Qism perlu segera diganti (${qismDiganti.length})`,
        ...qismDiganti.map((sakan) => `${sakan} — Qism sudah checkout`),
      ].join("\n")
    );
  }
  return sections.join("\n\n");
}

/** Satu baris seksi Lainnya di laporan kedua (satu baris per kegiatan,
 *  karena keterangannya bisa beda tiap kegiatan). */
export type UbudiyahReportLainnyaRow = {
  nama: string;
  sakan: string;
  kegiatan: UbudiyahKegiatan;
  keterangan: string;
};

/**
 * Format laporan kedua Ubudiyah (khusus "Lainnya") menjadi pesan WhatsApp
 * terpisah — dikirim ke nomor yang sama dengan laporan utama, hanya bila
 * ada entri Lainnya. Berbeda dengan laporan utama, pesan ini MENAMPILKAN
 * keterangan tiap baris (alasan "lainnya"-nya justru yang perlu dibaca).
 * Sama seperti laporan utama: SATU pesan dengan DUA judul tanggal
 * (kemarin untuk Dzuhur/Ashar/Maghrib/Isya/Halaqoh, hari ini untuk
 * Subuh); jendela yang kosong tidak ditampilkan.
 *
 * Contoh output:
 * ```
 * 📿 *Sabtu, 14 November 2026*
 * Dzuhur, Ashar, Maghrib, Isya, Halaqoh tadi malam
 *
 * `Lainnya` (2)
 * Ahmad_Sunan Ampel_lainnya (isya) — sakit
 * Budi_Sunan Muria_lainnya (dzuhur) — izin pulang
 *
 * 📿 *Minggu, 15 November 2026*
 * Subuh hari ini
 *
 * `Lainnya` (1)
 * Ahmad_Sunan Ampel_lainnya (subuh) — terlambat bangun
 * ```
 */
export function formatUbudiyahReportLainnya(
  tanggalKemarin: Date,
  tanggalHariIni: Date,
  lainnya: UbudiyahReportLainnyaRow[],
  kegiatanKemarin: UbudiyahKegiatan[]
): string {
  const headerKemarin = `📿 ${formatTanggalWa(toTanggalWaString(tanggalKemarin))}`;
  const headerHariIni = `📿 ${formatTanggalWa(toTanggalWaString(tanggalHariIni))}`;
  const subtitleKemarin = `${[...kegiatanKemarin]
    .sort(
      (a, b) =>
        UBUDIYAH_KEGIATAN_ORDER.indexOf(a) - UBUDIYAH_KEGIATAN_ORDER.indexOf(b)
    )
    .map((k) => UBUDIYAH_KEGIATAN_LABEL_KECIL[k])
    .join(", ")} tadi malam`;

  const urutLainnya = (rows: UbudiyahReportLainnyaRow[]) =>
    [...rows].sort(
      (a, b) =>
        compareUbudiyahReportRows(a, b) ||
        UBUDIYAH_KEGIATAN_ORDER.indexOf(a.kegiatan) -
          UBUDIYAH_KEGIATAN_ORDER.indexOf(b.kegiatan)
    );

  const formatSeksiLainnya = (
    header: string,
    subtitle: string,
    rows: UbudiyahReportLainnyaRow[]
  ): string => {
    const lines: string[] = [header, subtitle, "", `\`Lainnya\` (${rows.length})`];
    for (const row of urutLainnya(rows)) {
      lines.push(
        `${row.nama}_${row.sakan}_lainnya (${UBUDIYAH_KEGIATAN_LABEL_KECIL[row.kegiatan]}) — ${row.keterangan}`
      );
    }
    return lines.join("\n");
  };

  const lKemarin = lainnya.filter((r) => r.kegiatan !== UbudiyahKegiatan.SUBUH);
  const lHariIni = lainnya.filter((r) => r.kegiatan === UbudiyahKegiatan.SUBUH);

  const sections: string[] = [];
  if (lKemarin.length > 0) {
    sections.push(formatSeksiLainnya(headerKemarin, subtitleKemarin, lKemarin));
  }
  if (lHariIni.length > 0) {
    sections.push(formatSeksiLainnya(headerHariIni, "Subuh hari ini", lHariIni));
  }
  return sections.join("\n\n");
}
