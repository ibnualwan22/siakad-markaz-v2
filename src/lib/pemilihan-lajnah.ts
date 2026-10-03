import type { Prisma, PrismaClient } from "@prisma/client";

type Election = {
  id: string;
  dufahNama: string;
  status: string;
  rencanaTutupAt: Date | null;
};

export class PemilihanLajnahError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "PemilihanLajnahError";
  }
}

export function waktuPemilihanHabis(
  sesi: Pick<Election, "status" | "rencanaTutupAt">,
  now = new Date(),
) {
  return sesi.status === "BUKA" && sesi.rencanaTutupAt !== null
    && sesi.rencanaTutupAt.getTime() <= now.getTime();
}

export function parseRencanaTutup(value: unknown, now = new Date()): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new PemilihanLajnahError("Waktu tutup tidak valid", 400);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now.getTime()) {
    throw new PemilihanLajnahError("Waktu tutup harus berupa waktu yang valid setelah sekarang", 400);
  }
  return date;
}

// Every vote and close operation takes the same PostgreSQL row lock. A closing
// transaction therefore sees all accepted votes, and no vote can arrive after it.
export async function kunciSesiPemilihan(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Election[]>`
    SELECT "id", "dufahNama", "status", "rencanaTutupAt"
    FROM "SesiPemilihanLajnah" WHERE "id" = ${id} FOR UPDATE
  `;
  return rows[0] ?? null;
}

async function tutupSesiTerkunci(tx: Prisma.TransactionClient, sesi: Election, now: Date) {
  if (sesi.status !== "BUKA" && sesi.status !== "TUTUP") {
    throw new PemilihanLajnahError("Hanya sesi yang sedang BUKA yang bisa ditutup", 400);
  }
  const paslon = await tx.paslonLajnah.findMany({
    where: { sesiId: sesi.id },
    include: {
      santri1: { select: { id: true, nama: true } },
      santri2: { select: { id: true, nama: true } },
      _count: { select: { suaraList: true } },
    },
  });
  // Keep the existing policy: ties (including zero votes) use nomorUrut.
  const hasil = paslon
    .map((p) => ({ ...p, suara: p._count.suaraList }))
    .sort((a, b) => b.suara - a.suara || a.nomorUrut - b.nomorUrut);
  const pemenang = hasil[0] ?? null;

  if (sesi.status === "BUKA") {
    if (pemenang) {
      await tx.anggotaLajnah.createMany({
        data: [
          { santriId: pemenang.santri1Id, dufahNama: sesi.dufahNama },
          { santriId: pemenang.santri2Id, dufahNama: sesi.dufahNama },
        ],
        skipDuplicates: true,
      });
    }
    await tx.sesiPemilihanLajnah.update({
      where: { id: sesi.id },
      data: {
        status: "TUTUP",
        ditutupAt: waktuPemilihanHabis(sesi, now) ? sesi.rencanaTutupAt : now,
      },
    });
  }

  const ringkas = (p: (typeof hasil)[number]) => ({
    id: p.id,
    nomorUrut: p.nomorUrut,
    suara: p.suara,
    santri1: p.santri1,
    santri2: p.santri2,
  });
  return {
    pemenang: pemenang ? ringkas(pemenang) : null,
    totalSuara: hasil.reduce((total, p) => total + p.suara, 0),
    hasil: hasil.map(ringkas),
  };
}

export async function tutupPemilihanLajnah(db: PrismaClient, id: string) {
  return db.$transaction(async (tx) => {
    const sesi = await kunciSesiPemilihan(tx, id);
    if (!sesi) throw new PemilihanLajnahError("Sesi tidak ditemukan", 404);
    return tutupSesiTerkunci(tx, sesi, new Date());
  }, { isolationLevel: "ReadCommitted" });
}

// The next read or vote finalizes an elapsed deadline; no browser needs admin
// credentials, and a disconnected projector does not extend the voting window.
export async function tutupPemilihanKedaluwarsa(db: PrismaClient, id: string) {
  const current = await db.sesiPemilihanLajnah.findUnique({
    where: { id },
    select: { status: true, rencanaTutupAt: true },
  });
  if (!current || !waktuPemilihanHabis(current)) return;
  await db.$transaction(async (tx) => {
    const sesi = await kunciSesiPemilihan(tx, id);
    const now = new Date();
    if (sesi && waktuPemilihanHabis(sesi, now)) {
      await tutupSesiTerkunci(tx, sesi, now);
    }
  }, { isolationLevel: "ReadCommitted" });
}

type VoteInput = { sesiId: string; paslonId: string; santriId: string };
type VoteResult = { success: true } | { error: string; status: number };

export async function catatSuaraPemilihan(db: PrismaClient, input: VoteInput): Promise<VoteResult> {
  try {
    return await db.$transaction(async (tx): Promise<VoteResult> => {
      const sesi = await kunciSesiPemilihan(tx, input.sesiId);
      if (!sesi) return { error: "Pemilihan tidak sedang dibuka", status: 400 };
      const santri = await tx.santriInternal.findUnique({
        where: { id: input.santriId },
        select: { id: true, isAktif: true, dufahNama: true },
      });
      if (!santri || !santri.isAktif) {
        return { error: "Hanya santri aktif yang boleh memilih", status: 403 };
      }
      if (santri.dufahNama !== sesi.dufahNama) {
        return { error: "Kamu tidak terdaftar sebagai pemilih pada sesi ini", status: 403 };
      }
      const now = new Date();
      if (waktuPemilihanHabis(sesi, now)) {
        await tutupSesiTerkunci(tx, sesi, now);
        // Return instead of throwing: the closure must commit even though this
        // late vote is rejected.
        return { error: "Waktu pemilihan sudah habis", status: 400 };
      }
      if (sesi.status !== "BUKA") {
        return { error: "Pemilihan tidak sedang dibuka", status: 400 };
      }
      const paslon = await tx.paslonLajnah.findFirst({
        where: { id: input.paslonId, sesiId: input.sesiId },
        select: { id: true },
      });
      if (!paslon) return { error: "Paslon tidak ditemukan", status: 404 };
      const acceptedAt = new Date();
      if (waktuPemilihanHabis(sesi, acceptedAt)) {
        await tutupSesiTerkunci(tx, sesi, acceptedAt);
        return { error: "Waktu pemilihan sudah habis", status: 400 };
      }
      await tx.suaraLajnah.create({ data: input });
      return { success: true };
    }, { isolationLevel: "ReadCommitted" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { error: "Kamu sudah memilih pada sesi ini", status: 409 };
    }
    throw error;
  }
}
