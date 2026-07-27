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
