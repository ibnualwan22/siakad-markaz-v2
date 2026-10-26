import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PemilihanOsimError, tutupPemilihanOsim } from "@/lib/pemilihan-osim";
import { jadwalkanBroadcast } from "@/lib/pemilihan-osim-hub";

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

// POST /api/admin/pemilihan-osim/[id]/tutup — tutup sesi & tetapkan pemenang.
// Paslon suara terbanyak (seri: nomor urut terkecil) otomatis jadi AnggotaOsim.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const { id } = await params;
    const hasil = await tutupPemilihanOsim(prisma, id);
    // Dorong status TUTUP agar seremoni hitung mundur langsung mulai di layar acara.
    jadwalkanBroadcast(id);
    return NextResponse.json(hasil);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menutup pemilihan" },
      { status: error instanceof PemilihanOsimError ? error.status : 500 },
    );
  }
}
