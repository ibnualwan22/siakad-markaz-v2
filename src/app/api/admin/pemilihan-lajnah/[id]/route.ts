import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const PERMISSION = "lajnah_manage";

async function authorize() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") {
    const p = await prisma.rolePermission.findUnique({
      where: { role_permission: { role: session.role, permission: PERMISSION } },
    });
    if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// GET /api/admin/pemilihan-lajnah/[id] — detail sesi + paslon + hasil
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id } = await params;
    const sesi = await prisma.sesiPemilihanLajnah.findUnique({
      where: { id },
      include: {
        paslonList: {
          orderBy: { nomorUrut: "asc" },
          include: {
            santri1: { select: { id: true, nama: true } },
            santri2: { select: { id: true, nama: true } },
            _count: { select: { suaraList: true } },
          },
        },
      },
    });
    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    return NextResponse.json(sesi);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT — ubah judul / rencana tutup (tidak bisa saat TUTUP)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id } = await params;
    const sesi = await prisma.sesiPemilihanLajnah.findUnique({ where: { id } });
    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    if (sesi.status === "TUTUP") return NextResponse.json({ error: "Sesi yang sudah ditutup tidak bisa diubah" }, { status: 400 });
    const { judul, rencanaTutupAt } = await req.json();
    const updated = await prisma.sesiPemilihanLajnah.update({
      where: { id },
      data: {
        ...(judul?.trim() ? { judul: judul.trim() } : {}),
        rencanaTutupAt: rencanaTutupAt ? new Date(rencanaTutupAt) : null,
      },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — hapus sesi (hanya DRAFT)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id } = await params;
    const sesi = await prisma.sesiPemilihanLajnah.findUnique({ where: { id } });
    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    if (sesi.status !== "DRAFT") return NextResponse.json({ error: "Hanya sesi DRAFT yang bisa dihapus" }, { status: 400 });
    await prisma.sesiPemilihanLajnah.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
