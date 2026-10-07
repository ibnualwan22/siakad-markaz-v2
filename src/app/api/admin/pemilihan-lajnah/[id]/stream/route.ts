import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buatStreamSSE } from "@/lib/pemilihan-lajnah-hub";

export const dynamic = "force-dynamic";

const PERMISSION = "lajnah_manage";

// GET /api/admin/pemilihan-lajnah/[id]/stream — SSE realtime untuk layar acara.
// Berbagi hub yang sama dengan stream santri: setiap vote/tutup/buka yang
// berhasil mendorong broadcast segera (debounce 300ms), polling 1 detik
// tetap jadi fallback. Payload ringan (status + hitungan); layar acara
// menggabungkan hitungan seketika dan memuat ulang penuh saat status berubah.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") {
    const p = await prisma.rolePermission.findUnique({
      where: { role_permission: { role: session.role, permission: PERMISSION } },
    });
    if (!p) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const sesi = await prisma.sesiPemilihanLajnah.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
  return buatStreamSSE(id, req);
}
