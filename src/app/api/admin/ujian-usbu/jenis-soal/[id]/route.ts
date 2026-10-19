import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(req: Request, { params }: any) {
  try {
    const { id } = await params;
    const { nama, urutan, instruksi } = await req.json();

    const updated = await prisma.jenisSoal.update({
      where: { id },
      data: { 
        ...(nama !== undefined && { nama }),
        ...(urutan !== undefined && { urutan }),
        ...(instruksi !== undefined && { instruksi })
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Nama jenis soal sudah ada" }, { status: 400 });
    }
    console.error("PUT JenisSoal Error:", error);
    return NextResponse.json({ error: "Gagal update jenis soal" }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: any) {
  try {
    const { id } = await params;
    const data = await prisma.jenisSoal.findUnique({
      where: { id },
      include: {
        _count: { select: { soalList: true } }
      }
    });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed fetch" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: any) {
  try {
    const { id } = await params;
    
    // PROTEKSI: Tolak hapus jika masih ada soal di dalamnya
    // User harus hapus soal satu per satu secara manual dulu
    const soalCount = await prisma.bankSoalUsbu.count({
      where: { jenisSoalId: id }
    });
    
    if (soalCount > 0) {
      return NextResponse.json({ 
        error: `Tidak bisa hapus jenis soal! Masih ada ${soalCount} soal di dalamnya. Hapus soal satu per satu terlebih dahulu.` 
      }, { status: 400 });
    }
    
    // Aman: tidak ada soal, boleh hapus jenis soalnya
    await prisma.jenisSoal.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true, deletedSoalCount: 0 });
  } catch (error: any) {
    console.error("DELETE JenisSoal Error:", error);
    return NextResponse.json({ error: "Gagal menghapus jenis soal" }, { status: 500 });
  }
}
