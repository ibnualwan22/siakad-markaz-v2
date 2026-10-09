import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { verifySantriQr } from "@/lib/qr-signing";
import { getActiveRiwayatListForAbsen } from "@/lib/absensi";

async function checkAkses() {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "ADMIN") return session;
  const rp = await prisma.rolePermission.findMany({
    where: { role: session.role as any, permission: { in: ["pengaturan_kegiatan", "scan_absen_kegiatan"] } },
  });
  return rp.length > 0 ? session : null;
}

export type HasilScan = "TERCATAT" | "SUDAH_TERCATAT" | "DITOLAK";

/**
 * Terima satu hasil scan QR dari petugas.
 * Validasi: sesi valid & terbuka -> tanda tangan QR -> santri aktif -> catat HADIR.
 * Aman untuk scan bersamaan dari banyak jalur (unique constraint + tangkap P2002).
 */
export async function POST(request: Request) {
  const session = await checkAkses();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { sesiId, payload } = await request.json();
    if (!sesiId || !payload) {
      return NextResponse.json({ hasil: "DITOLAK", alasan: "Data scan tidak lengkap" } as const);
    }

    const sesi = await prisma.sesiAbsenKegiatan.findUnique({ where: { id: sesiId } });
    if (!sesi || sesi.metode !== "SCAN_PETUGAS") {
      return NextResponse.json({ hasil: "DITOLAK", alasan: "Sesi scan tidak ditemukan" } as const);
    }
    if (sesi.isClosed || new Date(sesi.ditutupPada) <= new Date()) {
      return NextResponse.json({ hasil: "DITOLAK", alasan: "Sesi sudah ditutup / waktu habis" } as const);
    }

    const ver = verifySantriQr(payload);
    if (!ver.ok) {
      return NextResponse.json({ hasil: "DITOLAK", alasan: ver.reason } as const);
    }

    const aktifList = await getActiveRiwayatListForAbsen();
    const target = aktifList.find((s) => s.santriId === ver.santriId);
    if (!target) {
      return NextResponse.json({
        hasil: "DITOLAK",
        alasan: "Santri tidak aktif / tidak ada riwayat dufah aktif",
      } as const);
    }

    const today = new Date(sesi.createdAt);
    today.setHours(0, 0, 0, 0);
    const whereUnique = {
      riwayatId_kategoriId_tanggal: {
        riwayatId: target.riwayatId,
        kategoriId: sesi.kategoriId,
        tanggal: today,
      },
    };

    const existing = await prisma.absenKegiatan.findUnique({ where: whereUnique });
    if (existing && existing.status === "HADIR") {
      return NextResponse.json({
        hasil: "SUDAH_TERCATAT",
        namaSantri: target.nama,
        sakan: target.sakan,
        kelasNama: target.kelasNama,
        alasan: "Sudah tercatat hadir",
      } as const);
    }

    const aktor = session.nama || session.username || "petugas";
    try {
      await prisma.absenKegiatan.upsert({
        where: whereUnique,
        update: { status: "HADIR", keterangan: `Scan petugas (${aktor})` },
        create: {
          riwayatId: target.riwayatId,
          kategoriId: sesi.kategoriId,
          tanggal: today,
          status: "HADIR",
          keterangan: `Scan petugas (${aktor})`,
        },
      });
    } catch (e: any) {
      // Balapan antar-jalur: record keburu dibuat jalur lain
      if (e?.code === "P2002") {
        return NextResponse.json({
          hasil: "SUDAH_TERCATAT",
          namaSantri: target.nama,
          sakan: target.sakan,
          kelasNama: target.kelasNama,
          alasan: "Sudah tercatat hadir",
        } as const);
      }
      throw e;
    }

    return NextResponse.json({
      hasil: "TERCATAT",
      namaSantri: target.nama,
      sakan: target.sakan,
      kelasNama: target.kelasNama,
    } as const);
  } catch (error) {
    console.error("POST scan error", error);
    return NextResponse.json({ hasil: "DITOLAK", alasan: "Kesalahan server" } as const);
  }
}
