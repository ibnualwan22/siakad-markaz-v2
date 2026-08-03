import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    // Check permission
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { sesiId, action } = await req.json();

    if (!sesiId || !["RETRY", "RESUME"].includes(action)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const sesi = await prisma.sesiUjianSantri.findUnique({
      where: { id: sesiId },
      include: {
        jawabanList: true
      }
    });

    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });

    if (action === "RESUME") {
      // Ubah status jadi MENGERJAKAN dan hapus waktu selesai
      // (waktu mulai tetap sama agar batas maksimal mengikuti waktu global)
      const updatedSesi = await prisma.sesiUjianSantri.update({
        where: { id: sesiId },
        data: {
          status: "MENGERJAKAN",
          waktuSelesai: null
        }
      });
      return NextResponse.json({ success: true, sesi: updatedSesi });
    } else if (action === "RETRY") {
      // Hapus sesi lama (termasuk jawaban-jawabannya gara-gara onDelete: Cascade)
      await prisma.sesiUjianSantri.delete({
        where: { id: sesiId }
      });

      // Response success. Sesi baru akan ke-create saat santri klik "Mulai Ujian"
      // dari portal santrinya.
      return NextResponse.json({ success: true, message: "Sesi ujian di-reset" });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
