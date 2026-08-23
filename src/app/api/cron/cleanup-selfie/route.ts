import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteSelfie } from "@/lib/cloudinary";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Verifikasi Vercel Cron Secret (Jika diperlukan)
    // const authHeader = request.headers.get("authorization");
    // const xCronSecret = request.headers.get("x-cron-secret");
    // Jika perlu secure route:
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && xCronSecret !== process.env.CRON_SECRET) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // Hitung tanggal batas 7 hari ke belakang (168 jam)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Cari perizinan yang punya foto dan waktu fotonya sudah lebih dari 7 hari lalu
    const oldSelfies = await prisma.perizinan.findMany({
      where: {
        selfiePublicId: { not: null },
        selfieAt: { lte: sevenDaysAgo }
      },
      select: {
        id: true,
        selfiePublicId: true,
      }
    });

    if (oldSelfies.length === 0) {
      return NextResponse.json({ success: true, message: "Tidak ada foto usang yang perlu dihapus." });
    }

    let deletedCount = 0;
    const errors: string[] = [];

    // Loop untuk menghapus fisik gambar di Cloudinary
    for (const record of oldSelfies) {
      if (record.selfiePublicId) {
        try {
          await deleteSelfie(record.selfiePublicId);
          deletedCount++;
        } catch (e: any) {
          console.error(`Gagal menghapus selfie ${record.selfiePublicId}:`, e);
          errors.push(record.selfiePublicId);
        }
      }
    }

    // Setelah terhapus di cloud, hapus jejak URL-nya di database
    // Gunakan transaksi atau In-array query untuk efisiensi
    const ids = oldSelfies.map(r => r.id);
    await prisma.perizinan.updateMany({
      where: { id: { in: ids } },
      data: {
        selfieUrl: null,
        selfiePublicId: null,
        selfieAt: null,
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Berhasil membersihkan ${deletedCount} foto usang.`,
      errors: errors.length > 0 ? errors : undefined 
    });

  } catch (error: any) {
    console.error("Error cleanup-selfie cron:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
