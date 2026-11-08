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

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    const templates = await prisma.notifikasiTemplate.findMany({
      orderBy: { label: "asc" },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal memuat template" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const body = await req.json();
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    if (!label) {
      return NextResponse.json({ error: "Label template wajib diisi" }, { status: 400 });
    }
    const deskripsi =
      typeof body?.deskripsi === "string" && body.deskripsi.trim()
        ? body.deskripsi.trim()
        : null;
    const template = await prisma.notifikasiTemplate.create({
      data: {
        label,
        deskripsi,
        isActive: body?.isActive === undefined ? true : !!body.isActive,
      },
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal membuat template" }, { status: 500 });
  }
}
