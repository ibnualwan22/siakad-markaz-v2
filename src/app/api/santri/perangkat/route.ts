import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";

export const dynamic = "force-dynamic";

// Daftarkan / perbarui token FCM perangkat santri (aplikasi Flutter).
// Upsert berdasarkan token (unique): login ulang di perangkat yang sama
// hanya memperbarui pemilik + lastSeenAt.
export async function POST(request: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const token = body?.token;
    const platform = body?.platform ?? "android";
    if (typeof token !== "string" || token.length === 0 || token.length > 4096) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    if (platform !== "android" && platform !== "ios") {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    await prisma.perangkatSantri.upsert({
      where: { token },
      update: { santriId: session.santriId, platform, lastSeenAt: new Date() },
      create: { santriId: session.santriId, token, platform, lastSeenAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem" },
      { status: 500 }
    );
  }
}

// Hapus token perangkat ini. Hanya baris milik santri yang login yang
// dihapus — token milik santri lain tidak tersentuh.
export async function DELETE(request: Request) {
  const session = await getSantriSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const token = body?.token;
    if (typeof token !== "string" || token.length === 0 || token.length > 4096) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    await prisma.perangkatSantri.deleteMany({
      where: { token, santriId: session.santriId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem" },
      { status: 500 }
    );
  }
}
