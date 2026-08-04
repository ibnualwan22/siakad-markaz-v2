import { NextResponse } from "next/server";
import { getSantriSession } from "@/lib/santri-auth";
import prisma from "@/lib/prisma";

// Lightweight endpoint: santri polls this to check if their session is still active
export async function GET(req: Request) {
  try {
    const session = await getSantriSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const sesiId = searchParams.get("sesiId");
    if (!sesiId) return NextResponse.json({ error: "sesiId diperlukan" }, { status: 400 });

    const sesi = await prisma.sesiUjianSantri.findUnique({
      where: { id: sesiId },
      select: { status: true }
    });

    if (!sesi) return NextResponse.json({ status: "NOT_FOUND" });

    return NextResponse.json({ status: sesi.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
