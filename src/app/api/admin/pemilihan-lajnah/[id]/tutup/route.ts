import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PemilihanLajnahError, tutupPemilihanLajnah } from "@/lib/pemilihan-lajnah";

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

// POST /api/admin/pemilihan-lajnah/[id]/tutup — tutup sesi & tetapkan pemenang.
// Paslon suara terbanyak (seri: nomor urut terkecil) otomatis jadi AnggotaLajnah.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id } = await params;
    return NextResponse.json(await tutupPemilihanLajnah(prisma, id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menutup pemilihan" },
      { status: error instanceof PemilihanLajnahError ? error.status : 500 },
    );
  }
}
