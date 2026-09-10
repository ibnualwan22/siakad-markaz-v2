import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { uploadDenahImage } from "@/lib/cloudinary-denah";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const data = await prisma.lokasiDenah.findMany({
      orderBy: { nama: "asc" },
    });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error GET /api/admin/denah-lokasi", error);
    return NextResponse.json(
      { error: "Gagal mengambil data." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nama, deskripsi, latitude, longitude, isActive, base64Image } = body;

    if (!nama || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: "Nama dan Koordinat (Latitude, Longitude) wajib diisi." },
        { status: 400 }
      );
    }

    let imageUrl = null;
    let publicId = null;

    if (base64Image) {
      const uploadRes = await uploadDenahImage(base64Image);
      imageUrl = uploadRes.url;
      publicId = uploadRes.publicId;
    }

    const created = await prisma.lokasiDenah.create({
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

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Nama Sakan sudah terdaftar. Silakan gunakan nama lain." },
        { status: 400 }
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "Gagal menyimpan lokasi denah" },
      { status: 500 }
    );
  }
}
