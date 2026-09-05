import prisma from "./prisma";
import { SesiKelas } from "@prisma/client";

/**
 * Cek apakah sebuah tanggal + sesi tertentu adalah hari libur
 */
export async function isSesiLibur(tanggal: Date, sesi: SesiKelas): Promise<boolean> {
  const libur = await prisma.hariLibur.findUnique({
    where: { tanggal }
  });

  if (!libur) return false;
  if (libur.isSemuaSesi) return true;
  return libur.sesiLibur.includes(sesi);
}

/**
 * Cek apakah seluruh hari adalah hari libur (isSemuaSesi true)
 */
export async function isHariLiburFull(tanggal: Date): Promise<boolean> {
  const libur = await prisma.hariLibur.findUnique({
    where: { tanggal }
  });

  return !!libur && libur.isSemuaSesi;
}

/**
 * Ambil data libur untuk sebuah tanggal
 */
export async function getHariLiburTanggal(tanggal: Date) {
  return prisma.hariLibur.findUnique({
    where: { tanggal }
  });
}

/**
 * Hapus auto-injeksi absen kelas (keterangan mengandung "[TRS-")
 * jika hari/sesi tersebut dijadikan libur.
 */
export async function cleanupAbsenKelasForLibur(tanggal: Date, isSemuaSesi: boolean, sesiLibur: SesiKelas[]) {
  // Hanya hapus record yang diinject otomatis oleh sistem (mengandung "[TRS-")
  // dan yang statusnya IZIN atau SAKIT
  const targetStatuses: import("@prisma/client").StatusAbsen[] = ["IZIN", "SAKIT"];
  const targetKeterangan = { contains: "[TRS-" };

  if (isSemuaSesi) {
    await prisma.absenKelas.deleteMany({
      where: {
        tanggal: tanggal,
        status: { in: targetStatuses },
        keterangan: targetKeterangan
      }
    });
  } else if (sesiLibur.length > 0) {
    await prisma.absenKelas.deleteMany({
      where: {
        tanggal: tanggal,
        sesi: { in: sesiLibur },
        status: { in: targetStatuses },
        keterangan: targetKeterangan
      }
    });
  }
}
