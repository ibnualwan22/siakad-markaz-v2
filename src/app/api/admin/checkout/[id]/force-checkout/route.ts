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

    if (santri.isCheckedOut) {
      return NextResponse.json(
        { error: "Santri ini sudah berstatus Checkout." },
        { status: 400 }
      );
    }

    // Force checkout: isCheckedOut menjadi true dan isAktif menjadi false
    await prisma.santriInternal.update({
      where: { id: santriId },
      data: {
        isCheckedOut: true,
        isAktif: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Berhasil melakukan Force Checkout pada santri.",
    });
  } catch (error: any) {
    console.error("Error force checkout santri:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server saat memproses checkout sepihak." },
      { status: 500 }
    );
  }
}
