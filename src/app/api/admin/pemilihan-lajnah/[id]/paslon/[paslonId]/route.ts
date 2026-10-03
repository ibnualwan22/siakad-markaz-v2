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

async function getSesi(sesiId: string) {
  return prisma.sesiPemilihanLajnah.findUnique({ where: { id: sesiId } });
}

// PUT — ubah foto/visi-misi paslon (hanya DRAFT)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string; paslonId: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id: sesiId, paslonId } = await params;
    const sesi = await getSesi(sesiId);
    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    if (sesi.status !== "DRAFT") return NextResponse.json({ error: "Hanya bisa diubah saat DRAFT" }, { status: 400 });
    const { fotoUrl, visiMisi, nomorUrut } = await req.json();
    if (nomorUrut != null) {
      const bentrok = await prisma.paslonLajnah.findFirst({
        where: { sesiId, nomorUrut: Number(nomorUrut), id: { not: paslonId } },
      });
      if (bentrok) return NextResponse.json({ error: `Nomor urut ${nomorUrut} sudah dipakai` }, { status: 400 });
    }
    const paslon = await prisma.paslonLajnah.update({
      where: { id: paslonId },
      data: {
        ...(fotoUrl !== undefined ? { fotoUrl: fotoUrl?.trim() || null } : {}),
        ...(visiMisi !== undefined ? { visiMisi: visiMisi?.trim() || null } : {}),
        ...(nomorUrut != null ? { nomorUrut: Number(nomorUrut) } : {}),
      },
    });
    return NextResponse.json(paslon);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — hapus paslon (hanya DRAFT)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; paslonId: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id: sesiId, paslonId } = await params;
    const sesi = await getSesi(sesiId);
    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    if (sesi.status !== "DRAFT") return NextResponse.json({ error: "Hanya bisa dihapus saat DRAFT" }, { status: 400 });
    await prisma.paslonLajnah.delete({ where: { id: paslonId } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
