import prisma from "@/lib/prisma";

export type MasterSantri = {
  id: string;
  nama: string;
  gender: string;
  sakan: string;
  kamar: string;
  nomorLemari: string;
  dufahNama: string;
  tanggalMulaiDufah: string | null;
  tanggalSampaiDufah: string | null;
  isAktif: boolean;
  kategori: string;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  alamat?: string | null;
  noWaSantri: string;
  kabupaten: string;
  bulanKe: number;
  isCheckedOut: boolean;
};

/**
 * Membaca data santri dari database lokal (SantriInternal).
 * TIDAK lagi menembak API PPDB secara langsung.
 * Untuk update data, sinkronisasi berjalan otomatis di belakang layar
 * via webhook PPDB; kirim ulang dilakukan dari Bawwabah (/periode,
 * tombol Kirim Ulang) — tombol manual di sidebar dihapus (Fase 7).
 */
export async function getMasterSantriList(): Promise<MasterSantri[]> {
  try {
    const santriList = await prisma.santriInternal.findMany({
      where: {
        isAktif: true,
        sakan: { not: "-" },
      },
      orderBy: { nama: "asc" },
    });

    return santriList.map((s) => ({
      id: s.id,
      nama: s.nama ?? "Tanpa Nama",
      gender: s.gender ?? "-",
      sakan: s.sakan ?? "-",
      kamar: s.kamar ?? "-",
      nomorLemari: s.nomorLemari ?? "-",
      dufahNama: s.dufahNama ?? "-",
      tanggalMulaiDufah: null, // Data ini hanya tersedia saat sync
      tanggalSampaiDufah: null,
      isAktif: s.isAktif,
      kategori: s.kategori ?? "-",
      tempatLahir: s.tempat_lahir ?? "",
      tanggalLahir: s.tanggal_lahir ?? null,
      alamat: s.alamat ?? "",
      noWaSantri: s.noWaSantri ?? "-",
      kabupaten: s.kabupaten ?? "-",
      bulanKe: s.bulanKe ?? 0,
      isCheckedOut: s.isCheckedOut ?? false,
    }));
  } catch (error) {
    console.error("Gagal membaca data santri dari database lokal:", error);
    return [];
  }
}

export async function getMasterSantriById(
  id: string
): Promise<MasterSantri | null> {
  try {
    const s = await prisma.santriInternal.findUnique({
      where: { id },
    });

    if (!s) return null;

    return {
      id: s.id,
      nama: s.nama ?? "Tanpa Nama",
      gender: s.gender ?? "-",
      sakan: s.sakan ?? "-",
      kamar: s.kamar ?? "-",
      nomorLemari: s.nomorLemari ?? "-",
      dufahNama: s.dufahNama ?? "-",
      tanggalMulaiDufah: null,
      tanggalSampaiDufah: null,
      isAktif: s.isAktif,
      kategori: s.kategori ?? "-",
      tempatLahir: s.tempat_lahir ?? "",
      tanggalLahir: s.tanggal_lahir ?? null,
      alamat: s.alamat ?? "",
      noWaSantri: s.noWaSantri ?? "-",
      kabupaten: s.kabupaten ?? "-",
      bulanKe: s.bulanKe ?? 0,
      isCheckedOut: s.isCheckedOut ?? false,
    };
  } catch (error) {
    console.error("Gagal membaca data santri by ID dari database:", error);
    return null;
  }
}
