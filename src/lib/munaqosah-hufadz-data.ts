import prisma from "@/lib/prisma";
import { getActiveDufahName } from "@/lib/absensi";
import { getBaseUrl } from "@/lib/base-url";
import {
  MUNAQOSAH_PEMBUKA,
  MUNAQOSAH_DOA,
  MUNAQOSAH_QR_LABEL,
  MUNAQOSAH_NILAI_FIELDS,
  hitungNilaiAkhir,
  predikatArab,
  isMusyarokah,
  kalimatJuz,
  periodeArabNukhbah,
  formatTanggalCetakMunaqosah,
  defaultFieldPositionsMunaqosah,
} from "@/lib/munaqosah-hufadz";

// Data cetak syahadah Munaqosah untuk satu record. Dipakai halaman
// cetak per-santri DAN bulk (satu panggung per santri).
export async function getMunaqosahPrintData(id: string) {
  const rec = await prisma.munaqosahHufadz.findUnique({
    where: { id },
    include: { santri: { select: { nama: true } } },
  });
  if (!rec) return null;

  const [tpl, setting, dufahAktif, baseUrl] = await Promise.all([
    prisma.templateCetak.findUnique({ where: { programKey: "munaqosah-hufadz" } }),
    prisma.syahadahTemplate.findFirst({ orderBy: { id: "asc" } }),
    getActiveDufahName(),
    getBaseUrl(),
  ]);

  const nilai = {
    nilaiHafalan: rec.nilaiHafalan,
    nilaiKelancaran: rec.nilaiKelancaran,
    nilaiTajwid: rec.nilaiTajwid,
    nilaiMakhorijulHuruf: rec.nilaiMakhorijulHuruf,
    nilaiAdab: rec.nilaiAdab,
  };
  const nilaiAkhir = hitungNilaiAkhir(nilai);
  const musyarokah = isMusyarokah(nilaiAkhir);
  const predikat = predikatArab(nilaiAkhir);

  // Nama periode Arab: dufah berjalan -> Nukhbah berjalan (saat ini 1);
  // dufah lama tampil apa adanya (tidak ditebak konversinya).
  const periodeArab =
    rec.dufahNama && dufahAktif && rec.dufahNama === dufahAktif
      ? periodeArabNukhbah(1)
      : rec.dufahNama;

  const mulai = setting?.tgl_mulai_arab ?? "";
  const selesai = setting?.tgl_selesai_arab ?? "";
  const tanggalPeriodeLine =
    mulai && selesai ? `التي تقام خلال فترات ${mulai} إلى ${selesai}` : "";

  const verifyUrl = `${baseUrl}/verifikasi-munaqosah/${rec.verifyToken}`;
  let qrUrl: string | null = null;
  try {
    const mod: any = await import("qrcode");
    const toDataURL = mod.toDataURL || mod.default?.toDataURL;
    if (toDataURL) qrUrl = await toDataURL(verifyUrl, { margin: 1, width: 400 });
  } catch {
    qrUrl = null;
  }

  return {
    id: rec.id,
    nama: rec.santri.nama || "-",
    pembuka: MUNAQOSAH_PEMBUKA,
    kalimatJuz: kalimatJuz(rec.juzTeks),
    periodeLine: `التي أقيمت في ${periodeArab}`,
    tanggalPeriodeLine,
    doa: MUNAQOSAH_DOA,
    tanggalCetak: `صدرت في باري بتاريخ ${formatTanggalCetakMunaqosah(new Date())}`,
    qrLabel: MUNAQOSAH_QR_LABEL,
    qrUrl,
    verifyUrl,
    // Musyarokah: tabel + predikat disembunyikan (halaman 2 desain Canva).
    tabelNilai: musyarokah
      ? null
      : {
          rows: MUNAQOSAH_NILAI_FIELDS.map((f) => ({
            arab: f.arab,
            nilai: (nilai as any)[f.key],
          })),
          rataRata: nilaiAkhir,
          predikat: predikat ?? "",
        },
    template: {
      backgroundUrl: tpl?.backgroundUrl ?? null,
      fieldPositions: (tpl?.fieldPositions as any) ?? defaultFieldPositionsMunaqosah(),
    },
  };
}
