import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: santriId } = await params;
    if (!santriId) {
      return NextResponse.json(
        { error: "ID Santri tidak diberikan." },
        { status: 400 }
      );
    }

    // Ambil data santri current
    const santri = await prisma.santriInternal.findUnique({
      where: { id: santriId },
    });

    if (!santri) {
      return NextResponse.json(
        { error: "Data Santri tidak ditemukan." },
        { status: 404 }
      );
    }

    if (!santri.isCheckedOut) {
      return NextResponse.json(
        { error: "Santri ini saat ini sudah berstatus aktif (tidak Checkout)." },
        { status: 400 }
      );
    }

    // Reactivate: isCheckedOut menjadi false dan isAktif menjadi true
    await prisma.santriInternal.update({
      where: { id: santriId },
      data: {
        isCheckedOut: false,
        isAktif: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Berhasil mengaktifkan kembali santri.",
    });
  } catch (error: any) {
    console.error("Error reactivate santri:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server saat memproses pengaktifan kembali." },
      { status: 500 }
    );
  }
}
