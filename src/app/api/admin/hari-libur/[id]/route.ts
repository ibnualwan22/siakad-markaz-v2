import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { nama, isSemuaSesi, sesiLibur, keterangan } = body;

    const currentLibur = await prisma.hariLibur.findUnique({ where: { id: params.id } });
    if (!currentLibur) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.hariLibur.update({
      where: { id: params.id },
      data: {
        nama,
        isSemuaSesi: isSemuaSesi ?? true,
        sesiLibur: sesiLibur || [],
        keterangan: keterangan || null
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Gagal update hari libur" }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.hariLibur.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Gagal menghapus hari libur" }, { status: 500 });
  }
}
