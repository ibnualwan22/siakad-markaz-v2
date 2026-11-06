import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkPermission } from "@/lib/permission";

export const dynamic = "force-dynamic";

// DELETE — hapus record munaqosah (santri kembali "belum munaqosah").
// Soalnya tidak dihapus; hanya penilaiannya.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const hasPerm = await checkPermission("huffadz_edit");
  if (!session || !hasPerm) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.munaqosahHufadz.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
