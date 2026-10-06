import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getActiveRiwayatListForAbsen } from "@/lib/absensi";

async function checkAkses() {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "ADMIN") return session;
  const rp = await prisma.rolePermission.findMany({
    where: { role: session.role as any, permission: "pengaturan_kegiatan" },
  });
  return rp.length > 0 ? session : null;
}

async function getSesiOrError(id: string) {
  const sesi = await prisma.sesiAbsenKegiatan.findUnique({
    where: { id },
    include: { kategori: { select: { id: true, nama: true } } },
  });
  if (!sesi || sesi.metode !== "SCAN_PETUGAS") return { error: "Sesi scan tidak ditemukan" as const };
  if (!sesi.isClosed && new Date(sesi.ditutupPada) > new Date()) {
    return { error: "Tutup sesi dulu sebelum finalisasi" as const };
  }
  return { sesi };
}

/** Peta riwayatId -> status usulan dari perizinan/tasrih aktif (logika lama dipakai ulang). */
async function buildIzinMap(santriIds: string[], today: Date) {
  const currentActiveIzin = await prisma.perizinan.findMany({
    where: {
      riwayatId: { in: santriIds },
      statusIzin: "AKTIF",
      OR: [
        {
          tipeIzin: { notIn: ["HARIAN", "KELUAR_PARE"] },
          tanggalMulai: { lte: today },
          tanggalSelesai: { gte: today },
        },
        { tipeIzin: "KELUAR_PARE", tanggalMulai: { lte: today } },
      ],
    },
    select: { riwayatId: true, statusAbsen: true },
  });
  const harianIzin = await prisma.perizinan.findMany({
    where: {
      riwayatId: { in: santriIds },
      statusIzin: "AKTIF",
      tipeIzin: "HARIAN",
      tanggalMulai: today,
    },
    select: { riwayatId: true, statusAbsen: true },
  });
  const izinMap = new Map<string, string>();
  for (const i of currentActiveIzin) izinMap.set(i.riwayatId, i.statusAbsen || "IZIN");
  for (const i of harianIzin) izinMap.set(i.riwayatId, i.statusAbsen || "IZIN");
  return izinMap;
}

async function getBelumTercatat(sesi: { kategoriId: string; createdAt: Date }) {
  const today = new Date(sesi.createdAt);
  today.setHours(0, 0, 0, 0);

  const santriList = (await getActiveRiwayatListForAbsen()).filter((s) => !s.isCheckedOut);
  const santriIds = santriList.map((s) => s.riwayatId);

  const records = await prisma.absenKegiatan.findMany({
    where: { kategoriId: sesi.kategoriId, tanggal: today },
    select: { riwayatId: true, status: true },
  });
  const sudahAda = new Map(records.map((r) => [r.riwayatId, r.status]));
  const izinMap = await buildIzinMap(santriIds, today);

  const hadir = records.filter((r) => r.status === "HADIR").length;
  const belumTercatat = santriList
    .filter((s) => !sudahAda.has(s.riwayatId))
    .map((s) => ({
      riwayatId: s.riwayatId,
      nama: s.nama,
      sakan: s.sakan,
      kelasNama: s.kelasNama,
      usul: izinMap.get(s.riwayatId) || "ALPHA",
    }));

  return { today, hadir, totalAktif: santriList.length, belumTercatat };
}

/** Preview finalisasi: ringkasan hadir vs belum tercatat + usulan status. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await checkAkses();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const res = await getSesiOrError(id);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });

  const data = await getBelumTercatat(res.sesi);
  return NextResponse.json({
    success: true,
    sesi: { id: res.sesi.id, kategoriNama: res.sesi.kategori.nama },
    ...data,
  });
}

/**
 * Finalisasi eksplisit (pengganti auto-ALPHA diam-diam):
 * - mode "TANDAI_ALPHA": yang belum tercatat ditulis dengan usulan status (IZIN dari tasrih / ALPHA).
 * - mode "BIARKAN": tidak menulis apa-apa (kegiatan opsional).
 * Idempoten: hanya mengisi yang belum ada record (upsert tanpa overwrite).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await checkAkses();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const res = await getSesiOrError(id);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    const { sesi } = res;

    const { mode, kecualikan } = await request.json();
    if (mode !== "TANDAI_ALPHA" && mode !== "BIARKAN") {
      return NextResponse.json({ error: "Mode finalisasi tidak valid" }, { status: 400 });
    }

    // Rapikan: sesi kadaluwarsa tapi belum isClosed -> tandai tutup sekalian
    if (!sesi.isClosed) {
      await prisma.sesiAbsenKegiatan.update({ where: { id }, data: { isClosed: true } });
    }

    if (mode === "BIARKAN") {
      return NextResponse.json({ success: true, mode, ditandai: 0 });
    }

    const aktor = session.nama || session.username || "admin";
    const { today, belumTercatat } = await getBelumTercatat(sesi);
    const kecualikanSet = new Set<string>(Array.isArray(kecualikan) ? kecualikan : []);
    const target = belumTercatat.filter((s) => !kecualikanSet.has(s.riwayatId));

    const operations = target.map((s) =>
      prisma.absenKegiatan.upsert({
        where: {
          riwayatId_kategoriId_tanggal: {
            riwayatId: s.riwayatId,
            kategoriId: sesi.kategoriId,
            tanggal: today,
          },
        },
        update: {},
        create: {
          riwayatId: s.riwayatId,
          kategoriId: sesi.kategoriId,
          tanggal: today,
          status: s.usul as any,
          keterangan:
            s.usul === "ALPHA"
              ? `Finalisasi ALPHA oleh ${aktor}`
              : `Auto ${s.usul} (finalisasi sesi)`,
        },
      })
    );
    if (operations.length > 0) await prisma.$transaction(operations);

    return NextResponse.json({ success: true, mode, ditandai: operations.length });
  } catch (error) {
    console.error("POST finalisasi error", error);
    return NextResponse.json({ error: "Gagal finalisasi sesi" }, { status: 500 });
  }
}
