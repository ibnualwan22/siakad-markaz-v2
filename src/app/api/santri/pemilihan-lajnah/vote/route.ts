import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";
import { catatSuaraPemilihan } from "@/lib/pemilihan-lajnah";
import { jadwalkanBroadcast } from "@/lib/pemilihan-lajnah-hub";

export const dynamic = "force-dynamic";

// POST /api/santri/pemilihan-lajnah/vote — catat suara santri (1 santri = 1 suara)
export async function POST(req: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sesiId, paslonId } = await req.json();
    if (typeof sesiId !== "string" || !sesiId || typeof paslonId !== "string" || !paslonId) {
      return NextResponse.json({ error: "Sesi dan paslon wajib diisi" }, { status: 400 });
    }
    const result = await catatSuaraPemilihan(prisma, { sesiId, paslonId, santriId: session.santriId });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    // Dorong hasil ke semua layar (santri + layar acara) tanpa menunggu poll.
    jadwalkanBroadcast(sesiId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mencatat suara" }, { status: 500 });
  }
}
