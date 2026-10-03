import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const PERMISSION = "arsip_galeri";

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

function validDriveUrl(url: string) {
  return typeof url === "string" && url.includes("drive.google.com");
}

// PUT /api/admin/arsip-galeri/[id] — ubah arsip
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id } = await params;
    const { judul, driveUrl, dufahNama } = await req.json();
    if (!judul?.trim() || !driveUrl?.trim()) {
      return NextResponse.json({ error: "Judul dan link Google Drive wajib diisi" }, { status: 400 });
    }
    if (!validDriveUrl(driveUrl)) {
      return NextResponse.json({ error: "Link harus berupa link Google Drive (drive.google.com)" }, { status: 400 });
    }
    const data = await prisma.arsipGaleri.update({
      where: { id },
      data: {
        judul: judul.trim(),
        driveUrl: driveUrl.trim(),
        ...(dufahNama?.trim() ? { dufahNama: dufahNama.trim() } : {}),
      },
    });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/admin/arsip-galeri/[id] — hapus arsip
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id } = await params;
    await prisma.arsipGaleri.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
