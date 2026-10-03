import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { kunciSesiPemilihan, parseRencanaTutup, PemilihanLajnahError, tutupPemilihanKedaluwarsa, waktuPemilihanHabis } from "@/lib/pemilihan-lajnah";

export const dynamic = "force-dynamic";

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
    await tutupPemilihanKedaluwarsa(prisma, id);
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
    return NextResponse.json({ ...sesi, serverNow: new Date().toISOString() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat sesi" }, { status: 500 });
  }
}

// PUT — ubah judul / rencana tutup (tidak bisa saat TUTUP)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id } = await params;
    await tutupPemilihanKedaluwarsa(prisma, id);
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Data sesi tidak valid" }, { status: 400 });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const sesi = await kunciSesiPemilihan(tx, id);
      if (!sesi) throw new PemilihanLajnahError("Sesi tidak ditemukan", 404);
      if (sesi.status === "TUTUP") {
        throw new PemilihanLajnahError("Sesi yang sudah ditutup tidak bisa diubah", 400);
      }
      // The deadline may have elapsed while this request waited for a vote's
      // lock. Do not let a late edit extend an already finished session.
      if (waktuPemilihanHabis(sesi)) return null;
      return tx.sesiPemilihanLajnah.update({
        where: { id },
        data: {
          ...(typeof body.judul === "string" && body.judul.trim() ? { judul: body.judul.trim() } : {}),
          ...("rencanaTutupAt" in body ? { rencanaTutupAt: parseRencanaTutup(body.rencanaTutupAt) } : {}),
        },
      });
    }, { isolationLevel: "ReadCommitted" });
    if (!updated) {
      await tutupPemilihanKedaluwarsa(prisma, id);
      return NextResponse.json({ error: "Waktu pemilihan sudah habis" }, { status: 400 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengubah sesi" },
      { status: error instanceof PemilihanLajnahError ? error.status : 500 },
    );
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
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menghapus sesi" }, { status: 500 });
  }
}
