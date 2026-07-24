import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteSelfie } from "@/lib/cloudinary";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Validasi Cron Secret
    const authHeader = request.headers.get("authorization");
    let isValidCron = false;
    
    if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
      isValidCron = true;
    }
    
    const searchParams = request.nextUrl.searchParams;
    if (searchParams.get("secret") === process.env.CRON_SECRET) {
      isValidCron = true;
    }

    if (!isValidCron && process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Cari selfie yang usianya lebih dari 7 hari
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const oldSelfies = await prisma.perizinan.findMany({
      where: {
        selfiePublicId: { not: null },
        selfieAt: { lt: sevenDaysAgo }
      },
      select: {
        id: true,
        selfiePublicId: true
      }
    });

    if (oldSelfies.length === 0) {
      return NextResponse.json({ success: true, message: "Tidak ada selfie usang untuk dihapus", cleaned: 0 });
    }

    let cleaned = 0;
    // 3. Hapus foto dari Cloudinary lalu dari database 
    for (const record of oldSelfies) {
      if (record.selfiePublicId) {
        try {
          await deleteSelfie(record.selfiePublicId);
          await prisma.perizinan.update({
            where: { id: record.id },
            data: {
              selfieUrl: null,
              selfiePublicId: null
              // selfieAt dibiarkan supaya kita tahu kapan santri tersebut melakukan konfirmasi.
            }
          });
          cleaned++;
        } catch (err) {
          console.error(`Gagal cleanup selfie untuk record ${record.id}:`, err);
        }
      }
    }

    return NextResponse.json({ success: true, cleaned });
  } catch (error: any) {
    console.error("Error cleanup-cloudinary cron:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
