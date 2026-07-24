import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { deleteSelfie } from "@/lib/cloudinary";
import { processAutoAbsensiIzin } from "@/lib/perizinan-utils";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const izin = await prisma.perizinan.findUnique({ where: { id: params.id } });
    
    if (!izin) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!izin.selfieUrl) {
      return NextResponse.json({ error: "Tidak ada data selfie untuk ditolak" }, { status: 400 });
    }

    // 1. Delete image from Cloudinary
    if (izin.selfiePublicId) {
      await deleteSelfie(izin.selfiePublicId);
    }

    // 2. Rollback status & bersihkan data selfie
    await prisma.perizinan.update({
      where: { id: params.id },
      data: {
        selfieUrl: null,
        selfiePublicId: null,
        selfieAt: null,
        statusIzin: "AKTIF", // roll back to AKTIF
        tanggalKembali: null
      }
    });

    // 3. Re-generate absensi IZIN untuk sisa hari yang mungkin sebelumnya sudah dihapus
    // Memanggil ulang auto absensi agar data izin kembali dibuat (sama seperti saat pertama kali approve).
    await processAutoAbsensiIzin(
      izin.riwayatId,
      izin.tipeIzin,
      izin.tanggalMulai,
      izin.tanggalSelesai,
      izin.alasan,
      izin.nomorTasrih
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reject selfie:", error);
    return NextResponse.json({ error: "Failed to reject selfie" }, { status: 500 });
  }
}
