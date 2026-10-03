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

// GET /api/admin/arsip-galeri?dufahNama=X — daftar arsip (filter dufah opsional)
export async function GET(req: Request) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const dufahNama = searchParams.get("dufahNama");
    const data = await prisma.arsipGaleri.findMany({
      where: dufahNama ? { dufahNama } : {},
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/admin/arsip-galeri — tambah arsip baru
export async function POST(req: Request) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { judul, driveUrl, dufahNama } = await req.json();
    if (!judul?.trim() || !driveUrl?.trim() || !dufahNama?.trim()) {
      return NextResponse.json({ error: "Judul, link Google Drive, dan dufah wajib diisi" }, { status: 400 });
    }
    if (!validDriveUrl(driveUrl)) {
      return NextResponse.json({ error: "Link harus berupa link Google Drive (drive.google.com)" }, { status: 400 });
    }
    const data = await prisma.arsipGaleri.create({
      data: { judul: judul.trim(), driveUrl: driveUrl.trim(), dufahNama: dufahNama.trim() },
    });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
