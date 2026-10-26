import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const PERMISSION = "osim_manage";

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

// GET /api/admin/pemilihan-osim?dufahNama=X — daftar sesi pemilihan
export async function GET(req: Request) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const dufahNama = searchParams.get("dufahNama");
    const sesi = await prisma.sesiPemilihanOsim.findMany({
      where: dufahNama ? { dufahNama } : {},
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { paslonList: true, suaraList: true } },
      },
    });
    return NextResponse.json(sesi);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/admin/pemilihan-osim — buat sesi baru (status DRAFT)
export async function POST(req: Request) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { judul, dufahNama } = await req.json();
    if (!judul?.trim() || !dufahNama?.trim()) {
      return NextResponse.json({ error: "Judul dan marhalah wajib diisi" }, { status: 400 });
    }
    const sesi = await prisma.sesiPemilihanOsim.create({
      data: { judul: judul.trim(), dufahNama: dufahNama.trim(), status: "DRAFT" },
    });
    return NextResponse.json(sesi);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
