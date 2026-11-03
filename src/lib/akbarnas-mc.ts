// Syahadah penghargaan MC Akbarnas bulan 1.
//
// Regulasi baru (Nov 2026): santri Akbarnas bulan 1 yang nilai MC-nya
// sudah terisi berhak atas syahadah penghargaan ini — TERPISAH dari
// syahadah kelulusan gabungan (bulan 1 + bulan 2). Syaratnya HANYA nilai
// MC terisi (nilaiAkhir != null, berapa pun nilainya, termasuk 0);
// tidak ada syarat lulus/KKM.
// Background: desain syahadah offline persis (public/images/syahadah-bg.png
// — bingkai, header, basmalah, garis SK; TANPA teks isi) sehingga semua
// teks di bawah dirender web sebagai field template yang bisa digeser
// dan diubah ukurannya, seperti Nadi/Lajnah/OSIM.

export const AKBARNAS_MC_PROGRAM_KEY = "akbarnas-mc";

export const AKBARNAS_MC_PEMBUKA =
  "تتقدم دورة مركز العربية على أساس الذكاءات المتعددة\nبوافر الشكر وعظيم الامتنان إلى";

export const AKBARNAS_MC_PENGHARGAAN =
  "تقديرا لتقدمه/ها كمقسم الأوقات في برنامج أكبرناس لدورة مركز العربية على أساس الذكاءات المتعددة";

// Tahun ajaran ditulis statis sesuai daftar user (bukan tahun berjalan),
// dengan angka Arab (bukan Latin) seperti baris tanggal pemberian.
export const AKBARNAS_MC_TAHUN_AJARAN = "للسنة الدراسية ٢٠٢٦م";

export const AKBARNAS_MC_TAUQI = "التوقيع";

const HARI_ARAB = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const BULAN_MASEHI_ARAB = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const BULAN_HIJRI_ARAB = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

const DIGIT_ARAB = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function keAngkaArab(n: number): string {
  return String(n).replace(/\d/g, (d) => DIGIT_ARAB[Number(d)]);
}

/**
 * Baris tanggal pemberian dari TANGGAL CETAK (bukan tanggal statis).
 * Contoh: 5 Nov 2026 (Kamis) →
 * "ويمنح هذا التقدير يوم الخميس، ٥ من نوفمبر ٢٠٢٦م/ ٢٥ من جمادى الأولى ١٤٤٨ه"
 *
 * Kalender Hijri WAJIB Umm al-Qura: kalender Islam generik memberi 26
 * dan civil memberi 24 untuk tanggal yang sama — contoh user (25)
 * hanya cocok dengan Umm al-Qura. Zona waktu Asia/Jakarta supaya
 * tanggal cetak mengikuti WIB, bukan UTC server.
 */
export function formatTanggalPemberianMC(tanggal: Date): string {
  // Semua komponen Masehi diambil dalam zona Asia/Jakarta (bukan zona
  // lokal runtime) supaya tanggal cetak mengikuti WIB walau server
  // berjalan di zona lain.
  const gParts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).formatToParts(tanggal);
  const gAmbil = (type: string) =>
    gParts.find((p) => p.type === type)?.value || "";
  const hariIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    gAmbil("weekday"),
  );
  const hari = HARI_ARAB[hariIdx] ?? "";
  const tgl = keAngkaArab(Number(gAmbil("day")));
  const bulan = BULAN_MASEHI_ARAB[Number(gAmbil("month")) - 1] ?? "";
  const tahun = keAngkaArab(Number(gAmbil("year")));

  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).formatToParts(tanggal);
  const ambil = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value || 0);
  const hTgl = keAngkaArab(ambil("day"));
  const hBulan = BULAN_HIJRI_ARAB[ambil("month") - 1] ?? "";
  const hTahun = keAngkaArab(ambil("year"));

  return `ويمنح هذا التقدير يوم ${hari}، ${tgl} من ${bulan} ${tahun}م/ ${hTgl} من ${hBulan} ${hTahun}ه`;
}

export type AkbarnasMcFieldCfg = {
  x: number;
  y: number;
  fontSize: number;
  align?: string;
  maxWidth?: number;
  fontFamily?: string;
  color?: string;
};

// Posisi awal (persen panggung) mengikuti tata letak desain offline.
// Admin bisa menggeser/mengubahnya di editor Template & Layout; nilai
// ini hanya dipakai bila belum ada layout tersimpan.
export function defaultFieldPositionsAkbarnasMc(): Record<
  string,
  AkbarnasMcFieldCfg
> {
  return {
    pembuka: { x: 50, y: 38, fontSize: 30, maxWidth: 80 },
    nama: { x: 50, y: 50, fontSize: 44, maxWidth: 80 },
    penghargaan: { x: 50, y: 60, fontSize: 30, maxWidth: 85 },
    tahunAjaran: { x: 50, y: 67, fontSize: 30, maxWidth: 60 },
    tanggalPemberian: { x: 50, y: 73, fontSize: 28, maxWidth: 85 },
    tauqi: { x: 50, y: 80, fontSize: 30, maxWidth: 30 },
    tandaTangan: { x: 50, y: 86, fontSize: 28, maxWidth: 12 },
    namaMudir: { x: 50, y: 94, fontSize: 28, maxWidth: 50 },
  };
}

// Field yang tampil di editor (urutan = urutan atas-ke-bawah di syahadah).
export const AKBARNAS_MC_FIELD_KEYS = [
  "pembuka",
  "nama",
  "penghargaan",
  "tahunAjaran",
  "tanggalPemberian",
  "tauqi",
  "tandaTangan",
  "namaMudir",
] as const;

export const AKBARNAS_MC_FIELD_LABEL: Record<string, string> = {
  pembuka: "Teks Pembuka",
  nama: "Nama Santri",
  penghargaan: "Teks Penghargaan",
  tahunAjaran: "Tahun Ajaran",
  tanggalPemberian: "Tanggal Pemberian",
  tauqi: "Label Tanda Tangan",
  tandaTangan: "Gambar Tanda Tangan",
  namaMudir: "Nama Mudir",
};
