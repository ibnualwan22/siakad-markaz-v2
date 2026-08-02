import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const pengajuanId = params.id;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { status, catatan } = body; // "DISETUJUI" | "DITOLAK"

    if (!["DISETUJUI", "DITOLAK"].includes(status)) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
    }

    const pengajuan = await prisma.checkoutPengajuan.findUnique({
      where: { id: pengajuanId },
      include: { approvals: true }
    });

    if (!pengajuan) {
      return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });
    }

    if (pengajuan.status !== "MENUNGGU") {
      return NextResponse.json({ error: "Pengajuan ini sudah tidak menunggu persetujuan (sudah final)." }, { status: 400 });
    }

    const myApproval = pengajuan.approvals.find(a => a.userId === session.userId);
    if (!myApproval) {
      return NextResponse.json({ error: "Anda bukan approver untuk pengajuan ini." }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update the specific approval record
      await tx.checkoutApproval.update({
        where: { id: myApproval.id },
        data: {
          status,
          catatan: catatan || null,
          respondedAt: new Date()
        }
      });

      // 2. Check complete status
      const updatedApprovals = await tx.checkoutApproval.findMany({
        where: { pengajuanId }
      });

      const hasRejected = updatedApprovals.some(a => a.status === "DITOLAK");
      const allApproved = updatedApprovals.every(a => a.status === "DISETUJUI");

      if (hasRejected) {
        await tx.checkoutPengajuan.update({
          where: { id: pengajuanId },
          data: { status: "DITOLAK" }
        });
      } else if (allApproved) {
        await tx.checkoutPengajuan.update({
          where: { id: pengajuanId },
          data: { status: "DISETUJUI" }
        });

        await tx.santriInternal.update({
          where: { id: pengajuan.santriId },
          data: { isCheckedOut: true }
        });
      }
    });

    // 3. Send WhatsApp notification if all approved
    const allApprovedFinal = (await prisma.checkoutApproval.findMany({
      where: { pengajuanId }
    })).every(a => a.status === "DISETUJUI");

    if (allApprovedFinal) {
      // Import dynamically to avoid top-level require circular dependency issues if any
      const { sendWhatsAppMessage, formatCheckoutWaliMessage } = await import("@/lib/whatsapp");
      
      const santriData = await prisma.santriInternal.findUnique({
        where: { id: pengajuan.santriId }
      });
      
      if (santriData && santriData.noWaWali && santriData.noWaWali !== "-") {
        const { formatTanggalWa } = await import("@/lib/whatsapp");
        const todayStr = new Date().toISOString().split("T")[0];
        
        const message = formatCheckoutWaliMessage({
          namaSantri: santriData.nama || "-",
          tempatLahir: santriData.tempat_lahir || "-",
          tanggalLahir: santriData.tanggal_lahir ? formatTanggalWa(santriData.tanggal_lahir) : "-",
          alamat: santriData.alamat || "-",
          sakan: santriData.sakan || "-",
          kamar: santriData.kamar || "-",
          kategori: santriData.kategori || "-",
          alasan: pengajuan.alasan || "-",
          tanggalCheckout: formatTanggalWa(todayStr),
        });
        
        // Fire and forget (menggunakan WA_SESSION_ID pertama)
        sendWhatsAppMessage(santriData.noWaWali, message, process.env.WA_SESSION_ID).catch(err => {
          console.error("Failed to send WA to wali on full checkout approval:", err);
        });
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error approving checkout:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
