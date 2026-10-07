import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { buatStreamSSE } from "@/lib/pemilihan-lajnah-hub";

export const dynamic = "force-dynamic";

// SSE hasil pemilihan untuk pemilih. Berbagi hub dengan stream admin;
// vote/tutup/buka mendorong broadcast segera (debounce 300ms) di atas
// polling fallback 1 detik.
export async function GET(req: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const sesiId = searchParams.get("sesiId");
  if (!sesiId) return NextResponse.json({ error: "sesiId wajib diisi" }, { status: 400 });

  const santri = await prisma.santriInternal.findUnique({
    where: { id: session.santriId },
    select: { dufahNama: true },
  });
  const sesiAwal = await prisma.sesiPemilihanLajnah.findUnique({
    where: { id: sesiId },
    select: { dufahNama: true },
  });
  if (!sesiAwal || sesiAwal.dufahNama !== santri?.dufahNama) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return buatStreamSSE(sesiId, req);
}
