import prisma from "@/lib/prisma";
import {
  AKBARNAS_MC_JUDUL,
  AKBARNAS_MC_PEMBUKA,
  AKBARNAS_MC_PENGHARGAAN,
  AKBARNAS_MC_TAHUN_AJARAN,
  AKBARNAS_MC_TAUQI,
  defaultFieldPositionsAkbarnasMc,
  formatTanggalPemberianMC,
} from "@/lib/akbarnas-mc";

// Data cetak syahadah MC Akbarnas bulan 1 untuk satu riwayat.
// Dipakai halaman cetak per-santri DAN cetak bulk Data Syahadah,
// supaya gerbang dan isinya tidak bercabang dua.
// Gerbang: program Akbarnas DAN nilai mapel MC pada riwayat itu terisi
// (nilaiAkhir != null, berapa pun nilainya). null = tidak berhak.
export async function getAkbarnasMcPrintData(riwayatId: string) {
  const riwayat = await prisma.riwayatSantri.findUnique({
    where: { id: riwayatId },
    include: {
      santri: { select: { nama: true } },
      program: { select: { nama_indo: true } },
      nilaiList: {
        include: { mapel: { select: { nama_indo: true } } },
      },
    },
  });
  const nilaiMc = riwayat?.nilaiList.find(
    (n) => n.mapel.nama_indo === "MC",
  );
  if (
    !riwayat ||
    riwayat.program?.nama_indo !== "Akbarnas" ||
    nilaiMc?.nilaiAkhir == null
  ) {
    return null;
  }

  const template = await prisma.templateCetak.findUnique({
    where: { programKey: "akbarnas-mc" },
  });
  const syahadahTemplate = await prisma.syahadahTemplate.findFirst();

  return {
    nama: riwayat.santri.nama || "-",
    judul: AKBARNAS_MC_JUDUL,
    pembuka: AKBARNAS_MC_PEMBUKA,
    penghargaan: AKBARNAS_MC_PENGHARGAAN,
    tahunAjaran: AKBARNAS_MC_TAHUN_AJARAN,
    // Tanggal pemberian = tanggal cetak (hari ini, WIB) + konversi
    // Hijri Umm al-Qura — bukan tanggal statis.
    tanggalPemberian: formatTanggalPemberianMC(new Date()),
    tauqi: AKBARNAS_MC_TAUQI,
    namaMudir: syahadahTemplate?.nama_mudir_arab || "اسم المدير",
    signatureUrl: "/images/signature.png",
    periode: "",
    template: {
      backgroundUrl: template?.backgroundUrl || "/images/syahadah-bg.png",
      fieldPositions:
        (template?.fieldPositions as any) ||
        defaultFieldPositionsAkbarnasMc(),
    },
  };
}
