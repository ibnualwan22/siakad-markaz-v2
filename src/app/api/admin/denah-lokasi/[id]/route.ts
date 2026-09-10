import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { uploadDenahImage, deleteDenahImage } from "@/lib/cloudinary-denah";

const prisma = new PrismaClient();

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await req.json();
    const { nama, deskripsi, latitude, longitude, isActive, base64Image, removeImage } = body;

    if (!nama || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: "Nama dan Koordinat (Latitude, Longitude) wajib diisi." },
        { status: 400 }
      );
    }
    
    // Check existing
    const existing = await prisma.lokasiDenah.findUnique({
      where: { id: resolvedParams.id }
    });

    let imageUrl = existing?.imageUrl || null;
    let publicId = existing?.publicId || null;

    if (removeImage || base64Image) {
      // If we need to replace or remove entirely, delete old image first
      if (existing?.publicId) {
        await deleteDenahImage(existing.publicId);
        imageUrl = null;
        publicId = null;
      }
    }

    if (base64Image) {
      const uploadRes = await uploadDenahImage(base64Image);
      imageUrl = uploadRes.url;
      publicId = uploadRes.publicId;
    }

    const updated = await prisma.lokasiDenah.update({
      where: { id: resolvedParams.id },
      data: {
        nama,
        deskripsi,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        isActive: isActive !== undefined ? isActive : true,
        imageUrl,
        publicId,
      },
    });

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Nama Sakan sudah terdaftar. Silakan gunakan nama lain." },
        { status: 400 }
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "Gagal mengupdate lokasi denah" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    
    const existing = await prisma.lokasiDenah.findUnique({
      where: { id: resolvedParams.id }
    });

    if (existing?.publicId) {
      await deleteDenahImage(existing.publicId);
    }

    await prisma.lokasiDenah.delete({
      where: { id: resolvedParams.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error DELETE /api/admin/denah-lokasi/[id]", error);
    return NextResponse.json({ error: "Gagal menghapus data." }, { status: 500 });
  }
}
