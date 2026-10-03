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

// POST /api/admin/pemilihan-lajnah/[id]/buka — buka sesi pemungutan suara
// Body opsional: { rencanaTutupAt: ISO string }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id } = await params;
    const sesi = await prisma.sesiPemilihanLajnah.findUnique({
      where: { id },
      include: { _count: { select: { paslonList: true } } },
    });
    if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    if (sesi.status !== "DRAFT") {
      return NextResponse.json({ error: "Hanya sesi DRAFT yang bisa dibuka" }, { status: 400 });
    }
    if (sesi._count.paslonList < 1) {
      return NextResponse.json({ error: "Daftarkan minimal 1 paslon dulu sebelum membuka" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const updated = await prisma.sesiPemilihanLajnah.update({
      where: { id },
      data: {
        status: "BUKA",
        dibukaAt: new Date(),
        rencanaTutupAt: body?.rencanaTutupAt ? new Date(body.rencanaTutupAt) : null,
      },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
