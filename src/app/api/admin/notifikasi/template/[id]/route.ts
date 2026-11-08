import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

// 401 bila tanpa sesi, 403 bila sesi ada tapi tanpa izin notifikasi_kelola.
async function guard() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ok = await checkPermission("notifikasi_kelola");
  if (!ok) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  return null;
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Ctx) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const template = await prisma.notifikasiTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal memuat template" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: Ctx) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = await req.json();

    const data: { label?: string; deskripsi?: string | null; isActive?: boolean } = {};
    if (body?.label !== undefined) {
      const label = typeof body.label === "string" ? body.label.trim() : "";
      if (!label) {
        return NextResponse.json({ error: "Label template wajib diisi" }, { status: 400 });
      }
      data.label = label;
    }
    if (body?.deskripsi !== undefined) {
      data.deskripsi =
        typeof body.deskripsi === "string" && body.deskripsi.trim()
          ? body.deskripsi.trim()
          : null;
    }
    if (body?.isActive !== undefined) data.isActive = !!body.isActive;

    const template = await prisma.notifikasiTemplate.update({
      where: { id },
      data,
    });
    return NextResponse.json(template);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Gagal mengubah template" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Ctx) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const dipakai = await prisma.notifikasiJadwal.count({
      where: { templateId: id },
    });
    if (dipakai > 0) {
      return NextResponse.json(
        {
          error: `Template masih dipakai oleh ${dipakai} jadwal. Hapus atau ganti template jadwal tersebut dulu.`,
        },
        { status: 409 }
      );
    }
    await prisma.notifikasiTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Gagal menghapus template" }, { status: 500 });
  }
}
