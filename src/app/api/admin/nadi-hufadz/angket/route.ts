import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";
import { getActiveDufahName } from "@/lib/absensi";

export const dynamic = "force-dynamic";

// GET ?dufahNama=... — daftar angket peserta Nadi satu dufah untuk tab
// Angket admin: kartu per anak (nama, sakan, kelas, isi + waktu tulis).
// Sakan dari SantriInternal.sakan; kelas dari RiwayatSantri dufah tersebut.
// Peserta tanpa angket tetap tampil ("Belum mengisi") supaya cakupan jelas.
export async function GET(request: Request) {
  const session = await getSession();
  const hasPerm = await checkPermission("nadi_hufadz");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dufahNama = searchParams.get("dufahNama") || (await getActiveDufahName()) || "";
  if (!dufahNama) return NextResponse.json({ error: "Dufah tidak ditemukan" }, { status: 400 });

  const [peserta, angketList, riwayat] = await Promise.all([
    prisma.nadiHufadzPeserta.findMany({
      where: { dufahNama },
      include: { santri: { select: { id: true, nama: true, sakan: true } } },
      orderBy: { santri: { nama: "asc" } },
    }),
    prisma.nadiHufadzAngket.findMany({ where: { dufahNama } }),
    prisma.riwayatSantri.findMany({
      where: { dufahNama },
      include: { kelas: { select: { nama: true } } },
    }),
  ]);

  const angketBySantri = new Map(angketList.map((a) => [a.santriId, a]));
  const kelasBySantri = new Map(
    riwayat.map((r) => [r.santriId, r.kelas?.nama ?? null])
  );

  const data = peserta.map((p) => {
    const angket = angketBySantri.get(p.santriId) || null;
    return {
      santriId: p.santriId,
      nama: p.santri.nama,
      sakan: p.santri.sakan,
      kelas: kelasBySantri.get(p.santriId) ?? null,
      angket: angket ? { isi: angket.isi, updatedAt: angket.updatedAt } : null,
    };
  });

  return NextResponse.json({ dufahNama, data });
}
