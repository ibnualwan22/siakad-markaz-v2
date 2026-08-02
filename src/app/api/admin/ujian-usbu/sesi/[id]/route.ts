import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import crypto from "crypto";

function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { action } = await req.json(); // "OPEN", "CLOSE", "REFRESH_CODE"

    const sesi = await prisma.sesiUjianGlobal.findUnique({ where: { id } });
    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });

    let updatedSesi;

    if (action === "OPEN") {
      const waktuMulai = new Date();
      const waktuSelesai = new Date(waktuMulai.getTime() + sesi.durasiMenit * 60000);
      
      updatedSesi = await prisma.sesiUjianGlobal.update({
        where: { id },
        data: {
          isActive: true,
          waktuMulai,
          waktuSelesai
        }
      });
    } else if (action === "CLOSE") {
      updatedSesi = await prisma.sesiUjianGlobal.update({
        where: { id },
        data: { isActive: false }
      });
      
      // Auto-submit all lingering santri sessions for this global session
      const targetSesiSantri = await prisma.sesiUjianSantri.findMany({
        where: {
          paket: { sesiGlobalId: id },
          status: "MENGERJAKAN"
        }
      });
      // We can let the background process or a manual "Force Submit" button in monitoring handle the scoring logic to avoid timeout here if there are many students
      
    } else if (action === "REFRESH_SOAL") {
      // Re-generate SoalPaket dari BankSoalUsbu terbaru untuk semua PaketUjian dalam sesi ini
      const paketList = await prisma.paketUjian.findMany({
        where: { sesiGlobalId: id },
        include: { _count: { select: { soalPaketList: true } } }
      });

      let totalSoalBaru = 0;
      for (const paket of paketList) {
        // Hapus SoalPaket lama
        await prisma.soalPaket.deleteMany({ where: { paketId: paket.id } });

        // Ambil soal terbaru dari BankSoalUsbu
        const soalList = await prisma.bankSoalUsbu.findMany({
          where: { 
            programId: paket.programId, 
            usbuKe: sesi.usbuKe, 
            paketSoal: paket.paketSoal 
          }
        });

        if (soalList.length > 0) {
          await prisma.soalPaket.createMany({
            data: soalList.map((s, index) => ({
              paketId: paket.id,
              soalId: s.id,
              urutan: index + 1
            }))
          });
          totalSoalBaru += soalList.length;
        }
      }

      updatedSesi = sesi;
      return NextResponse.json({ 
        success: true, 
        sesi: updatedSesi, 
        message: `Berhasil refresh soal! Total ${totalSoalBaru} soal di-link ke ${paketList.length} paket.` 
      });
    } else if (action === "REFRESH_CODE") {
      updatedSesi = await prisma.sesiUjianGlobal.update({
        where: { id },
        data: { kodeAkses: generateCode() }
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, sesi: updatedSesi });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "ADMIN") {
      const p = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: session.role, permission: "ujian_usbu" } }
      });
      if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const useCount = await prisma.sesiUjianSantri.count({
      where: {
        paket: { sesiGlobalId: id }
      }
    });

    if (useCount > 0) {
      return NextResponse.json({ error: "Tidak dapat menghapus sesi ujian yang sudah memiliki riwayat pengerjaan santri." }, { status: 400 });
    }

    await prisma.sesiUjianGlobal.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
