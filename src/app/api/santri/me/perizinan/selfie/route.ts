import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { uploadSelfie } from "@/lib/cloudinary";

export async function POST(request: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { perizinanId, image } = await request.json();

    if (!perizinanId || !image) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const perizinan = await prisma.perizinan.findUnique({
      where: { id: perizinanId },
      include: { riwayat: true },
    });

    if (!perizinan) {
      return NextResponse.json({ error: "Izin tidak ditemukan" }, { status: 404 });
    }

    // Validasi kepemilikan dan status
    if (perizinan.riwayat.santriId !== session.santriId) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }
    if (perizinan.statusIzin !== "AKTIF") {
      return NextResponse.json({ error: "Izin tidak aktif atau sudah selesai" }, { status: 400 });
    }
    if (perizinan.tipeIzin !== "KELUAR_PARE" && perizinan.tipeIzin !== "BERHARI_HARI") {
      return NextResponse.json({ error: "Tipe izin ini tidak membutuhkan selfie" }, { status: 400 });
    }
    if (perizinan.selfieUrl) {
      return NextResponse.json({ error: "Selfie sudah diunggah" }, { status: 400 });
    }

    // Upload to Cloudinary
    const { url, publicId } = await uploadSelfie(image);

    // Update izin di DB
    const now = new Date();
    await prisma.perizinan.update({
      where: { id: perizinanId },
      data: {
        selfieUrl: url,
        selfiePublicId: publicId,
        selfieAt: now,
        statusIzin: "SUDAH_KEMBALI",
        tanggalKembali: now,
      },
    });

    // Cleanup absensi future jika izin berhari-hari
    if (perizinan.tipeIzin === "BERHARI_HARI" && perizinan.tanggalSelesai) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (perizinan.tanggalSelesai > today) {
        const searchKeterangan = { contains: `[${perizinan.nomorTasrih}]` };
        await prisma.$transaction([
          prisma.absenKelas.deleteMany({ where: { keterangan: searchKeterangan, tanggal: { gt: today } } }),
          prisma.absenSakan.deleteMany({ where: { keterangan: searchKeterangan, tanggal: { gt: today } } }),
          prisma.absenKegiatan.deleteMany({ where: { keterangan: searchKeterangan, tanggal: { gt: today } } }),
        ]);
      }
    }

    return NextResponse.json({ success: true, selfieUrl: url, selfieAt: now.toISOString() });
  } catch (error) {
    console.error("Error setting selfie:", error);
    return NextResponse.json({ error: "Gagal mengunggah selfie" }, { status: 500 });
  }
}
