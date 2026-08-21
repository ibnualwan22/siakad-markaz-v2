import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export async function GET() {
  const session = await getSession();
  // Any logged-in Admin/Teacher can view the class list for dropdowns
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const kelasList = await prisma.kelas.findMany({
      orderBy: { nama: "asc" },
      include: {
        program: {
          select: { nama_indo: true }
        }
      }
    });
    return NextResponse.json(kelasList);
  } catch (error) {
    return NextResponse.json({ error: "Gagal mengambil daftar kelas" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  const hasPermission = await checkPermission("ruang_kelas_edit");
  if (!session || !hasPermission) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { nama, programId } = body;

    if (!nama || !programId) {
      return NextResponse.json({ error: "Nama dan Program wajib diisi." }, { status: 400 });
    }

    const existing = await prisma.kelas.findUnique({
      where: { nama },
    });

    if (existing) {
      return NextResponse.json({ error: "Nama kelas sudah digunakan." }, { status: 400 });
    }

    const newKelas = await prisma.kelas.create({
      data: {
        nama,
        programId,
      },
    });

    return NextResponse.json({ success: true, data: newKelas });
  } catch (error) {
    console.error("Error creating kelas:", error);
    return NextResponse.json({ error: "Gagal membuat kelas." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  const hasPermission = await checkPermission("ruang_kelas_edit");
  if (!session || !hasPermission) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, nama, programId } = body;

    if (!id || !nama || !programId) {
      return NextResponse.json({ error: "ID, Nama, dan Program wajib diisi." }, { status: 400 });
    }

    const existing = await prisma.kelas.findFirst({
      where: {
        nama,
        id: { not: id },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Nama kelas sudah digunakan." }, { status: 400 });
    }

    const updated = await prisma.kelas.update({
      where: { id },
      data: {
        nama,
        programId,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating kelas:", error);
    return NextResponse.json({ error: "Gagal mengubah kelas." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  const hasPermission = await checkPermission("ruang_kelas_edit");
  if (!session || !hasPermission) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID wajib disertakan." }, { status: 400 });
    }
    
    // Check if it's used by any riwayat santri
    const usedBy = await prisma.riwayatSantri.findFirst({
      where: { kelasId: id },
    });

    if (usedBy) {
      return NextResponse.json(
        { error: "Kelas tidak bisa dihapus karena masih digunakan oleh santri." },
        { status: 400 }
      );
    }

    await prisma.kelas.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting kelas:", error);
    return NextResponse.json({ error: "Gagal menghapus kelas." }, { status: 500 });
  }
}
