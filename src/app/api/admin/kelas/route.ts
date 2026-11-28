import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export async function GET(request: Request) {
  const session = await getSession();
  // Any logged-in Admin/Teacher can view the class list for dropdowns
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const kelasList = await prisma.kelas.findMany({
      where: {
        isDeleted: false,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { nama: "asc" },
      include: {
        program: {
          select: { nama_indo: true },
        },
      },
    });
    return NextResponse.json(kelasList);
  } catch {
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
    const trimmedNama = String(nama || "").trim();

    if (!trimmedNama || !programId) {
      return NextResponse.json({ error: "Nama dan Program wajib diisi." }, { status: 400 });
    }

    const existing = await prisma.kelas.findUnique({
      where: { nama: trimmedNama },
    });

    if (existing) {
      // Jika kelas dengan nama sama pernah di-soft-delete, aktifkan kembali secara bersih
      if (existing.isDeleted) {
        const restored = await prisma.kelas.update({
          where: { id: existing.id },
          data: { programId, isDeleted: false, isActive: true },
        });
        return NextResponse.json({ success: true, data: restored, restored: true });
      }
      return NextResponse.json({ error: "Nama kelas sudah digunakan." }, { status: 400 });
    }

    const newKelas = await prisma.kelas.create({
      data: {
        nama: trimmedNama,
        programId,
        isActive: true,
        isDeleted: false,
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
    const { id, nama, programId, isActive } = body;
    const trimmedNama = String(nama || "").trim();

    if (!id || !trimmedNama || !programId) {
      return NextResponse.json({ error: "ID, Nama, dan Program wajib diisi." }, { status: 400 });
    }

    const existing = await prisma.kelas.findFirst({
      where: {
        nama: trimmedNama,
        id: { not: id },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Nama kelas sudah digunakan." }, { status: 400 });
    }

    const updated = await prisma.kelas.update({
      where: { id },
      data: {
        nama: trimmedNama,
        programId,
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating kelas:", error);
    return NextResponse.json({ error: "Gagal mengubah kelas." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  const hasPermission = await checkPermission("ruang_kelas_edit");
  if (!session || !hasPermission) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, isActive } = body as { id?: string; isActive?: boolean };

    if (!id || typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "ID dan status isActive (boolean) wajib diisi." },
        { status: 400 }
      );
    }

    const updated = await prisma.kelas.update({
      where: { id },
      data: { isActive, isDeleted: false },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: isActive
        ? `Kelas "${updated.nama}" berhasil diaktifkan.`
        : `Kelas "${updated.nama}" dinonaktifkan (disembunyikan dari Alokasi, Absen & Jadwal tanpa menghapus riwayat).`,
    });
  } catch (error) {
    console.error("Error toggling kelas active:", error);
    return NextResponse.json({ error: "Gagal mengubah status kelas." }, { status: 500 });
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

    const kelas = await prisma.kelas.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            riwayatRecords: true,
            absenPengajarList: true,
            pengajarSesiList: true,
            ketuaKelasList: true,
          },
        },
      },
    });

    if (!kelas) {
      return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
    }

    const hasHistory =
      kelas._count.riwayatRecords > 0 ||
      kelas._count.absenPengajarList > 0 ||
      kelas._count.pengajarSesiList > 0 ||
      kelas._count.ketuaKelasList > 0;

    if (hasHistory) {
      // Hapus aman (soft-delete): sembunyikan dari Manajemen Kelas & seluruh operasional
      // agar seluruh data RiwayatSantri, Nilai, Syahadah, dan AbsenPengajar lama tetap 100% utuh!
      await prisma.kelas.update({
        where: { id },
        data: { isActive: false, isDeleted: true },
      });

      return NextResponse.json({
        success: true,
        softDeleted: true,
        message: `Kelas "${kelas.nama}" dihapus dari daftar. Seluruh data riwayat santri (${kelas._count.riwayatRecords}) & absensi lama tetap aman utuh.`,
      });
    }

    await prisma.kelas.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      softDeleted: false,
      message: `Kelas "${kelas.nama}" berhasil dihapus permanen.`,
    });
  } catch (error) {
    console.error("Error deleting kelas:", error);
    return NextResponse.json({ error: "Gagal menghapus kelas." }, { status: 500 });
  }
}
