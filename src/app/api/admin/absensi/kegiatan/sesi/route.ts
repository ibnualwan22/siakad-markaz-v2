import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/** Sesi scan petugas: hanya untuk role ADMIN atau yang punya permission pengaturan_kegiatan. */
async function checkAkses() {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "ADMIN") return session;
  const rp = await prisma.rolePermission.findMany({
    where: { role: session.role as any, permission: "pengaturan_kegiatan" },
  });
  return rp.length > 0 ? session : null;
}

/** Daftar sesi SCAN_PETUGAS yang masih terbuka (untuk gabung antar-jalur). */
export async function GET() {
  const session = await checkAkses();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const sesiList = await prisma.sesiAbsenKegiatan.findMany({
    where: { metode: "SCAN_PETUGAS", isClosed: false, ditutupPada: { gt: now } },
    include: { kategori: { select: { id: true, nama: true } } },
    orderBy: { createdAt: "desc" },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const withCount = await Promise.all(
    sesiList.map(async (s) => {
      const hadir = await prisma.absenKegiatan.count({
        where: { kategoriId: s.kategoriId, tanggal: today, status: "HADIR" },
      });
      return { ...s, hadirCount: hadir };
    })
  );

  return NextResponse.json({ success: true, sesiList: withCount });
}

/** Buka sesi scan baru untuk satu kategori kegiatan. */
export async function POST(request: Request) {
  const session = await checkAkses();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { kategoriId, durasiMenit } = await request.json();

    if (!kategoriId || !durasiMenit || Number(durasiMenit) <= 0) {
      return NextResponse.json({ error: "Kategori dan durasi wajib diisi" }, { status: 400 });
    }

    const kategori = await prisma.kategoriKegiatan.findUnique({ where: { id: kategoriId } });
    if (!kategori || !kategori.aktif) {
      return NextResponse.json({ error: "Kategori kegiatan tidak valid" }, { status: 400 });
    }

    const now = new Date();
    const sudahAda = await prisma.sesiAbsenKegiatan.findFirst({
      where: {
        metode: "SCAN_PETUGAS",
        kategoriId,
        isClosed: false,
        ditutupPada: { gt: now },
      },
    });
    if (sudahAda) {
      return NextResponse.json(
        { error: `Sudah ada sesi scan terbuka untuk "${kategori.nama}". Gabung ke sesi itu atau tutup dulu.` },
        { status: 400 }
      );
    }

    const kode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const sesi = await prisma.sesiAbsenKegiatan.create({
      data: {
        kode,
        kategoriId,
        durasiMenit: Number(durasiMenit),
        ditutupPada: new Date(Date.now() + Number(durasiMenit) * 60000),
        metode: "SCAN_PETUGAS",
      },
      include: { kategori: { select: { id: true, nama: true } } },
    });

    return NextResponse.json({ success: true, sesi });
  } catch (error) {
    console.error("POST sesi scan error", error);
    return NextResponse.json({ error: "Gagal membuka sesi scan" }, { status: 500 });
  }
}
