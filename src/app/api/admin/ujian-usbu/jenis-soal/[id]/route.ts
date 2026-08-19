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

// NextJS 15 syntax requires reading params synchronously if it's dynamic route async component? Wait, we are in an API route. 
// However, since it's Next.js app router API, the generic signature is export async function PUT(req: Request, { params }: { params: { id: string } })
// Actually wait! Next.js 15 app router API routes: "params" is an object or promise? It's { params: { id: string } } 
// wait, NextJS 15 might require await params. Let's just use it sync or async. In older Next it's sync.
export async function DELETE(req: Request, { params }: any) {
  try {
    const { id } = await params;
    
    await prisma.jenisSoal.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE JenisSoal Error:", error);
    return NextResponse.json({ error: "Gagal menghapus jenis soal" }, { status: 500 });
  }
}
