import { NextResponse } from "next/server";
import { getSantriSession } from "@/lib/santri-auth";
import prisma from "@/lib/prisma";
import { submitSesiUjianSantri } from "@/lib/exam-submit";

export async function POST(req: Request) {
  try {
    const session = await getSantriSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { sesiId, reason } = body;

    if (!sesiId) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    // Tanya basis data hanya untuk memverifikasi session milik santri yang benar.
    const sesi = await prisma.sesiUjianSantri.findUnique({
      where: { id: sesiId },
      include: { riwayat: true }
    });

    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    if (sesi.riwayat.santriId !== session.santriId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Panggil helper yang ditarik (di luar rute) agar bisa dipakai ulang
    const updatedSesi = await submitSesiUjianSantri(sesiId, reason || "MANUAL");

    return NextResponse.json({ success: true, sesi: updatedSesi });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
