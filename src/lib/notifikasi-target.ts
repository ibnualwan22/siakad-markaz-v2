import prisma from "@/lib/prisma";
import { getActiveDufahName } from "@/lib/absensi";
import { lembagaFromProgramKategori, type LembagaId } from "@/lib/lembaga";

// Resolusi target pengumuman ke santri. Aturan lembaga mengikuti pola
// kanonis portal (getSantriMenu di VPS): riwayat berjalan santri = riwayat
// pada dufah santri saat ini (santri.dufahNama), kategori program riwayat
// itu menentukan lembaga via lembagaFromProgramKategori.

// Lembaga satu santri dari riwayat berjalannya. null bila santri tidak
// ditemukan atau belum punya riwayat berjalan.
export async function getLembagaSantri(
  santriId: string
): Promise<LembagaId | null> {
  const santri = await prisma.santriInternal.findUnique({
    where: { id: santriId },
    select: {
      dufahNama: true,
      riwayatRecords: {
        select: {
          dufahNama: true,
          program: { select: { kategori: true } },
        },
      },
    },
  });
  if (!santri) return null;
  const riwayatAktif = santri.riwayatRecords.find(
    (r) => r.dufahNama === santri.dufahNama
  );
  if (!riwayatAktif) return null;
  return lembagaFromProgramKategori(riwayatAktif.program?.kategori ?? null);
}

const LEMBAGA_VALID: LembagaId[] = ["ARABIYAH", "TURATS", "HUFADZ"];

// Normalisasi targetLembaga dari input (admin/API/DB).
// null = GLOBAL (semua lembaga). Memilih ketiga lembaga = global juga.
export function normalisasiTargetLembaga(input: unknown): LembagaId[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const valid = LEMBAGA_VALID.filter((l) => (input as unknown[]).includes(l));
  if (valid.length === 0 || valid.length === LEMBAGA_VALID.length) return null;
  return [...valid];
}

// ID santri aktif yang menjadi target pengiriman.
// Global: semua santri aktif (isAktif, belum checkout).
// Tertarget: santri aktif yang riwayat berjalannya (dufah aktif) berprogram
// dengan kategori yang lembaganya masuk target.
export async function getTargetSantriIds(
  target: LembagaId[] | null
): Promise<string[]> {
  const baseWhere = { isAktif: true, isCheckedOut: false };
  if (!target) {
    const rows = await prisma.santriInternal.findMany({
      where: baseWhere,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  const dufahAktif = await getActiveDufahName();
  if (!dufahAktif) return [];
  const rows = await prisma.riwayatSantri.findMany({
    where: {
      dufahNama: dufahAktif,
      santri: baseWhere,
    },
    select: {
      santriId: true,
      program: { select: { kategori: true } },
    },
  });
  const targetSet = new Set<LembagaId>(target);
  const ids = new Set<string>();
  for (const r of rows) {
    if (targetSet.has(lembagaFromProgramKategori(r.program?.kategori ?? null))) {
      ids.add(r.santriId);
    }
  }
  return [...ids];
}
