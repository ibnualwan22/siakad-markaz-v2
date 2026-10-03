import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { getActiveDufahName } from "@/lib/absensi";

export const dynamic = "force-dynamic";

// GET /api/santri/arsip-galeri?dufahNama=X — daftar arsip galeri untuk santri.
// Tanpa parameter: pakai dufah yang sedang aktif.
export async function GET(req: Request) {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    let dufahNama = searchParams.get("dufahNama");
    if (!dufahNama) {
      dufahNama = await getActiveDufahName();
    }
    const [data, dufahList] = await Promise.all([
      prisma.arsipGaleri.findMany({
        where: dufahNama ? { dufahNama } : {},
        orderBy: { createdAt: "desc" },
        select: { id: true, judul: true, driveUrl: true, dufahNama: true, createdAt: true },
      }),
      prisma.dufah.findMany({ select: { nama: true }, orderBy: { nama: "desc" } }),
    ]);
    return NextResponse.json({ dufahNama, data, dufahList: dufahList.map((d) => d.nama) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
