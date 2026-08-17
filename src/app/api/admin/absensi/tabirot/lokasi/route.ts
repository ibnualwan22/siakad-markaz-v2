import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPermission } from "@/lib/permission";

export async function PUT(request: Request) {
  try {
    const hasAccess = await checkPermission("absen_tabirot_edit");
    if (!hasAccess) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const { oldTempat, newTempat } = await request.json();
    if (!oldTempat || !newTempat) {
      return NextResponse.json({ error: "Data oldTempat dan newTempat harus diisi" }, { status: 400 });
    }

    const result = await prisma.kelompokTabirot.updateMany({
      where: { tempat: oldTempat },
      data: { tempat: newTempat },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error: any) {
    console.error(error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Lokasi dengan nama tersebut bentrok dengan data yang ada" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal mengupdate lokasi" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const hasAccess = await checkPermission("absen_tabirot_edit");
    if (!hasAccess) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tempat = searchParams.get("tempat");
    
    if (!tempat) {
      return NextResponse.json({ error: "Data tempat harus diisi" }, { status: 400 });
    }

    const result = await prisma.kelompokTabirot.deleteMany({
      where: { tempat },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal menghapus lokasi" }, { status: 500 });
  }
}
