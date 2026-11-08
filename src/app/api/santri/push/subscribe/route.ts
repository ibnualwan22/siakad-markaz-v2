import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSantriSession } from "@/lib/santri-auth";

export const dynamic = "force-dynamic";

function isValidKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1000;
}

// Simpan (atau pindahkan) langganan Web Push perangkat ini ke santri yang
// login. Cerminan /api/push/subscribe staf, terikat sesi santri.
export async function POST(request: Request) {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;
    if (!isValidKey(endpoint) || !isValidKey(p256dh) || !isValidKey(auth)) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    await prisma.langgananWebPushSantri.upsert({
      where: { endpoint },
      update: { santriId: session.santriId, p256dh, auth },
      create: { santriId: session.santriId, endpoint, p256dh, auth },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem" },
      { status: 500 }
    );
  }
}

// Hapus langganan perangkat ini dari santri yang login.
export async function DELETE(request: Request) {
  const session = await getSantriSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const endpoint = body?.endpoint;
    if (!isValidKey(endpoint)) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    await prisma.langgananWebPushSantri.deleteMany({
      where: { endpoint, santriId: session.santriId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem" },
      { status: 500 }
    );
  }
}
