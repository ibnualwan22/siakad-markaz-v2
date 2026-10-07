import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { kunciSesiPemilihan, parseRencanaTutup, PemilihanLajnahError } from "@/lib/pemilihan-lajnah";
import { jadwalkanBroadcast } from "@/lib/pemilihan-lajnah-hub";

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
    const body = await req.json().catch(() => ({}));
    const updated = await prisma.$transaction(async (tx) => {
      const sesi = await kunciSesiPemilihan(tx, id);
      if (!sesi) throw new PemilihanLajnahError("Sesi tidak ditemukan", 404);
      if (sesi.status !== "DRAFT") {
        throw new PemilihanLajnahError("Hanya sesi DRAFT yang bisa dibuka", 400);
      }
      if (await tx.paslonLajnah.count({ where: { sesiId: id } }) < 1) {
        throw new PemilihanLajnahError("Daftarkan minimal 1 paslon dulu sebelum membuka", 400);
      }
      const now = new Date();
      return tx.sesiPemilihanLajnah.update({
        where: { id },
        data: {
          status: "BUKA",
          dibukaAt: now,
          rencanaTutupAt: parseRencanaTutup(body?.rencanaTutupAt, now),
        },
      });
    }, { isolationLevel: "ReadCommitted" });
    // Dorong status BUKA agar seremoni pembukaan langsung mulai di layar acara.
    jadwalkanBroadcast(id);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuka pemilihan" },
      { status: error instanceof PemilihanLajnahError ? error.status : 500 },
    );
  }
}
